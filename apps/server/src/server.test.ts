import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GameSettings } from '@podiepanikk/shared';
import { startServer, type RunningServer } from './app';
import { loadConfig } from './config';
import { ExternalQuestionSource, normalizeOtdb } from './questions/external';
import { BUILTIN_QUESTIONS } from './questions/bank';
import { runSimulation, SimClient, waitFor } from './sim/harness';
import { MemoryStore } from './store';

let server: RunningServer;
const failingFetch = async () => {
  throw new Error('offline');
};

beforeAll(async () => {
  server = await startServer(
    { ...loadConfig({ NODE_ENV: 'test' }), port: 0, host: '127.0.0.1', allowTimeScale: true, allowBots: true, dataFile: undefined, adminUsername: 'admin', adminPassword: 'super-hemmelig-123' },
    { store: new MemoryStore(), external: new ExternalQuestionSource(failingFetch as never) },
  );
});
afterAll(async () => {
  await server?.close();
});

const settings = (extra: Partial<GameSettings> = {}): GameSettings => ({
  displayMode: 'mixed',
  difficulty: 'familie',
  length: 'kort',
  maxPlayers: 12,
  categories: [],
  useExternal: false,
  timeScale: 0.05,
  ...extra,
});

describe('spørsmålsbank', () => {
  it('har gyldige, unike spørsmål på alle nivåer', () => {
    const ids = new Set(BUILTIN_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(BUILTIN_QUESTIONS.length);
    for (const d of ['barn', 'familie', 'voksen']) expect(BUILTIN_QUESTIONS.filter((q) => q.difficulty === d).length).toBeGreaterThanOrEqual(90);
    for (const q of BUILTIN_QUESTIONS) {
      expect(new Set(q.options.map((o) => o.toLowerCase())).size).toBe(4);
      expect(q.text.length).toBeGreaterThan(5);
    }
  });

  it('ekstern adapter forkaster ugyldige spørsmål og gjetter aldri fasit', async () => {
    expect(normalizeOtdb({ type: 'multiple', difficulty: 'easy', category: 'Animals', question: 'What%3F', correct_answer: 'A', incorrect_answers: ['A', 'B', 'C'] })).toBeNull();
    const ok = normalizeOtdb({ type: 'multiple', difficulty: 'hard', category: 'Science%3A%20Computers', question: 'Which%20is%20a%20CPU%3F', correct_answer: 'Ryzen', incorrect_answers: ['Banana', 'Cloud', 'Table'] });
    expect(ok?.options[ok.correctIndex]).toBe('Ryzen');
    expect(ok?.category).toBe('teknologi');
    expect(ok?.language).toBe('en');
    const src = new ExternalQuestionSource(failingFetch as never);
    expect(await src.fetch('familie')).toEqual([]);
  });
});

describe('rom og lobby over Socket.IO', () => {
  it('oppretter rom, gir romkode og nekter ugyldig kode', async () => {
    const tv = new SimClient(server.url, { label: 'TV', latencyMs: [0, 1], view: 'full' });
    tv.auto = false;
    const code = await tv.create(settings());
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    const p = new SimClient(server.url, { label: 'P', latencyMs: [0, 1], view: 'full' });
    const bad = await p.join('ZZZZZ', 'Ola');
    expect(bad.ok).toBe(false);
    tv.close();
    p.close();
  });

  it('kun verten kan starte, og minst to må være klare', async () => {
    const tv = new SimClient(server.url, { label: 'TV', latencyMs: [0, 1], view: 'full' });
    tv.auto = false;
    const code = await tv.create(settings());
    const a = new SimClient(server.url, { label: 'A', latencyMs: [0, 1], view: 'controller' });
    const b = new SimClient(server.url, { label: 'B', latencyMs: [0, 1], view: 'full' });
    a.auto = b.auto = false;
    await a.join(code, 'Anna');
    await b.join(code, 'Bjørn');
    expect((await tv.emit('host:start')).ok).toBe(false);
    await a.emit('player:update', { ready: true });
    await b.emit('player:update', { ready: true });
    expect((await a.emit('host:start')).ok).toBe(false); // ikke vert
    expect((await tv.emit('host:start')).ok).toBe(true);
    await waitFor(() => a.state?.phase === 'INTRO' && b.state?.phase === 'INTRO', 2000);
    // Storskjermen teller ikke som spiller.
    expect(tv.state!.players).toHaveLength(2);
    expect(tv.state!.you.isScreen).toBe(true);
    for (const c of [tv, a, b]) c.close();
  });

  it('verten kan fjerne spillere i lobbyen og legge til testspillere', async () => {
    const tv = new SimClient(server.url, { label: 'TV', latencyMs: [0, 1], view: 'full' });
    tv.auto = false;
    const code = await tv.create(settings());
    const a = new SimClient(server.url, { label: 'A', latencyMs: [0, 1], view: 'full' });
    a.auto = false;
    await a.join(code, 'Kari');
    expect((await tv.emit('host:addBot')).ok).toBe(true);
    await waitFor(() => tv.state?.players.length === 2, 2000);
    expect((await tv.emit('host:kick', { playerId: a.playerId })).ok).toBe(true);
    await waitFor(() => tv.state?.players.length === 1, 2000);
    for (const c of [tv, a]) c.close();
  });

  it('gjenoppretter riktig status etter oppdatering av nettleseren (token)', async () => {
    const tv = new SimClient(server.url, { label: 'TV', latencyMs: [0, 1], view: 'full' });
    tv.auto = false;
    const code = await tv.create(settings());
    const a = new SimClient(server.url, { label: 'A', latencyMs: [0, 1], view: 'full' });
    a.auto = false;
    await a.join(code, 'Per');
    const pid = a.playerId;
    const r = await a.reconnect(code);
    expect(r.ok).toBe(true);
    expect(r.data!.playerId).toBe(pid);
    await waitFor(() => a.state?.you.playerId === pid, 2000);
    // Falsk token gir ingen tilgang til andres plass.
    const thief = new SimClient(server.url, { label: 'T', latencyMs: [0, 1], view: 'full' });
    await thief.connected();
    const steal = await thief.emit('room:join', { code, as: 'player', token: 'x'.repeat(43) });
    expect(steal.ok).toBe(false); // ingen navn → kan ikke bli ny spiller heller
    for (const c of [tv, a, thief]) c.close();
  });

  it('avviser ugyldige data og skjuler fasit fra klientene', async () => {
    const tv = new SimClient(server.url, { label: 'TV', latencyMs: [0, 1], view: 'full' });
    tv.auto = false;
    const code = await tv.create(settings({ timeScale: 0.2 }));
    const a = new SimClient(server.url, { label: 'A', latencyMs: [0, 1], view: 'full' });
    const b = new SimClient(server.url, { label: 'B', latencyMs: [0, 1], view: 'full' });
    a.auto = b.auto = false;
    await a.join(code, 'Liv');
    await b.join(code, 'Mons');
    expect((await a.emit('game:answer', { actionId: 'x', questionId: 1, choice: 9 })).ok).toBe(false);
    expect((await a.emit('player:update', { name: '<script>alert(1)</script>'.repeat(3) })).ok).toBe(false);
    await a.emit('player:update', { ready: true });
    await b.emit('player:update', { ready: true });
    await tv.emit('host:start');
    await waitFor(() => a.state?.phase === 'QUESTION', 10_000);
    expect(a.state!.reveal).toBeNull();
    expect(JSON.stringify(a.state)).not.toContain('correctIndex');
    for (const c of [tv, a, b]) c.close();
  });
});

describe('HTTP-API og sikkerhet', () => {
  const post = (path: string, body: unknown, cookie?: string) =>
    fetch(server.url + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

  it('registrering, innlogging og profil – uten adminrettigheter fra klienten', async () => {
    const r = await post('/api/auth/register', { username: 'quizulf', password: 'hemmelig123', displayName: 'Quiz-Ulf', role: 'admin' });
    expect(r.status).toBe(201);
    const cookie = r.headers.get('set-cookie')!.split(';')[0];
    expect(r.headers.get('set-cookie')).toContain('HttpOnly');
    const me: any = await (await fetch(server.url + '/api/auth/me', { headers: { cookie } })).json();
    expect(me.user.role).toBe('player');
    expect(me.user.showOnLeaderboard).toBe(false);
    const adm = await fetch(server.url + '/api/admin/questions', { headers: { cookie } });
    expect(adm.status).toBe(403);
    const bad = await post('/api/auth/login', { username: 'quizulf', password: 'feil-passord' });
    expect(bad.status).toBe(401);
    const del = await fetch(server.url + '/api/profile', { method: 'DELETE', headers: { cookie } });
    expect(del.status).toBe(200);
    expect((await post('/api/auth/login', { username: 'quizulf', password: 'hemmelig123' })).status).toBe(401);
  });

  it('administrator kan opprette, importere og slette spørsmål', async () => {
    const login = await post('/api/auth/login', { username: 'admin', password: 'super-hemmelig-123' });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const created = await post('/api/admin/questions', { text: 'Hva heter testen?', options: ['Vitest', 'Jest', 'Mocha', 'Ava'], correctIndex: 0, category: 'teknologi', difficulty: 'voksen' }, cookie);
    expect(created.status).toBe(201);
    const { question }: any = await created.json();
    const imp = await post('/api/admin/questions/import', { format: 'csv', data: 'Spørsmål?,a,b,c,d,B,sport,barn\nfeil,1,1,1,1,A,sport,barn' }, cookie);
    const impBody: any = await imp.json();
    expect(impBody.imported).toBe(1);
    expect(impBody.errors).toHaveLength(1);
    const list: any = await (await fetch(server.url + '/api/admin/questions', { headers: { cookie } })).json();
    expect(list.questions.length).toBe(2);
    const del = await fetch(server.url + `/api/admin/questions/${question.id}`, { method: 'DELETE', headers: { cookie } });
    expect(del.status).toBe(200);
  });

  it('avviser kryss-opprinnelse og sender sikkerhetshoder', async () => {
    const r = await fetch(server.url + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://ond.example' }, body: '{}' });
    expect(r.status).toBe(403);
    const h = await fetch(server.url + '/api/health');
    expect(h.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(h.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('enspillermodus', () => {
  it('starter straks med navngitte motstandere, stenger for andre og kan spilles til ende', async () => {
    const me = new SimClient(server.url, { label: 'Solo', latencyMs: [0, 1], view: 'full' });
    await me.connected();
    const r = await me.emit<{ code: string; playerId: string }>('room:create', {
      settings: settings({ solo: true, botLevel: 'vanskelig', displayMode: 'screen', maxPlayers: 12 }),
      as: 'player',
      name: 'Ensom Ulv',
      characterId: 'krutt',
      opponents: 4,
    });
    expect(r.ok).toBe(true);
    await waitFor(() => !!me.state && me.state.phase !== 'LOBBY', 3000);
    const st = me.state!;
    expect(st.settings.solo).toBe(true);
    expect(st.settings.displayMode).toBe('mobile');
    expect(st.players).toHaveLength(5);
    expect(st.players.filter((p) => p.isBot)).toHaveLength(4);
    expect(st.players.find((p) => p.isBot)!.name).not.toContain('bot'); // motstanderne heter som karakterene
    expect(new Set(st.players.map((p) => p.characterId)).size).toBe(5);
    // Ingen andre kan bli med i et solospill.
    const intruder = new SimClient(server.url, { label: 'X', latencyMs: [0, 1], view: 'full' });
    expect((await intruder.join(r.data!.code, 'Inntrenger')).ok).toBe(false);
    intruder.close();
    // Solospill krever en spiller – ikke en storskjerm.
    const tv = new SimClient(server.url, { label: 'TV', latencyMs: [0, 1], view: 'full' });
    await tv.connected();
    expect((await tv.emit('room:create', { settings: settings({ solo: true }), as: 'screen' })).ok).toBe(false);
    tv.close();
    // Spill ferdig (klienten svarer automatisk) og ta omkamp – den starter av seg selv.
    await waitFor(() => me.state?.phase === 'GAME_OVER', 60_000);
    expect(me.state!.winnerId).not.toBeNull();
    expect((await me.emit('host:rematch')).ok).toBe(true);
    await waitFor(() => me.state?.phase === 'INTRO' || me.state?.phase === 'ROUND_INTRO', 3000);
    me.close();
  }, 70_000);
});

describe('fullt spill med 12 spillere og blandede klienttyper', () => {
  it('4 kontrollere + 4 full mobil + 4 fjernspillere: lik spillstatus hos alle fra start til slutt', async () => {
    const report = await runSimulation({ url: server.url, timeScale: 0.05, length: 'kort', timeoutMs: 110_000 });
    expect(report.consistencyErrors).toEqual([]);
    expect(report.winnerId).not.toBeNull();
    expect(report.reconnectOk).toBe(true);
    expect(report.viewSwitchOk).toBe(true);
    expect(report.players).toHaveLength(12);
    // Resultatet lagres (gjester uten navn).
    await new Promise((r) => setTimeout(r, 100));
  }, 120_000);
});
