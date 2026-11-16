import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import type { Ack, FxEvent, GameSettings, JoinAckData, PlayerUpdateInput, PublicState, ViewMode } from '@podiepanikk/shared';

/*
 * Klientens sanntidslag. Serveren er autoritativ: vi sender bare handlinger
 * og viser den tilstanden serveren sender tilbake. Alle kritiske handlinger
 * har en unik actionId slik at gjentatte sendinger ikke telles dobbelt.
 */

export type ConnStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';

interface StoredMembership {
  token: string;
  memberId: string;
  as: 'player' | 'screen';
  view?: ViewMode;
}

interface RoomStore {
  status: ConnStatus;
  code: string | null;
  state: PublicState | null;
  offset: number; // serverklokke − lokal klokke
  rtt: number;
  fxBatch: { seq: number; events: FxEvent[] };
  view: ViewMode;
  error: string | null;
  kicked: boolean;
}

export const useRoom = create<RoomStore>(() => ({
  status: 'idle',
  code: null,
  state: null,
  offset: 0,
  rtt: 0,
  fxBatch: { seq: 0, events: [] },
  view: 'controller',
  error: null,
  kicked: false,
}));

let socket: Socket | null = null;
let lastFxId = -1;
let reconnecting = false;
let activeMembership: StoredMembership | null = null;

const memberKey = (code: string) => `pp:member:${code}`;

/*
 * Plassen i rommet lagres per fane (sessionStorage – overlever oppdatering av siden)
 * og som reserve i localStorage (hvis mobilnettleseren har lukket fanen).
 * Med ?ny=1 hoppes lagret plass over, f.eks. for å teste flere spillere i samme nettleser.
 */
export function getMembership(code: string, opts: { ignoreShared?: boolean } = {}): StoredMembership | null {
  try {
    const own = sessionStorage.getItem(memberKey(code));
    if (own) return JSON.parse(own);
    if (opts.ignoreShared || new URLSearchParams(location.search).get('ny') === '1') return null;
    return JSON.parse(localStorage.getItem(memberKey(code)) ?? 'null');
  } catch {
    return null;
  }
}
function saveMembership(code: string, m: StoredMembership) {
  try {
    sessionStorage.setItem(memberKey(code), JSON.stringify(m));
    localStorage.setItem(memberKey(code), JSON.stringify(m));
  } catch {
    /* privat modus – gjenoppkobling virker da bare så lenge fanen er åpen */
  }
}
export function forgetMembership(code: string) {
  try {
    sessionStorage.removeItem(memberKey(code));
    localStorage.removeItem(memberKey(code));
  } catch {
    /* ignorer */
  }
}

export const serverNow = () => Date.now() + useRoom.getState().offset;

export function actionId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function ensureSocket(): Socket {
  if (socket) return socket;
  socket = io({ path: '/socket.io', transports: ['websocket', 'polling'], reconnectionDelay: 500, reconnectionDelayMax: 4000, withCredentials: true });
  socket.on('connect', () => {
    useRoom.setState({ status: 'online', error: null });
    void syncClock();
    // Etter nettverksbrudd: koble til samme plass igjen med lagret token.
    const code = useRoom.getState().code;
    // Bruk plassen denne fanen faktisk har (i minnet) – ikke en annen fanes lagrede plass.
    const m = code ? (activeMembership ?? getMembership(code)) : null;
    // (Nye deltakere uten token sendes kun én gang fra joinRoom – ellers kunne de blitt lagt til to ganger.)
    if (code && m && reconnecting) void emitAck<JoinAckData>('room:join', { code, as: m.as, token: m.token, view: m.view });
    reconnecting = true;
  });
  socket.on('disconnect', () => useRoom.setState({ status: 'reconnecting' }));
  socket.io.on('reconnect_failed', () => useRoom.setState({ status: 'offline' }));
  socket.on('connect_error', () => useRoom.setState((s) => ({ status: s.status === 'online' ? 'reconnecting' : s.status === 'idle' ? 'connecting' : s.status })));
  socket.on('state', (st: PublicState) => {
    const now = Date.now();
    const s = useRoom.getState();
    // Første tilstand: ikke spill av gamle effekter på nytt.
    const fresh = lastFxId < 0 ? [] : st.fx.filter((f) => f.id > lastFxId);
    lastFxId = Math.max(lastFxId, ...st.fx.map((f) => f.id), 0);
    const roughOffset = st.serverNow - now;
    const offset = s.rtt > 0 ? s.offset : roughOffset;
    useRoom.setState({ state: st, offset, fxBatch: fresh.length ? { seq: s.fxBatch.seq + 1, events: fresh } : s.fxBatch });
  });
  socket.on('kicked', () => {
    const code = useRoom.getState().code;
    if (code) forgetMembership(code);
    useRoom.setState({ kicked: true, state: null });
  });
  // Spar batteri: ingen grunn til å holde lyd/3D i gang i bakgrunnen, men socketen beholdes.
  return socket;
}

