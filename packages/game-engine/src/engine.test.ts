import { describe, expect, it } from 'vitest';
import { COMMENTARY_ADULT, LENGTH_CONFIG, ROUND_ORDER, Rng, SCORING, settingsSchema, type GameSettings, type Phase, type Question, type RoundType } from '@podiepanikk/shared';
import { GameEngine } from './engine';
import { buildQuestionPool } from './pool';
import { importQuestionsCsv, importQuestionsJson, parseCsv } from './csv';
import { Commentator } from './commentator';

const SETTINGS: GameSettings = { displayMode: 'mixed', difficulty: 'familie', length: 'normal', maxPlayers: 12, categories: [], useExternal: false };

function makePool(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    text: `Spørsmål ${i}`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    category: 'generelt',
    difficulty: 'familie',
    language: 'nb',
  }));
}

let actionSeq = 0;
const aid = () => `act_${++actionSeq}`;

function lobby(n: number, settings: Partial<GameSettings> = {}, poolSize = 200) {
  const e = new GameEngine({ code: 'TEST1', settings: { ...SETTINGS, ...settings }, seed: 42, pool: makePool(poolSize), hostId: 'p1' });
  for (let i = 1; i <= n; i++) {
    expect(e.addPlayer({ id: `p${i}`, name: `Spiller ${i}`, characterId: 'krutt' }).ok).toBe(true);
    e.updatePlayer(`p${i}`, { ready: true });
  }
  return e;
}

/** Starter et spill med gitte runder og spoler frem til første spørsmål. */
function started(n: number, rounds: RoundType[], settings: Partial<GameSettings> = {}) {
  const e = lobby(n, settings);
  let now = 1000;
  expect(e.start('p1', now).ok).toBe(true);
  e.rounds = rounds;
  now = runUntil(e, now, 'QUESTION');
  return { e, now };
}

/** Kaller tick ved hver frist til ønsket fase nås. Returnerer ny tid. */
function runUntil(e: GameEngine, now: number, phase: Phase, max = 200): number {
  let i = 0;
  while (e.phase !== phase && i++ < max) {
    const wake = e.nextWakeAt();
    if (wake == null) throw new Error(`Står fast i ${e.phase}`);
    now = Math.max(now, wake);
    e.tick(now);
  }
  if (e.phase !== phase) throw new Error(`Nådde ikke ${phase}, er i ${e.phase}`);
  return now;
}

const viewer = (pid: string | null) => ({ memberId: pid ?? 'screen', playerId: pid, isHost: false, isScreen: pid == null });
const qid = (e: GameEngine) => e.snapshot(viewer('p1'), 0).question!.id;

describe('lobby og rom', () => {
  it('tillater maks 12 spillere', () => {
    const e = lobby(12);
    expect(e.players).toHaveLength(12);
    const r = e.addPlayer({ id: 'p13', name: 'Tretten', characterId: 'turbo' });
    expect(r.ok).toBe(false);
  });

  it('respekterer vertens valgte maksantall', () => {
    const e = lobby(3, { maxPlayers: 3 });
    expect(e.addPlayer({ id: 'x', name: 'X', characterId: 'turbo' }).ok).toBe(false);
  });

  it('gir fargevarianter når flere velger samme karakter', () => {
    const e = lobby(3);
    expect(e.players.map((p) => p.variant)).toEqual([0, 1, 2]);
    e.updatePlayer('p2', { characterId: 'robo' });
    expect(e.players.map((p) => p.variant)).toEqual([0, 0, 1]);
  });

  it('krever at verten starter og at minst to er klare', () => {
    const e = new GameEngine({ code: 'X', settings: SETTINGS, seed: 1, pool: makePool(50), hostId: 'p1' });
    e.addPlayer({ id: 'p1', name: 'En', characterId: 'krutt' });
    e.addPlayer({ id: 'p2', name: 'To', characterId: 'turbo' });
    expect(e.start('p1', 0).ok).toBe(false);
    e.updatePlayer('p1', { ready: true });
    e.updatePlayer('p2', { ready: true });
    expect(e.start('p2', 0).ok).toBe(false);
    expect(e.start('p1', 0).ok).toBe(true);
    expect(e.phase).toBe('INTRO');
  });

  it('kun verten kan fjerne spillere, og bare før start', () => {
    const e = lobby(3);
    expect(e.kick('p2', 'p3', 0).ok).toBe(false);
    expect(e.kick('p1', 'p3', 0).ok).toBe(true);
    expect(e.players).toHaveLength(2);
    e.start('p1', 0);
    expect(e.kick('p1', 'p2', 0).ok).toBe(false);
  });

  it('nekter nye spillere etter start', () => {
    const e = lobby(2);
    e.start('p1', 0);
    expect(e.addPlayer({ id: 'sen', name: 'Sen', characterId: 'krutt' }).ok).toBe(false);
  });
});

