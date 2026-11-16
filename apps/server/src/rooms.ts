import { randomInt, randomUUID } from 'node:crypto';
import { GameEngine, buildQuestionPool } from '@podiepanikk/game-engine';
import {
  CHARACTERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  TIMING,
  type GameSettings,
  type PublicState,
  type Question,
  type ViewMode,
} from '@podiepanikk/shared';
import { newToken } from './auth';
import { BotDriver } from './bots';
import type { ExternalQuestionSource } from './questions/external';
import { BUILTIN_QUESTIONS } from './questions/bank';
import type { Store } from './store';

export interface Member {
  id: string;
  token: string;
  kind: 'player' | 'screen';
  playerId: string | null;
  sockets: Set<string>;
  userId: string | null;
  lastSeen: number;
}

export interface Room {
  code: string;
  createdAt: number;
  lastActivity: number;
  engine: GameEngine;
  members: Map<string, Member>;
  hostMemberId: string;
  timer: NodeJS.Timeout | null;
  hostAwaySince: number | null;
  savedGameAt: number | null;
  bots: BotDriver;
}

export type Emit = (socketId: string, state: PublicState) => void;

const ROOM_IDLE_MS = 30 * 60_000; // ingen tilkoblede klienter
const LOBBY_MAX_MS = 3 * 3600_000; // romkoden utløper hvis spillet aldri startes
const ROOM_MAX_MS = 8 * 3600_000; // absolutt levetid
const MAX_SCREENS = 4;