async function syncClock(): Promise<void> {
  const samples: { offset: number; rtt: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const t0 = Date.now();
    const r = await emitAck<{ serverNow: number }>('time:sync', {}, 2000);
    const t1 = Date.now();
    if (r.ok && r.data) samples.push({ rtt: t1 - t0, offset: r.data.serverNow - (t0 + t1) / 2 });
  }
  if (!samples.length) return;
  samples.sort((a, b) => a.rtt - b.rtt);
  useRoom.setState({ offset: samples[0].offset, rtt: samples[0].rtt });
}

export function emitAck<T = unknown>(event: string, payload: unknown = {}, timeoutMs = 6000): Promise<Ack<T>> {
  const s = ensureSocket();
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve({ ok: false, error: 'Ingen kontakt med serveren' });
      }
    }, timeoutMs);
    s.emit(event, payload, (r: Ack<T>) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(r);
    });
  });
}

function onJoined(r: Ack<JoinAckData>, as: 'player' | 'screen', view?: ViewMode): Ack<JoinAckData> {
  if (r.ok && r.data) {
    activeMembership = { token: r.data.token, memberId: r.data.memberId, as, view };
    saveMembership(r.data.code, activeMembership);
    useRoom.setState({ code: r.data.code, kicked: false, error: null, ...(view ? { view } : {}) });
  }
  return r;
}

export function resetRoom(): void {
  lastFxId = -1;
  activeMembership = null;
  useRoom.setState({ state: null, code: null, error: null, kicked: false, fxBatch: { seq: 0, events: [] } });
}

export async function createRoom(settings: GameSettings, as: 'player' | 'screen', name?: string, characterId?: string, view?: ViewMode, opponents?: number) {
  ensureSocket();
  resetRoom();
  useRoom.setState({ status: socket!.connected ? 'online' : 'connecting' });
  const r = await emitAck<JoinAckData>('room:create', { settings, as, name, characterId, opponents }, 12000);
  return onJoined(r, as, view);
}

/** Kobler til et rom: med lagret token (gjenoppretting) eller som ny deltaker. */
export async function joinRoom(code: string, opts: { as: 'player' | 'screen'; name?: string; characterId?: string; view?: ViewMode }) {
  ensureSocket();
  if (useRoom.getState().code !== code) resetRoom();
  useRoom.setState({ code });
  const m = getMembership(code);
  const payload = m ? { code, as: m.as, token: m.token, view: m.view ?? opts.view } : { code, ...opts };
  const r = await emitAck<JoinAckData>('room:join', payload);
  if (!r.ok && m) forgetMembership(code);
  return onJoined(r, m?.as ?? opts.as, m?.view ?? opts.view);
}

export function leaveRoom(): void {
  const code = useRoom.getState().code;
  void emitAck('room:leave');
  if (code) forgetMembership(code);
  resetRoom();
}

export const updatePlayer = (p: PlayerUpdateInput) => emitAck('player:update', p);

export function setView(view: ViewMode): void {
  const code = useRoom.getState().code;
  useRoom.setState({ view });
  if (code) {
    const m = activeMembership ?? getMembership(code);
    if (m) {
      activeMembership = { ...m, view };
      saveMembership(code, activeMembership);
    }
  }
  void updatePlayer({ view });
}

export function sendAnswer(choice: number) {
  const q = useRoom.getState().state?.question;
  if (!q) return Promise.resolve({ ok: false, error: 'Ingen spørsmål' } as Ack);
  const payload = { actionId: actionId(), questionId: q.id, choice };
  return retrying('game:answer', payload);
}
export function sendBuzz() {
  const q = useRoom.getState().state?.question;
  if (!q) return Promise.resolve({ ok: false } as Ack);
  return retrying('game:buzz', { actionId: actionId(), questionId: q.id });
}
export function sendTarget(targetId: string) {
  return retrying('game:target', { actionId: actionId(), targetId });
}

/** Sender på nytt med samme actionId ved tidsavbrudd – serveren ignorerer duplikater. */
async function retrying(event: string, payload: unknown): Promise<Ack<unknown>> {
  let r = await emitAck(event, payload, 2500);
  if (!r.ok && r.error === 'Ingen kontakt med serveren') r = await emitAck(event, payload, 3500);
  return r;
}

export const host = {
  start: () => emitAck('host:start'),
  pause: (paused: boolean) => emitAck('host:pause', { paused }),
  advance: () => emitAck('host:advance'),
  kick: (playerId: string) => emitAck('host:kick', { playerId }),
  addBot: () => emitAck('host:addBot'),
  rematch: () => emitAck('host:rematch'),
};
