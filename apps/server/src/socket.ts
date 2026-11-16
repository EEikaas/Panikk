import type { Server, Socket } from 'socket.io';
import type { ZodType, ZodTypeDef } from 'zod';
import {
  answerSchema,
  buzzSchema,
  createRoomSchema,
  joinRoomSchema,
  kickSchema,
  pauseSchema,
  playerUpdateSchema,
  targetSchema,
  type Ack,
  type JoinAckData,
} from '@podiepanikk/shared';
import type { AuthService } from './auth';
import type { Config } from './config';
import { TokenBucket, WindowLimiter } from './ratelimit';
import { actorId, type Member, type Room, type RoomManager } from './rooms';

type AckFn = (r: Ack<unknown>) => void;

interface SocketData {
  code?: string;
  memberId?: string;
  userId: string | null;
  ip: string;
  bucket: TokenBucket;
}

export function clientIp(socket: Socket, trustProxy: boolean): string {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  if (trustProxy && typeof fwd === 'string') return fwd.split(',')[0].trim();
  return socket.handshake.address;
}

export function registerSocketHandlers(io: Server, rooms: RoomManager, auth: AuthService, config: Config): void {
  const createLimiter = new WindowLimiter(15, 10 * 60_000);
  const joinLimiter = new WindowLimiter(120, 60_000);

  io.on('connection', async (socket: Socket) => {
    const data: SocketData = { userId: null, ip: clientIp(socket, config.trustProxy), bucket: new TokenBucket(30, 12) };
    socket.data = data;
    // Profil kobles kun via sikker sesjonskapsel – aldri via navn fra klienten.
    const userReady = auth
      .userFromCookie(socket.handshake.headers.cookie)
      .then((u) => {
        data.userId = u?.id ?? null;
      })
      .catch(() => undefined);

    const ctx = (): { room: Room; member: Member } | null => {
      if (!data.code || !data.memberId) return null;
      const room = rooms.get(data.code);
      const member = room?.members.get(data.memberId);
      return room && member ? { room, member } : null;
    };

    /** Felles innpakning: hastighetsbegrensning, Zod-validering, feilhåndtering og ack. */
    function on<T>(event: string, schema: ZodType<T, ZodTypeDef, unknown> | null,handler: (payload: T, ack: AckFn) => Promise<void> | void) {
      socket.on(event, async (payload: unknown, maybeAck?: unknown) => {
        const ack: AckFn = typeof maybeAck === 'function' ? (maybeAck as AckFn) : () => undefined;
        if (!data.bucket.take()) return ack({ ok: false, error: 'For mange forespørsler – ta det litt med ro!' });
        let parsed = payload as T;
        if (schema) {
          const r = schema.safeParse(payload ?? {});
          if (!r.success) return ack({ ok: false, error: 'Ugyldig forespørsel' });
          parsed = r.data;
        }
        try {
          await handler(parsed, ack);
        } catch (err) {
          console.error(`[socket] ${event}`, err);
          ack({ ok: false, error: 'Noe gikk galt på serveren' });
        }
      });
    }

    function attach(room: Room, member: Member) {
      const prev = ctx();
      if (prev && (prev.room !== room || prev.member !== member)) detach();
      data.code = room.code;
      data.memberId = member.id;
      member.sockets.add(socket.id);
      member.lastSeen = Date.now();
      if (member.playerId) room.engine.setConnected(member.playerId, true, Date.now());
      void socket.join(`room:${room.code}`);
    }

    function detach() {
      const c = ctx();
      if (!c) return;
      c.member.sockets.delete(socket.id);
      void socket.leave(`room:${c.room.code}`);
      if (c.member.sockets.size === 0 && c.member.playerId) {
        c.room.engine.setConnected(c.member.playerId, false, Date.now());
      }
      data.code = undefined;
      data.memberId = undefined;
      rooms.afterChange(c.room);
    }

    const joinAck = (room: Room, member: Member): Ack<JoinAckData> => ({
      ok: true,
      data: { code: room.code, memberId: member.id, token: member.token, playerId: member.playerId },
    });

    on('time:sync', null, (_p, ack) => ack({ ok: true, data: { serverNow: Date.now() } }));

    on('room:create', createRoomSchema, async (p, ack) => {
      if (!createLimiter.hit(data.ip)) return ack({ ok: false, error: 'Du har opprettet mange rom – vent litt.' });
      if (p.as === 'player' && !p.name) return ack({ ok: false, error: 'Skriv inn et navn' });
      if (p.settings.solo && p.as !== 'player') return ack({ ok: false, error: 'Solospill krever en spiller' });
      await userReady;
      const { room, member } = await rooms.create(p.settings, { kind: p.as, name: p.name, characterId: p.characterId, userId: data.userId, opponents: p.opponents });
      attach(room, member);
      ack(joinAck(room, member));
      rooms.afterChange(room);
    });

    on('room:join', joinRoomSchema, async (p, ack) => {
      if (!joinLimiter.hit(data.ip)) return ack({ ok: false, error: 'For mange forsøk – vent litt.' });
      const room = rooms.get(p.code);
      if (!room) return ack({ ok: false, error: 'Fant ikke rommet. Sjekk koden – den kan ha utløpt.' });
      await userReady;
      const r = rooms.join(room, { as: p.as, name: p.name, characterId: p.characterId, token: p.token, view: p.view, userId: data.userId });
      if (!r.ok) return ack({ ok: false, error: r.error });
      if (p.view && r.member.playerId) room.engine.updatePlayer(r.member.playerId, { view: p.view });
      attach(room, r.member);
      ack(joinAck(room, r.member));
      rooms.afterChange(room);
    });

    on('room:leave', null, (_p, ack) => {
      const c = ctx();
      if (!c) return ack({ ok: true });
      c.member.sockets.delete(socket.id);
      rooms.removeMember(c.room, c.member);
      data.code = undefined;
      data.memberId = undefined;
      void socket.leave(`room:${c.room.code}`);
      ack({ ok: true });
      rooms.afterChange(c.room);
    });

    on('player:update', playerUpdateSchema, (p, ack) => {
      const c = ctx();
      if (!c?.member.playerId) return ack({ ok: false, error: 'Ikke med i et rom' });
      const r = c.room.engine.updatePlayer(c.member.playerId, p);
      ack(r.ok ? { ok: true } : { ok: false, error: r.error });
      if (r.ok) rooms.afterChange(c.room);
    });

    on('game:answer', answerSchema, (p, ack) => {
      const c = ctx();
      if (!c?.member.playerId) return ack({ ok: false, error: 'Ikke med i et rom' });
      const r = c.room.engine.answer(c.member.playerId, p.questionId, p.choice, p.actionId, Date.now());
      ack(r.ok ? { ok: true } : { ok: false, error: r.error });
      if (r.ok && !r.duplicate) rooms.afterChange(c.room);
    });

    on('game:buzz', buzzSchema, (p, ack) => {
      const c = ctx();
      if (!c?.member.playerId) return ack({ ok: false, error: 'Ikke med i et rom' });
      const r = c.room.engine.buzzIn(c.member.playerId, p.questionId, p.actionId, Date.now());
      ack(r.ok ? { ok: true } : { ok: false, error: r.error });
      if (r.ok && !r.duplicate) rooms.afterChange(c.room);
    });

    on('game:target', targetSchema, (p, ack) => {
      const c = ctx();
      if (!c?.member.playerId) return ack({ ok: false, error: 'Ikke med i et rom' });
      const r = c.room.engine.chooseTarget(c.member.playerId, p.targetId, p.actionId, Date.now());
      ack(r.ok ? { ok: true } : { ok: false, error: r.error });
      if (r.ok && !r.duplicate) rooms.afterChange(c.room);
    });

    // ── Vertshandlinger: rettigheter sjekkes på serveren mot vertens medlems-ID ──
    const hostOnly = (fn: (room: Room, member: Member, ack: AckFn) => void | Promise<void>) => async (_p: unknown, ack: AckFn) => {
      const c = ctx();
      if (!c) return ack({ ok: false, error: 'Ikke med i et rom' });
      if (c.room.hostMemberId !== c.member.id) return ack({ ok: false, error: 'Bare verten kan gjøre dette' });
      await fn(c.room, c.member, ack);
    };

    on('host:start', null, hostOnly((room, m, ack) => {
      const r = room.engine.start(actorId(m), Date.now());
      ack(r.ok ? { ok: true } : { ok: false, error: r.error });
      if (r.ok) rooms.afterChange(room);
    }));

    on('host:pause', pauseSchema, (p, ack) =>
      hostOnly((room, m, a) => {
        const r = room.engine.setPaused(actorId(m), p.paused, Date.now());
        a(r.ok ? { ok: true } : { ok: false, error: r.error });
        if (r.ok) rooms.afterChange(room);
      })(p, ack),
    );

    on('host:advance', null, hostOnly((room, m, ack) => {
      const r = room.engine.advance(actorId(m), Date.now());
      ack(r.ok ? { ok: true } : { ok: false, error: r.error });
      if (r.ok) rooms.afterChange(room);
    }));

    on('host:kick', kickSchema, (p, ack) =>
      hostOnly((room, m, a) => {
        const target = [...room.members.values()].find((x) => x.playerId === p.playerId);
        const r = room.engine.kick(actorId(m), p.playerId, Date.now());
        if (!r.ok) return a({ ok: false, error: r.error });
        if (target) {
          for (const sid of target.sockets) io.to(sid).emit('kicked');
          room.members.delete(target.id);
        }
        a({ ok: true });
        rooms.afterChange(room);
      })(p, ack),
    );

    on('host:addBot', null, hostOnly((room, _m, ack) => {
      if (room.engine.phase !== 'LOBBY') return ack({ ok: false, error: 'Bare i lobbyen' });
      const r = rooms.addBot(room);
      ack(r.ok ? { ok: true } : { ok: false, error: r.error });
      if (r.ok) rooms.afterChange(room);
    }));

    on('host:rematch', null, hostOnly(async (room, _m, ack) => {
      if (room.engine.phase !== 'GAME_OVER' && room.engine.phase !== 'CEREMONY') return ack({ ok: false, error: 'Spillet er ikke ferdig' });
      await rooms.rematch(room);
      ack({ ok: true });
      rooms.afterChange(room);
    }));

    socket.on('disconnect', () => detach());
  });
}