describe('rundevalg', () => {
  it.each(['kort', 'normal', 'lang'] as const)('%s: riktig antall, ingen duplikater, finale sist', (length) => {
    for (let seed = 1; seed < 30; seed++) {
      const e = new GameEngine({ code: 'X', settings: { ...SETTINGS, length }, seed, pool: makePool(10), hostId: 'p1' });
      e.addPlayer({ id: 'p1', name: 'A', characterId: 'krutt' });
      e.addPlayer({ id: 'p2', name: 'B', characterId: 'krutt' });
      e.updatePlayer('p1', { ready: true });
      e.updatePlayer('p2', { ready: true });
      e.start('p1', 0);
      const cfg = LENGTH_CONFIG[length];
      expect(e.rounds.length).toBeGreaterThanOrEqual(cfg.minRounds);
      expect(e.rounds.length).toBeLessThanOrEqual(cfg.maxRounds);
      expect(new Set(e.rounds).size).toBe(e.rounds.length);
      expect(e.rounds[e.rounds.length - 1]).toBe('final');
      const idx = e.rounds.map((r) => ROUND_ORDER.indexOf(r));
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    }
  });
});

describe('Poengsamleren', () => {
  it('synkroniserer samme spørsmål til alle og skjuler fasit', () => {
    const { e } = started(3, ['collector', 'final']);
    const a = e.snapshot(viewer('p1'), 0);
    const b = e.snapshot(viewer('p2'), 0);
    const tv = e.snapshot(viewer(null), 0);
    expect(a.question!.id).toBe(b.question!.id);
    expect(tv.question!.id).toBe(a.question!.id);
    expect(a.reveal).toBeNull();
    expect(JSON.stringify(a)).not.toContain('correctIndex');
  });

  it('gir basispoeng + fartsbonus, og raskere gir mer', () => {
    const { e, now } = started(3, ['collector', 'final']);
    const q = qid(e);
    e.answer('p1', q, 0, aid(), now + 1000);
    e.answer('p2', q, 0, aid(), now + 8000);
    e.answer('p3', q, 1, aid(), now + 2000);
    expect(e.phase).toBe('REVEAL'); // alle svarte → lukkes tidlig
    const [p1, p2, p3] = e.players;
    expect(p1.score).toBeGreaterThan(p2.score);
    expect(p2.score).toBeGreaterThanOrEqual(SCORING.collectorBase);
    expect(p1.score).toBeLessThanOrEqual(SCORING.collectorBase + SCORING.collectorSpeedMax);
    expect(p3.score).toBe(0);
  });

  it('teller ikke samme svar to ganger (idempotent) og godtar ikke nytt svar', () => {
    const { e, now } = started(3, ['collector', 'final']);
    const q = qid(e);
    const id = aid();
    expect(e.answer('p1', q, 0, id, now + 100).ok).toBe(true);
    const dup = e.answer('p1', q, 0, id, now + 100);
    expect(dup.ok && dup.duplicate).toBe(true);
    expect(e.answer('p1', q, 1, aid(), now + 200).ok).toBe(false);
    expect(e.players[0].answered).toBe(1);
  });

  it('avviser svar etter fristen og på feil spørsmål', () => {
    const { e, now } = started(2, ['collector', 'final']);
    const q = qid(e);
    expect(e.answer('p1', 'feil-id', 0, aid(), now).ok).toBe(false);
    expect(e.answer('p1', q, 0, aid(), now + 60_000).ok).toBe(false);
  });

  it('lukker spørsmålet ved frist selv om noen ikke svarer', () => {
    const { e, now } = started(2, ['collector', 'final']);
    e.answer('p1', qid(e), 0, aid(), now + 100);
    expect(e.phase).toBe('QUESTION');
    e.tick(e.nextWakeAt()!);
    expect(e.phase).toBe('REVEAL');
    const snap = e.snapshot(viewer('p2'), 0);
    expect(snap.reveal!.results.find((r) => r.playerId === 'p2')!.choice).toBeNull();
  });
});

