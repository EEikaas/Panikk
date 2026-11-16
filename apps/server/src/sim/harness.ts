import { randomUUID } from 'node:crypto';
import { io as connect, type Socket } from 'socket.io-client';
import { CHARACTER_IDS, type Ack, type GameSettings, type JoinAckData, type PublicState, type ViewMode } from '@podiepanikk/shared';

/*
 * Simulator: ekte Socket.IO-klienter mot en kjørende server.
 * Brukes både av `npm run simulate` og av integrasjonstestene.
 */

export interface SimClientOptions {
  label: string;
  latencyMs: [number, number]; // kunstig nettverksforsinkelse (min, maks)
  view: ViewMode;
}

export class SimClient {
  socket: Socket;
  state: PublicState | null = null;
  states = 0;
  token: string | null = null;
  playerId: string | null = null;
  errors: string[] = [];
  seen = new Map<string, string>(); // fase-nøkkel → spørsmåls-ID
  private acted = new Set<string>();
  auto = true;

  constructor(public url: string, public opts: SimClientOptions) {
    this.socket = this.makeSocket();
  }

  private makeSocket(): Socket {
    const s = connect(this.url, { transports: ['websocket'], forceNew: true, reconnection: false });
    s.on('state', (st: PublicState) => this.onState(st));
    return s;
  }

  private delay(): Promise<void> {
    const [a, b] = this.opts.latencyMs;
    return new Promise((r) => setTimeout(r, a + Math.random() * (b - a)));
  }

  async emit<T = unknown>(event: string, payload: unknown = {}): Promise<Ack<T>> {
    await this.delay();
    return new Promise((res) => this.socket.emit(event, payload, (r: Ack<T>) => res(r)));
  }

  async connected(): Promise<void> {
    if (this.socket.connected) return;
    await new Promise<void>((res, rej) => {
      this.socket.once('connect', () => res());
      this.socket.once('connect_error', rej);
    });
  }

  async create(settings: GameSettings): Promise<string> {
    await this.connected();
    const r = await this.emit<JoinAckData>('room:create', { settings, as: 'screen' });
    if (!r.ok) throw new Error(r.error);
    this.token = r.data!.token;
    return r.data!.code;
  }

  async join(code: string, name: string): Promise<Ack<JoinAckData>> {
    await this.connected();
    const r = await this.emit<JoinAckData>('room:join', { code, as: 'player', name, characterId: CHARACTER_IDS[Math.floor(Math.random() * CHARACTER_IDS.length)], view: this.opts.view });
    if (r.ok) {
      this.token = r.data!.token;
      this.playerId = r.data!.playerId;
    }
    return r;
  }

  /** Simulerer nettverksbrudd og gjenoppkobling med samme hemmelige token. */
  async reconnect(code: string): Promise<Ack<JoinAckData>> {
    this.socket.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    this.socket = this.makeSocket();
    await this.connected();
    return this.emit<JoinAckData>('room:join', { code, as: 'player', token: this.token });
  }

  private onState(st: PublicState): void {
    this.state = st;
    this.states++;
    if (st.question && (st.phase === 'QUESTION' || st.phase === 'BUZZ_ANSWER')) {
      const key = `${st.round?.index}:${st.question.number}`;
      const prev = this.seen.get(key);
      if (prev && prev !== st.question.id) this.errors.push(`Ulike spørsmål for ${key}: ${prev} vs ${st.question.id}`);
      this.seen.set(key, st.question.id);
    }
    if (!this.auto) return;
    const you = st.you;
    const stamp = `${st.phase}:${st.phaseStartedAt}`;
    const once = (k: string, fn: () => Promise<unknown>) => {
      if (this.acted.has(k)) return;
      this.acted.add(k);
      void fn();
    };
    if (you.canBuzz && st.question && Math.random() < 0.5) {
      once(`buzz:${stamp}`, () => this.emit('game:buzz', { actionId: randomUUID(), questionId: st.question!.id }));
    }
    if (you.canAnswer && st.question) {
      const actionId = randomUUID();
      const payload = { actionId, questionId: st.question.id, choice: Math.floor(Math.random() * 4) };
      once(`answer:${stamp}`, async () => {
        await this.emit('game:answer', payload);
        // Idempotens: et dobbeltsendt svar (f.eks. etter nettverksfeil) skal ikke telle to ganger.
        if (Math.random() < 0.2) await this.emit('game:answer', payload);
      });
    }
    if (you.canTarget && you.targetOptions.length) {
      once(`target:${stamp}`, () =>
        this.emit('game:target', { actionId: randomUUID(), targetId: you.targetOptions[Math.floor(Math.random() * you.targetOptions.length)] }),
      );
    }
  }

  close(): void {
    this.socket.disconnect();
  }
}

export interface SimulationReport {
  code: string;
  rounds: string[];
  winnerId: string | null;
  winnerName: string | null;
  durationMs: number;
  players: { name: string; label: string; view: ViewMode; score: number }[];
  consistencyErrors: string[];
  reconnectOk: boolean;
  viewSwitchOk: boolean;
}