export const actorId = (m: Member) => m.playerId ?? m.id;

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private sweeper: NodeJS.Timeout;

  constructor(
    private store: Store,
    private external: ExternalQuestionSource,
    private emit: Emit,
    private opts: { allowBots: boolean; allowTimeScale: boolean },
  ) {
    this.sweeper = setInterval(() => this.sweep(), 5000);
    this.sweeper.unref();
  }

  stop(): void {
    clearInterval(this.sweeper);
    for (const r of this.rooms.values()) {
      if (r.timer) clearTimeout(r.timer);
      r.bots.stop();
    }
  }

  private newCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let c = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) c += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(c)) return c;
    }
    throw new Error('Fant ingen ledig romkode');
  }

  async buildPool(settings: GameSettings, seed: number): Promise<{ pool: Question[]; warnings: string[] }> {
    const custom = await this.store.activeCustomQuestions().catch(() => []);
    let external: Question[] = [];
    const extraWarnings: string[] = [];
    if (settings.useExternal) {
      external = await this.external.fetch(settings.difficulty);
      if (external.length === 0) extraWarnings.push('Eksterne spørsmål var ikke tilgjengelige nå – bruker den innebygde banken.');
    }
    const r = buildQuestionPool([...BUILTIN_QUESTIONS, ...custom, ...external], settings, seed);
    return { pool: r.pool, warnings: [...extraWarnings, ...r.warnings] };
  }

  sanitizeSettings(s: GameSettings): GameSettings {
    const out = { ...s };
    if (!this.opts.allowTimeScale) delete out.timeScale;
    return out;
  }

  async create(settings: GameSettings, creator: { kind: 'player' | 'screen'; name?: string; characterId?: string; userId: string | null; opponents?: number }) {
    settings = this.sanitizeSettings(settings);
    if (settings.solo) {
      if (creator.kind !== 'player') throw new Error('Solospill krever en spiller');
      const opponents = Math.max(1, Math.min(11, creator.opponents ?? 3));
      settings = { ...settings, displayMode: 'mobile', maxPlayers: opponents + 1, botLevel: settings.botLevel ?? 'middels', useExternal: settings.useExternal };
    }
    const code = this.newCode();
    const seed = randomInt(2 ** 31);
    const { pool, warnings } = await this.buildPool(settings, seed);
    const hostMember: Member = { id: randomUUID(), token: newToken(), kind: creator.kind, playerId: null, sockets: new Set(), userId: creator.userId, lastSeen: Date.now() };
    if (creator.kind === 'player') hostMember.playerId = randomUUID();
    const engine = new GameEngine({ code, settings, seed, pool, hostId: actorId(hostMember), warnings });
    const room: Room = {
      code,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      engine,
      members: new Map([[hostMember.id, hostMember]]),
      hostMemberId: hostMember.id,
      timer: null,
      hostAwaySince: null,
      savedGameAt: null,
      bots: null as unknown as BotDriver,
    };
    room.bots = new BotDriver(room, () => this.afterChange(room));
    if (creator.kind === 'player') {
      const r = engine.addPlayer({ id: hostMember.playerId!, name: creator.name ?? 'Vert', characterId: creator.characterId ?? this.freeCharacter(engine) });
      if (!r.ok) throw new Error(r.error);
    }
    this.rooms.set(code, room);
    if (settings.solo) {
      for (let i = 1; i < settings.maxPlayers; i++) this.addBot(room, { solo: true });
      this.startSolo(room);
    }
    return { room, member: hostMember };
  }

  /** Solospill: spilleren er alltid klar, og showet starter med en gang. */
  private startSolo(room: Room): void {
    for (const p of room.engine.players) p.ready = true;
    room.engine.start(room.engine.hostId, Date.now());
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  freeCharacter(engine: GameEngine): string {
    const used = new Set(engine.players.map((p) => p.characterId));
    const free = CHARACTERS.filter((c) => !used.has(c.id));
    return (free.length ? free : CHARACTERS)[randomInt(free.length || CHARACTERS.length)].id;
  }

  /** Ny deltaker, eller gjenoppkobling med hemmelig token. */
  join(room: Room, input: { as: 'player' | 'screen'; name?: string; characterId?: string; token?: string; view?: ViewMode; userId: string | null }):
    | { ok: true; member: Member; reconnected: boolean }
    | { ok: false; error: string } {
    if (input.token) {
      const existing = [...room.members.values()].find((m) => m.token === input.token);
      if (existing) {
        const p = existing.playerId ? room.engine.getPlayer(existing.playerId) : null;
        if (existing.playerId && (!p || p.left)) return { ok: false, error: 'Du er ikke lenger med i dette spillet' };
        if (input.userId && !existing.userId) existing.userId = input.userId;
        return { ok: true, member: existing, reconnected: true };
      }
    }
    if (input.as === 'screen') {
      const screens = [...room.members.values()].filter((m) => m.kind === 'screen').length;
      if (screens >= MAX_SCREENS) return { ok: false, error: 'Maks antall storskjermer er nådd' };
      const m: Member = { id: randomUUID(), token: newToken(), kind: 'screen', playerId: null, sockets: new Set(), userId: input.userId, lastSeen: Date.now() };
      room.members.set(m.id, m);
      return { ok: true, member: m, reconnected: false };
    }
    if (room.engine.settings.solo) return { ok: false, error: 'Dette er et solospill – start ditt eget show i stedet!' };
    if (!input.name) return { ok: false, error: 'Skriv inn et navn' };
    const playerId = randomUUID();
    const r = room.engine.addPlayer({
      id: playerId,
      name: input.name,
      characterId: input.characterId ?? this.freeCharacter(room.engine),
      view: input.view,
    });
    if (!r.ok) return { ok: false, error: r.error };
    const m: Member = { id: randomUUID(), token: newToken(), kind: 'player', playerId, sockets: new Set(), userId: input.userId, lastSeen: Date.now() };
    room.members.set(m.id, m);
    return { ok: true, member: m, reconnected: false };
  }

  removeMember(room: Room, member: Member): void {
    if (member.playerId) room.engine.removePlayer(member.playerId, Date.now());
    room.members.delete(member.id);
    if (room.hostMemberId === member.id) this.transferHost(room);
  }

  addBot(room: Room, opts: { solo?: boolean } = {}): { ok: boolean; error?: string } {
    // Solomotstandere er alltid tillatt; testspillere i vanlige rom styres av ALLOW_BOTS.
    if (!opts.solo && !this.opts.allowBots) return { ok: false, error: 'Testspillere er slått av på denne serveren' };
    const n = room.engine.players.filter((p) => p.isBot).length + 1;
    const char = this.freeCharacter(room.engine);
    const def = CHARACTERS.find((c) => c.id === char)!;
    // I solospill heter motstanderne det samme som karakterene sine (f.eks. «Professor Pling»).
    const name = opts.solo ? def.name.slice(0, 16) : `${def.name.split(' ')[0].slice(0, 10)}-bot ${n}`.slice(0, 16);
    const r = room.engine.addPlayer({ id: `bot-${randomUUID().slice(0, 8)}`, name, characterId: char, isBot: true });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  async rematch(room: Room): Promise<void> {
    const seed = randomInt(2 ** 31);
    const { pool, warnings } = await this.buildPool(room.engine.settings, seed);
    room.engine.resetToLobby(pool, warnings);
    room.savedGameAt = null;
    // Fjern medlemmer som har forlatt spillet.
    for (const m of [...room.members.values()]) if (m.playerId && !room.engine.getPlayer(m.playerId)) room.members.delete(m.id);
    if (room.engine.settings.solo) this.startSolo(room);
  }

  private transferHost(room: Room): void {
    const candidate = [...room.members.values()].find((m) => m.id !== room.hostMemberId && m.sockets.size > 0 && (m.kind === 'screen' || (m.playerId && !room.engine.getPlayer(m.playerId)?.left)));
    if (!candidate) return;
    room.hostMemberId = candidate.id;
    room.engine.setHost(actorId(candidate));
    room.hostAwaySince = null;
  }

  /** Kalles etter enhver endring: sender tilstand, planlegger tidtaker, lagrer resultat. */
  afterChange(room: Room): void {
    room.lastActivity = Date.now();
    this.broadcast(room);
    this.schedule(room);
    room.bots.onChange();
    if ((room.engine.phase === 'CEREMONY' || room.engine.phase === 'GAME_OVER') && room.savedGameAt == null) {
      room.savedGameAt = Date.now();
      void this.saveResult(room);
    }
  }

  broadcast(room: Room): void {
    const now = Date.now();
    for (const m of room.members.values()) {
      if (m.sockets.size === 0) continue;
      const snap = room.engine.snapshot({ memberId: m.id, playerId: m.playerId, isHost: m.id === room.hostMemberId, isScreen: m.kind === 'screen' }, now);
      for (const sid of m.sockets) this.emit(sid, snap);
    }
  }

  private schedule(room: Room): void {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    const wake = room.engine.nextWakeAt();
    if (wake == null) return;
    room.timer = setTimeout(() => {
      room.timer = null;
      if (room.engine.tick(Date.now())) this.afterChange(room);
      else this.schedule(room);
    }, Math.max(0, wake - Date.now()) + 5);
  }

  private async saveResult(room: Room): Promise<void> {
    // Solospill mot datamaskinen teller ikke på profiler og topplister.
    if (room.engine.settings.solo) return;
    const summary = room.engine.resultSummary();
    if (!summary) return;
    const humans = summary.players.filter((p) => !p.isBot);
    if (humans.length === 0) return;
    const userByPlayer = new Map([...room.members.values()].filter((m) => m.playerId).map((m) => [m.playerId!, m.userId]));
    try {
      await this.store.saveGame({
        id: randomUUID(),
        code: room.code,
        mode: room.engine.settings.displayMode,
        difficulty: room.engine.settings.difficulty,
        length: room.engine.settings.length,
        playerCount: summary.players.length,
        startedAt: summary.startedAt,
        endedAt: summary.endedAt,
        // Gjestenavn lagres ikke (personvern) – kun koblet bruker-ID for innloggede.
        results: humans.map((p) => ({
          userId: userByPlayer.get(p.id) ?? null,
          characterId: p.characterId,
          score: p.score,
          rank: p.rank,
          won: p.id === summary.winnerId,
          correct: p.correct,
          answered: p.answered,
          totalMs: p.totalMs,
        })),
      });
    } catch (err) {
      console.error('[rooms] Klarte ikke å lagre resultat', err);
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      const connected = [...room.members.values()].some((m) => m.sockets.size > 0);
      const expired =
        now - room.createdAt > ROOM_MAX_MS ||
        (!connected && now - room.lastActivity > ROOM_IDLE_MS) ||
        (room.engine.phase === 'LOBBY' && room.engine.startedAt == null && now - room.createdAt > LOBBY_MAX_MS);
      if (expired) {
        if (room.timer) clearTimeout(room.timer);
        room.bots.stop();
        this.rooms.delete(room.code);
        continue;
      }
      // Vertsoverføring hvis verten har vært borte lenge.
      const host = room.members.get(room.hostMemberId);
      if (!host || host.sockets.size === 0) {
        room.hostAwaySince ??= now;
        if (now - room.hostAwaySince > TIMING.hostTransferAfter) {
          const before = room.hostMemberId;
          this.transferHost(room);
          if (room.hostMemberId !== before) this.afterChange(room);
        }
      } else room.hostAwaySince = null;
    }
  }
}