describe('Raskest på knappen', () => {
  it('første buzz vinner, de andre avvises', () => {
    const { e, now } = started(3, ['fastest', 'final']);
    const q = qid(e);
    expect(e.buzzIn('p2', q, aid(), now + 500).ok).toBe(true);
    const late = e.buzzIn('p1', q, aid(), now + 500); // samme millisekund – kommer etter
    expect(late.ok).toBe(false);
    expect(e.phase).toBe('BUZZ_ANSWER');
    expect(e.snapshot(viewer('p2'), 0).you.canAnswer).toBe(true);
    expect(e.snapshot(viewer('p1'), 0).you.canAnswer).toBe(false);
    expect(e.answer('p1', q, 0, aid(), now + 600).ok).toBe(false);
  });

  it('riktig gir poeng, feil gir straff og åpner for de andre', () => {
    const { e, now } = started(3, ['fastest', 'final']);
    const q = qid(e);
    e.buzzIn('p2', q, aid(), now + 100);
    e.answer('p2', q, 2, aid(), now + 200);
    expect(e.players[1].score).toBe(0); // straff klemmes mot 0
    expect(e.phase).toBe('QUESTION');
    expect(e.buzzIn('p2', q, aid(), now + 300).ok).toBe(false); // utestengt
    expect(e.buzzIn('p3', q, aid(), now + 400).ok).toBe(true);
    e.answer('p3', q, 0, aid(), now + 500);
    expect(e.phase).toBe('REVEAL');
    expect(e.players[2].score).toBe(SCORING.fastestCorrect);
  });

  it('straffen trekkes fra når spilleren har poeng', () => {
    const { e, now } = started(2, ['fastest', 'final']);
    e.players[0].score = 1000;
    const q = qid(e);
    e.buzzIn('p1', q, aid(), now + 100);
    e.tick(e.nextWakeAt()!); // svarer ikke innen fristen
    expect(e.players[0].score).toBe(1000 - SCORING.fastestWrong);
  });

  it('ingen buzz → avsløring etter fristen', () => {
    const { e } = started(2, ['fastest', 'final']);
    e.tick(e.nextWakeAt()!);
    expect(e.phase).toBe('REVEAL');
  });
});

describe('Poengtyven', () => {
  it('riktige svar får stjele, og ingen mister mer enn de har', () => {
    const { e, now } = started(3, ['thief', 'final']);
    e.players[1].score = 120;
    const q = qid(e);
    e.answer('p1', q, 0, aid(), now + 100);
    e.answer('p2', q, 1, aid(), now + 100);
    e.answer('p3', q, 0, aid(), now + 200);
    let t = runUntil(e, now + 300, 'TARGETING');
    const snap = e.snapshot(viewer('p1'), t);
    expect(snap.you.canTarget).toBe(true);
    expect(snap.you.targetOptions).not.toContain('p1');
    expect(e.chooseTarget('p1', 'p1', aid(), t).ok).toBe(false);
    expect(e.chooseTarget('p2', 'p1', aid(), t).ok).toBe(false); // svarte feil
    e.chooseTarget('p1', 'p2', aid(), t);
    e.chooseTarget('p3', 'p2', aid(), t);
    expect(e.phase).toBe('ACTION_RESULT');
    // p1 stjal alt p2 hadde (120), p3 fikk 0 fordi p2 var tom
    expect(e.players[1].score).toBe(0);
    expect(e.players[0].score).toBe(SCORING.thiefCorrect + 120);
    expect(e.players[2].score).toBe(SCORING.thiefCorrect);
  });
});