export async function runSimulation(opts: {
  url: string;
  timeScale: number;
  length?: GameSettings['length'];
  log?: (msg: string) => void;
  timeoutMs?: number;
}): Promise<SimulationReport> {
  const log = opts.log ?? (() => undefined);
  const started = Date.now();
  const screen = new SimClient(opts.url, { label: 'TV', latencyMs: [1, 5], view: 'full' });
  screen.auto = false;
  const code = await screen.create({
    displayMode: 'mixed',
    difficulty: 'familie',
    length: opts.length ?? 'kort',
    maxPlayers: 12,
    categories: [],
    useExternal: false,
    timeScale: opts.timeScale,
  });
  log(`Rom opprettet: ${code}`);

  const groups: { label: string; view: ViewMode; latency: [number, number] }[] = [
    { label: 'TV-kontroller', view: 'controller', latency: [2, 15] },
    { label: 'Full mobil', view: 'full', latency: [10, 40] },
    { label: 'Fjernspiller', view: 'full', latency: [60, 180] },
  ];
  const players: SimClient[] = [];
  for (const g of groups) {
    for (let i = 1; i <= 4; i++) {
      const c = new SimClient(opts.url, { label: g.label, latencyMs: g.latency, view: g.view });
      const r = await c.join(code, `${g.label.split(/[- ]/)[0].slice(0, 6)} ${i}`);
      if (!r.ok) throw new Error(`Join feilet: ${r.error}`);
      players.push(c);
    }
  }
  log(`12 spillere koblet til (4 kontrollere, 4 full mobil, 4 fjernspillere)`);

  // Den 13. skal avvises.
  const extra = new SimClient(opts.url, { label: 'Ekstra', latencyMs: [1, 2], view: 'full' });
  const extraR = await extra.join(code, 'Tretten');
  extra.close();
  if (extraR.ok) throw new Error('13. spiller ble sluppet inn!');

  await Promise.all(players.map((p) => p.emit('player:update', { ready: true })));
  const startR = await screen.emit('host:start');
  if (!startR.ok) throw new Error(`Start feilet: ${startR.error}`);
  log('Spillet er startet');

  // Underveis: én spiller mister nettet og kommer tilbake, én bytter visning.
  let reconnectOk = false;
  let viewSwitchOk = false;
  const midGame = (async () => {
    await waitFor(() => screen.state?.phase === 'QUESTION', 30_000);
    const victim = players[5];
    const before = screen.state!.players.find((p) => p.id === victim.playerId)!;
    const r = await victim.reconnect(code);
    await waitFor(() => !!victim.state && victim.state.you.playerId === victim.playerId, 5000);
    const after = victim.state!.players.find((p) => p.id === victim.playerId)!;
    reconnectOk = r.ok && after.characterId === before.characterId && after.score >= 0 && after.connected;
    log(`Gjenoppkobling: ${reconnectOk ? 'OK' : 'FEIL'}`);
    const switcher = players[0];
    const v1 = await switcher.emit('player:update', { view: 'full' });
    const v2 = await switcher.emit('player:update', { view: 'controller' });
    viewSwitchOk = v1.ok && v2.ok;
    log(`Bytte visningsmodus: ${viewSwitchOk ? 'OK' : 'FEIL'}`);
  })();

  let lastPhase = '';
  const phaseLogger = setInterval(() => {
    const s = screen.state;
    if (s && `${s.phase}${s.round?.index}` !== lastPhase) {
      lastPhase = `${s.phase}${s.round?.index}`;
      if (s.phase === 'ROUND_INTRO') log(`Runde ${s.round!.index + 1}/${s.round!.total}: ${s.round!.name}`);
    }
  }, 20);

  await waitFor(() => screen.state?.phase === 'GAME_OVER', opts.timeoutMs ?? 300_000);
  clearInterval(phaseLogger);
  await midGame;
  await new Promise((r) => setTimeout(r, 300));

  const final = screen.state!;
  const errors = [...screen.errors, ...players.flatMap((p) => p.errors.map((e) => `${p.opts.label}: ${e}`))];
  // Alle klienter skal ha identisk sluttstatus.
  for (const p of players) {
    const s = p.state!;
    if (s.phase !== 'GAME_OVER') errors.push(`${p.opts.label} endte i ${s.phase}`);
    if (s.winnerId !== final.winnerId) errors.push(`${p.opts.label} har annen vinner`);
    if (JSON.stringify(s.ranking) !== JSON.stringify(final.ranking)) errors.push(`${p.opts.label} har annen rangering`);
    const scoresA = s.players.map((x) => `${x.id}:${x.score}`).join();
    const scoresB = final.players.map((x) => `${x.id}:${x.score}`).join();
    if (scoresA !== scoresB) errors.push(`${p.opts.label} har andre poeng`);
  }
  // Samme spørsmål for samme posisjon hos alle klienter.
  const reference = new Map<string, string>();
  for (const c of [screen, ...players]) {
    for (const [k, v] of c.seen) {
      const ref = reference.get(k);
      if (ref && ref !== v) errors.push(`Spørsmål ${k} ulikt mellom klienter`);
      reference.set(k, v);
    }
  }

  const winner = final.players.find((p) => p.id === final.winnerId);
  const report: SimulationReport = {
    code,
    rounds: [],
    winnerId: final.winnerId,
    winnerName: winner?.name ?? null,
    durationMs: Date.now() - started,
    players: players.map((p) => {
      const pl = final.players.find((x) => x.id === p.playerId)!;
      return { name: pl.name, label: p.opts.label, view: p.opts.view, score: pl.score };
    }),
    consistencyErrors: errors,
    reconnectOk,
    viewSwitchOk,
  };
  for (const c of [screen, ...players]) c.close();
  return report;
}

export function waitFor(cond: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (cond()) {
        clearInterval(iv);
        res();
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(iv);
        rej(new Error('Tidsavbrudd i simulatoren'));
      }
    }, 10);
  });
}