describe('Kakekrigen', () => {
  it('treff gir straff til mål og bonus til kaster', () => {
    const { e, now } = started(2, ['pie', 'final']);
    e.players[1].score = 1000;
    const q = qid(e);
    e.answer('p1', q, 0, aid(), now + 100);
    e.answer('p2', q, 3, aid(), now + 100);
    const t = runUntil(e, now + 200, 'TARGETING');
    e.chooseTarget('p1', 'p2', aid(), t);
    expect(e.players[1].score).toBe(1000 - SCORING.pieHit);
    expect(e.players[0].score).toBe(SCORING.pieCorrect + SCORING.pieThrowerBonus);
    const snap = e.snapshot(viewer(null), t);
    expect(snap.actions[0]).toMatchObject({ kind: 'pie', fromId: 'p1', toId: 'p2' });
  });
});

describe('Tikkende bombe', () => {
  it('riktig svar sender bomben videre, feil beholder den', () => {
    const { e, now } = started(3, ['bomb', 'final']);
    const holder = e.snapshot(viewer(null), now).bomb!.holderId;
    const other = e.players.find((p) => p.id !== holder)!.id;
    expect(e.answer(other, qid(e), 0, aid(), now + 10).ok).toBe(false); // bare holderen kan svare
    e.answer(holder, qid(e), 1, aid(), now + 100);
    expect(e.phase).toBe('REVEAL');
    let t = runUntil(e, now + 100, 'QUESTION');
    expect(e.snapshot(viewer(null), t).bomb!.holderId).toBe(holder);
    e.answer(holder, qid(e), 0, aid(), t + 100);
    t = runUntil(e, t + 100, 'TARGETING');
    e.chooseTarget(holder, other, aid(), t);
    expect(e.snapshot(viewer(null), t).bomb!.holderId).toBe(other);
  });

  it('eksploderer hos holderen når lunta er brent ut', () => {
    const { e, now } = started(2, ['bomb', 'final']);
    const holder = e.snapshot(viewer(null), now).bomb!.holderId;
    e.getPlayer(holder)!.score = 2000;
    let t = now;
    // ingen svarer → bomben blir værende til den smeller
    for (let i = 0; i < 40 && e.phase !== 'ACTION_RESULT'; i++) {
      t = e.nextWakeAt()!;
      e.tick(t);
    }
    expect(e.phase).toBe('ACTION_RESULT');
    expect(e.getPlayer(holder)!.score).toBe(2000 - SCORING.bombExplode);
    expect(e.snapshot(viewer(null), t).bomb!.exploded).toBe(true);
  });

  it('frakoblet holder får bomben flyttet til en tilkoblet spiller', () => {
    const { e, now } = started(3, ['bomb', 'final']);
    const holder = e.snapshot(viewer(null), now).bomb!.holderId;
    e.answer(holder, qid(e), 1, aid(), now + 100);
    e.setConnected(holder, false, now + 200);
    const t = runUntil(e, now + 200, 'QUESTION');
    expect(e.snapshot(viewer(null), t).bomb!.holderId).not.toBe(holder);
  });
});

describe('Finalen', () => {
  it('gir forsprang etter poeng og kårer den som når målet', () => {
    const e = lobby(3);
    e.start('p1', 0);
    e.rounds = ['final'];
    e.players[0].score = 3000;
    e.players[1].score = 1500;
    let t = runUntil(e, 0, 'QUESTION');
    expect(e.players.map((p) => p.finalSteps)).toEqual([3, 2, 0]);
    for (let i = 0; i < 30 && e.phase !== 'CEREMONY'; i++) {
      if (e.phase === 'QUESTION') {
        const q = qid(e);
        e.answer('p1', q, 1, aid(), t + 50); // feil
        e.answer('p2', q, 0, aid(), t + 100); // riktig og raskest
        e.answer('p3', q, 0, aid(), t + 200);
      }
      t = e.nextWakeAt()!;
      e.tick(t);
    }
    expect(e.phase).toBe('CEREMONY');
    expect(e.winnerId).toBe('p2');
    const snap = e.snapshot(viewer(null), t);
    expect(snap.ranking[0]).toBe('p2');
    expect(snap.stats).not.toBeNull();
  });

  it('uavgjort gir sudden death der raskeste riktige vinner', () => {
    const e = lobby(3, { length: 'kort' });
    e.start('p1', 0);
    e.rounds = ['final'];
    let t = runUntil(e, 0, 'QUESTION');
    // Ingen svarer – alle står likt helt til maks antall spørsmål
    for (let i = 0; i < 100 && !e.snapshot(viewer(null), t).final?.tiebreak; i++) {
      t = e.nextWakeAt()!;
      e.tick(t);
    }
    expect(e.snapshot(viewer(null), t).final!.tiebreak).toEqual(['p1', 'p2', 'p3']);
    t = runUntil(e, t, 'QUESTION');
    const q = qid(e);
    e.answer('p3', q, 0, aid(), t + 300);
    e.answer('p1', q, 0, aid(), t + 600);
    e.answer('p2', q, 2, aid(), t + 100);
    t = runUntil(e, t + 600, 'CEREMONY');
    expect(e.winnerId).toBe('p3');
  });
});

describe('frakobling, gjenoppretting og visningsmodus', () => {
  it('en frakoblet spiller stopper ikke spørsmålet', () => {
    const { e, now } = started(3, ['collector', 'final']);
    e.setConnected('p3', false, now);
    const q = qid(e);
    e.answer('p1', q, 0, aid(), now + 10);
    e.answer('p2', q, 0, aid(), now + 20);
    expect(e.phase).toBe('REVEAL');
  });

  it('spiller som kommer tilbake beholder poeng og karakter', () => {
    const { e, now } = started(2, ['collector', 'final']);
    e.answer('p2', qid(e), 0, aid(), now + 10);
    e.answer('p1', qid(e), 0, aid(), now + 10);
    const before = { ...e.getPlayer('p2')! };
    e.setConnected('p2', false, now + 20);
    e.setConnected('p2', true, now + 30);
    const after = e.getPlayer('p2')!;
    expect(after.score).toBe(before.score);
    expect(after.characterId).toBe(before.characterId);
    expect(after.connected).toBe(true);
  });

  it('bytte mellom kontroller og full visning påvirker ikke spillstatus', () => {
    const { e, now } = started(2, ['collector', 'final']);
    const before = JSON.stringify({ ...e.snapshot(viewer(null), now), players: null });
    expect(e.updatePlayer('p1', { view: 'full' }).ok).toBe(true);
    expect(e.updatePlayer('p1', { view: 'controller' }).ok).toBe(true);
    const after = JSON.stringify({ ...e.snapshot(viewer(null), now), players: null });
    expect(after).toBe(before);
    expect(e.updatePlayer('p1', { name: 'Ny' }).ok).toBe(false);
  });

  it('pause under spørsmål venter til neste trygge overgang og fryser tiden', () => {
    const { e, now } = started(2, ['collector', 'final']);
    e.setPaused('p1', true, now);
    expect(e.paused).toBe(false);
    expect(e.pausePending).toBe(true);
    e.answer('p1', qid(e), 0, aid(), now + 10);
    e.answer('p2', qid(e), 0, aid(), now + 10);
    expect(e.phase).toBe('REVEAL');
    expect(e.paused).toBe(true);
    expect(e.nextWakeAt()).toBeNull();
    expect(e.tick(now + 999_999)).toBe(false);
    e.setPaused('p1', false, now + 50_000);
    expect(e.nextWakeAt()).toBeGreaterThan(now + 50_000);
  });
});

describe('fullt spill', () => {
  it.each(['kort', 'normal', 'lang'] as const)('%s spill med 12 tilfeldige spillere går fra start til slutt', (length) => {
    const e = new GameEngine({ code: 'SIM', settings: { ...SETTINGS, length }, seed: 7, pool: makePool(400), hostId: 'p1' });
    const rng = new Rng(99);
    for (let i = 1; i <= 12; i++) {
      e.addPlayer({ id: `p${i}`, name: `S${i}`, characterId: 'krutt' });
      e.updatePlayer(`p${i}`, { ready: true });
    }
    let t = 0;
    e.start('p1', t);
    const seenQuestions = new Set<string>();
    const seenRounds: string[] = [];
    let lastQ = '';
    for (let step = 0; step < 5000 && e.phase !== 'GAME_OVER'; step++) {
      const s = e.snapshot(viewer(null), t);
      if (s.round && seenRounds[seenRounds.length - 1] !== s.round.type) seenRounds.push(s.round.type);
      if (s.question && s.question.id !== lastQ && e.phase === 'QUESTION') {
        expect(seenQuestions.has(s.question.id)).toBe(false);
        seenQuestions.add(s.question.id);
        lastQ = s.question.id;
      }
      for (const p of e.players) {
        const me = e.snapshot(viewer(p.id), t).you;
        if (me.canBuzz && rng.next() < 0.3) e.buzzIn(p.id, s.question!.id, aid(), t + 1);
        if (me.canAnswer && rng.next() < 0.8) e.answer(p.id, s.question!.id, rng.int(4) < 2 ? 0 : rng.int(4), aid(), t + 1);
        if (me.canTarget) e.chooseTarget(p.id, rng.pick(me.targetOptions), aid(), t + 1);
      }
      const wake = e.nextWakeAt();
      if (wake == null) break;
      t = Math.max(t + 1, wake);
      e.tick(t);
    }
    expect(e.phase).toBe('GAME_OVER');
    expect(e.winnerId).not.toBeNull();
    expect(seenRounds).toEqual(e.rounds);
    expect(e.players.every((p) => p.score >= 0)).toBe(true);
    const summary = e.resultSummary()!;
    expect(summary.players.find((p) => p.rank === 1)!.id).toBe(e.winnerId);
  });

  it('omkamp nullstiller til lobby med samme spillere', () => {
    const { e } = started(2, ['collector', 'final']);
    e.players[0].score = 999;
    e.resetToLobby(makePool(50));
    expect(e.phase).toBe('LOBBY');
    expect(e.players).toHaveLength(2);
    expect(e.players[0].score).toBe(0);
    expect(e.players[0].ready).toBe(false);
  });
});

describe('spørsmålsutvalg', () => {
  const bank: Question[] = [
    ...Array.from({ length: 30 }, (_, i) => ({ ...makePool(1)[0], id: `b${i}`, text: `barn ${i}`, difficulty: 'barn' as const, options: [`riktig${i}`, 'x', 'y', 'z'] as Question['options'] })),
    ...Array.from({ length: 30 }, (_, i) => ({ ...makePool(1)[0], id: `v${i}`, text: `voksen ${i}`, difficulty: 'voksen' as const, category: 'sport' as const })),
    { ...makePool(1)[0], id: 'dup', text: 'barn 1', difficulty: 'barn' as const },
    { ...makePool(1)[0], id: 'en1', text: 'english', language: 'en' as const },
  ];

  it('stokker svaralternativer uten å miste riktig svar', () => {
    const { pool } = buildQuestionPool(bank, { ...SETTINGS, difficulty: 'barn' }, 5);
    for (const q of pool.filter((x) => x.id.startsWith('b'))) {
      expect(q.options[q.correctIndex]).toMatch(/^riktig/);
    }
  });

  it('fjerner duplikater og holder engelske spørsmål ute som standard', () => {
    const { pool } = buildQuestionPool(bank, { ...SETTINGS, difficulty: 'barn' }, 5);
    expect(pool.find((q) => q.id === 'dup')).toBeUndefined();
    expect(pool.find((q) => q.language === 'en')).toBeUndefined();
    expect(new Set(pool.map((q) => q.id)).size).toBe(pool.length);
  });

  it('prioriterer valgt nivå og varsler ved påfyll', () => {
    const { pool, warnings } = buildQuestionPool(bank, { ...SETTINGS, difficulty: 'barn' }, 5);
    expect(pool.slice(0, 30).every((q) => q.difficulty === 'barn')).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('Voksen 18+', () => {
  const adultQ = (i: number): Question => ({ ...makePool(1)[0], id: `a${i}`, text: `fest ${i}`, category: 'voksen18', difficulty: 'voksen' });
  const normalQ = (i: number, difficulty: Question['difficulty']): Question => ({ ...makePool(1)[0], id: `n${difficulty}${i}`, text: `vanlig ${difficulty} ${i}`, difficulty });
  const bank = [...Array.from({ length: 20 }, (_, i) => adultQ(i)), ...(['barn', 'familie', 'voksen'] as const).flatMap((d) => Array.from({ length: 20 }, (_, i) => normalQ(i, d)))];

  it('kommer aldri med uten at verten har valgt kategorien', () => {
    for (const difficulty of ['barn', 'familie', 'voksen'] as const) {
      const { pool } = buildQuestionPool(bank, { ...SETTINGS, difficulty }, 3);
      expect(pool.some((q) => q.category === 'voksen18')).toBe(false);
    }
  });

  it('kan ikke sniklegges inn på barne- eller familienivå', () => {
    const { pool } = buildQuestionPool(bank, { ...SETTINGS, difficulty: 'familie', categories: ['voksen18'] }, 3);
    expect(pool.some((q) => q.category === 'voksen18')).toBe(false);
    expect(settingsSchema.safeParse({ ...SETTINGS, difficulty: 'barn', categories: ['voksen18'] }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...SETTINGS, difficulty: 'voksen', categories: ['voksen18'] }).success).toBe(true);
  });

  it('prioriteres når den er valgt på voksennivå', () => {
    const { pool } = buildQuestionPool(bank, { ...SETTINGS, difficulty: 'voksen', categories: ['voksen18'] }, 3);
    expect(pool.slice(0, 20).every((q) => q.category === 'voksen18')).toBe(true);
  });

  it('gir frekkere programlederkommentarer bare i 18+-spill', () => {
    const adultLines = new Set(Object.values(COMMENTARY_ADULT).flat());
    const normal = new Commentator(new Rng(1), false);
    const adult = new Commentator(new Rng(1), true);
    const n = Array.from({ length: 40 }, () => normal.pick('wrong', { name: 'X' }).text);
    const a = Array.from({ length: 40 }, () => adult.pick('wrong', { name: 'X' }).text);
    const isAdultText = (t: string) => [...adultLines].some((l) => l.replace('{name}', 'X') === t);
    expect(n.some(isAdultText)).toBe(false);
    expect(a.some(isAdultText)).toBe(true);
  });
});

describe('import av spørsmål', () => {
  it('parser CSV med anførselstegn og semikolon', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\n1;2;3')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('importerer gyldige rader og rapporterer feil', () => {
    const csv = 'tekst,a,b,c,d,riktig,kategori,nivå\n"Hva er 2+2?",4,3,5,22,A,generelt,barn\nUgyldig,1,1,1,1,A,generelt,barn\n';
    const r = importQuestionsCsv(csv);
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].correctIndex).toBe(0);
    expect(r.errors).toHaveLength(1);
  });

  it('importerer JSON', () => {
    const r = importQuestionsJson(JSON.stringify([{ text: 'Q?', options: ['a', 'b', 'c', 'd'], correct: 'C', category: 'sport', difficulty: 'voksen' }]));
    expect(r.valid[0].correctIndex).toBe(2);
    expect(importQuestionsJson('{oops').errors).toHaveLength(1);
  });
});
