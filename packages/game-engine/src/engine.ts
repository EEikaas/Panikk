import {
  isAdultGame,
  LENGTH_CONFIG,
  MAX_PLAYERS,
  ROUND_INFO,
  ROUND_ORDER,
  Rng,
  SCORING,
  TIMING,
  type ActionResult,
  type Commentary,
  type FxEvent,
  type FxType,
  type GameSettings,
  type Phase,
  type PlayerStats,
  type PublicPlayer,
  type PublicState,
  type Question,
  type RevealResult,
  type RoundType,
  type Situation,
  type ViewMode,
} from '@podiepanikk/shared';
import { Commentator } from './commentator';

/*
 * PODIEPANIKK – serverautoritativ spillmotor.
 *
 * Motoren er ren og deterministisk: all tid sendes inn som `now` (ms), og all
 * tilfeldighet kommer fra en seedet RNG. Serveren kaller `tick(now)` når
 * `nextWakeAt()` passeres, og klienter sender kun handlinger (svar, buzz, mål).
 *
 * Tilstandsmaskin:
 *   LOBBY → INTRO → ROUND_INTRO → QUESTION ⇄ (BUZZ_ANSWER) → REVEAL
 *     → (TARGETING → ACTION_RESULT) → QUESTION … → SCOREBOARD → ROUND_INTRO …
 *     → [finale] → CEREMONY → GAME_OVER
 */

export interface EnginePlayer {
  id: string;
  name: string;
  characterId: string;
  variant: number;
  ready: boolean;
  connected: boolean;
  left: boolean;
  view: ViewMode;
  isBot: boolean;
  joinOrder: number;
  score: number;
  lastDelta: number;
  streak: number;
  bestStreak: number;
  correct: number;
  answered: number;
  totalMs: number;
  finalSteps: number;
}

interface Answer {
  choice: number | null;
  at: number;
  ms: number;
}

export type EngineResult = { ok: true; duplicate?: boolean } | { ok: false; error: string };

export interface Viewer {
  memberId: string;
  playerId: string | null;
  isHost: boolean;
  isScreen: boolean;
}

export interface GameResultSummary {
  startedAt: number;
  endedAt: number;
  winnerId: string | null;
  rounds: RoundType[];
  players: {
    id: string;
    name: string;
    characterId: string;
    isBot: boolean;
    score: number;
    rank: number;
    correct: number;
    answered: number;
    totalMs: number;
  }[];
}

const PAUSABLE: Phase[] = ['INTRO', 'ROUND_INTRO', 'REVEAL', 'ACTION_RESULT', 'SCOREBOARD'];
const ADVANCEABLE: Phase[] = ['INTRO', 'ROUND_INTRO', 'REVEAL', 'ACTION_RESULT', 'SCOREBOARD', 'CEREMONY'];
const fail = (error: string): EngineResult => ({ ok: false, error });
const OK: EngineResult = { ok: true };

export class GameEngine {
  readonly code: string;
  settings: GameSettings;
  private rng: Rng;
  private commentator: Commentator;
  private pool: Question[];
  private used = new Set<string>();
  private joinCounter = 0;

  players: EnginePlayer[] = [];
  hostId: string;
  phase: Phase = 'LOBBY';
  paused = false;
  pausePending = false;
  private pausedRemaining: number | null = null;
  deadline: number | null = null;
  private shownDeadline: number | null = null;
  phaseStartedAt = 0;

  rounds: RoundType[] = [];
  roundIndex = -1;
  private qInRound = 0;
  private current: { q: Question; startedAt: number; durationMs: number; answers: Map<string, Answer> } | null = null;
  private eligible: Set<string> | null = null;
  private buzz: {
    order: string[];
    active: string | null;
    lockedOut: Set<string>;
    answerStart: number;
    deltas: Map<string, number>;
  } | null = null;
  private reveal: { correctIndex: number; results: RevealResult[] } | null = null;
  private targeting: { kind: 'steal' | 'pie' | 'bomb'; eligible: string[]; chosen: Map<string, string> } | null = null;
  private actions: ActionResult[] = [];
  private bomb: {
    holderId: string;
    fuseTotal: number;
    fuseLeft: number;
    runningSince: number | null;
    bombsLeft: number;
    exploded: boolean;
    lastCorrect: boolean;
  } | null = null;
  private final: { goal: number; maxQuestions: number; questionNo: number; tiebreak: string[] | null } | null = null;
  winnerId: string | null = null;
  private ranking: string[] = [];
  private fx: FxEvent[] = [];
  private fxSeq = 0;
  private commentary: Commentary | null = null;
  private processed = new Set<string>();
  warnings: string[] = [];
  startedAt: number | null = null;
  endedAt: number | null = null;

  constructor(opts: { code: string; settings: GameSettings; seed: number; pool: Question[]; hostId: string; warnings?: string[] }) {
    this.code = opts.code;
    this.settings = opts.settings;
    this.rng = new Rng(opts.seed);
    this.commentator = new Commentator(this.rng, isAdultGame(opts.settings));
    this.pool = opts.pool;
    this.hostId = opts.hostId;
    this.warnings = opts.warnings ?? [];
  }

  // ───────────────────────── hjelpere ─────────────────────────

  private dur(ms: number): number {
    return Math.max(1, Math.round(ms * (this.settings.timeScale ?? 1)));
  }
  private get roundType(): RoundType | null {
    return this.rounds[this.roundIndex] ?? null;
  }
  getPlayer(id: string): EnginePlayer | undefined {
    return this.players.find((p) => p.id === id);
  }
  private name(id: string | null | undefined): string {
    return (id && this.getPlayer(id)?.name) || 'noen';
  }
  /** Spillere som fortsatt er med i spillet (også midlertidig frakoblede). */
  activePlayers(): EnginePlayer[] {
    return this.players.filter((p) => !p.left);
  }
  private connectedActive(): EnginePlayer[] {
    return this.players.filter((p) => !p.left && p.connected);
  }
  private pushFx(type: FxType, extra: Omit<FxEvent, 'id' | 'type'> = {}): void {
    this.fx.push({ id: ++this.fxSeq, type, ...extra });
    if (this.fx.length > 40) this.fx.splice(0, this.fx.length - 40);
  }
  private say(s: Situation, vars: { name?: string; target?: string; n?: number } = {}): void {
    this.commentary = this.commentator.pick(s, vars);
  }
  private addScore(p: EnginePlayer, delta: number): number {
    const before = p.score;
    p.score = Math.max(0, p.score + delta);
    const real = p.score - before;
    p.lastDelta += real;
    return real;
  }
  private resetDeltas(): void {
    for (const p of this.players) p.lastDelta = 0;
  }
  private dedupe(playerId: string, actionId: string): boolean {
    const key = `${playerId}:${actionId}`;
    if (this.processed.has(key)) return true;
    if (this.processed.size > 5000) this.processed.clear();
    this.processed.add(key);
    return false;
  }

  private setPhase(phase: Phase, now: number, durationMs: number | null): void {
    this.phase = phase;
    this.phaseStartedAt = now;
    this.deadline = durationMs == null ? null : now + this.dur(durationMs);
    this.shownDeadline = this.deadline;
    if (this.pausePending && PAUSABLE.includes(phase) && this.deadline != null) {
      this.pausePending = false;
      this.paused = true;
      this.pausedRemaining = this.deadline - now;
      this.say('paused');
    }
  }

  private grace(): number {
    return this.phase === 'QUESTION' || this.phase === 'BUZZ_ANSWER' || this.phase === 'TARGETING'
      ? this.dur(TIMING.answerGrace)
      : 0;
  }

  /** Når serveren bør kalle tick() neste gang (null = ingen tidtaker). */
  nextWakeAt(): number | null {
    if (this.paused || this.deadline == null) return null;
    return this.deadline + this.grace();
  }

  // ───────────────────────── lobby ─────────────────────────

  private recomputeVariants(): void {
    const counts = new Map<string, number>();
    for (const p of [...this.players].sort((a, b) => a.joinOrder - b.joinOrder)) {
      const n = counts.get(p.characterId) ?? 0;
      p.variant = n;
      counts.set(p.characterId, n + 1);
    }
  }

  addPlayer(input: { id: string; name: string; characterId: string; isBot?: boolean; view?: ViewMode }): EngineResult {
    if (this.phase !== 'LOBBY') return fail('Spillet er allerede i gang');
    if (this.players.length >= Math.min(this.settings.maxPlayers, MAX_PLAYERS)) return fail('Rommet er fullt');
    if (this.getPlayer(input.id)) return fail('Spilleren finnes allerede');
    this.players.push({
      id: input.id,
      name: input.name,
      characterId: input.characterId,
      variant: 0,
      ready: !!input.isBot,
      connected: true,
      left: false,
      view: input.view ?? (this.settings.displayMode === 'mobile' ? 'full' : 'controller'),
      isBot: !!input.isBot,
      joinOrder: ++this.joinCounter,
      score: 0,
      lastDelta: 0,
      streak: 0,
      bestStreak: 0,
      correct: 0,
      answered: 0,
      totalMs: 0,
      finalSteps: 0,
    });
    this.recomputeVariants();
    this.pushFx('join', { playerId: input.id });
    return OK;
  }

  /** Fjerner spiller i lobby; under spill markeres spilleren som «forlatt» (poeng beholdes i resultatlista). */
  removePlayer(id: string, now: number): EngineResult {
    const p = this.getPlayer(id);
    if (!p) return fail('Ukjent spiller');
    if (this.phase === 'LOBBY' || this.phase === 'GAME_OVER') {
      this.players = this.players.filter((x) => x.id !== id);
      this.recomputeVariants();
    } else {
      p.left = true;
      p.connected = false;
      this.onPlayerGone(id, now);
    }
    return OK;
  }

  kick(byId: string, playerId: string, now: number): EngineResult {
    if (byId !== this.hostId) return fail('Bare verten kan fjerne spillere');
    if (this.phase !== 'LOBBY') return fail('Spillere kan bare fjernes før spillstart');
    return this.removePlayer(playerId, now);
  }

  setConnected(id: string, connected: boolean, now: number): void {
    const p = this.getPlayer(id);
    if (!p || p.left) return;
    p.connected = connected;
    if (!connected) this.onPlayerGone(id, now);
  }

  /** Sørger for at frakoblede spillere ikke stopper spillet. */
  private onPlayerGone(_id: string, now: number): void {
    if (this.phase === 'QUESTION' && this.current && this.roundType !== 'fastest' && this.roundType !== 'bomb') {
      if (this.allAnswered()) this.closeQuestion(now);
    } else if (this.phase === 'TARGETING' && this.targeting) {
      if (this.allTargeted()) this.resolveTargeting(now);
    }
  }

  updatePlayer(id: string, u: { name?: string; characterId?: string; ready?: boolean; view?: ViewMode }): EngineResult {
    const p = this.getPlayer(id);
    if (!p) return fail('Ukjent spiller');
    if (u.view) p.view = u.view; // visningsmodus kan byttes når som helst – påvirker ikke spillstatus
    if (this.phase === 'LOBBY') {
      if (u.name) p.name = u.name;
      if (u.characterId) {
        p.characterId = u.characterId;
        this.recomputeVariants();
      }
      if (u.ready !== undefined) p.ready = u.ready;
    } else if (u.name || u.characterId || u.ready !== undefined) {
      if (!u.view) return fail('Kan ikke endres under spillet');
    }
    return OK;
  }

  setHost(id: string): void {
    this.hostId = id;
  }

  canStart(): { ok: boolean; reason?: string } {
    if (this.phase !== 'LOBBY') return { ok: false, reason: 'Spillet er allerede startet' };
    const ready = this.players.filter((p) => p.ready && p.connected).length;
    if (this.players.length < 2) return { ok: false, reason: 'Minst to spillere må være med' };
    if (ready < 2) return { ok: false, reason: 'Minst to spillere må være klare' };
    return { ok: true };
  }

  start(byId: string, now: number): EngineResult {
    if (byId !== this.hostId) return fail('Bare verten kan starte spillet');
    const c = this.canStart();
    if (!c.ok) return fail(c.reason!);
    // Frakoblede spillere som aldri ble klare, tas ut; resten blir med.
    this.players = this.players.filter((p) => p.ready || p.connected);
    for (const p of this.players) {
      p.ready = true;
      Object.assign(p, { score: 0, lastDelta: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, totalMs: 0, finalSteps: 0 });
    }
    const cfg = LENGTH_CONFIG[this.settings.length];
    const count = cfg.minRounds + this.rng.int(cfg.maxRounds - cfg.minRounds + 1);
    const candidates = ROUND_ORDER.filter((r) => r !== 'final');
    const chosen = new Set<RoundType>(this.rng.shuffle(candidates).slice(0, count - 1));
    this.rounds = [...ROUND_ORDER.filter((r) => chosen.has(r)), 'final'];
    this.roundIndex = -1;
    this.startedAt = now;
    this.winnerId = null;
    this.ranking = [];
    this.say('intro');
    this.setPhase('INTRO', now, TIMING.intro);
    return OK;
  }

  // ───────────────────────── pause / vert ─────────────────────────

  setPaused(byId: string, paused: boolean, now: number): EngineResult {
    if (byId !== this.hostId) return fail('Bare verten kan pause');
    if (this.phase === 'LOBBY' || this.phase === 'GAME_OVER') return fail('Ingen spill å pause');
    if (paused) {
      if (this.paused) return OK;
      if (PAUSABLE.includes(this.phase) && this.deadline != null) {
        this.paused = true;
        this.pausedRemaining = this.deadline - now;
        this.say('paused');
      } else {
        this.pausePending = true; // pauser ved neste trygge overgang (mellom spørsmål/runder)
      }
    } else {
      this.pausePending = false;
      if (this.paused) {
        this.paused = false;
        this.deadline = now + (this.pausedRemaining ?? 0);
        this.shownDeadline = this.deadline;
        this.pausedRemaining = null;
      }
    }
    return OK;
  }

  /** Verten kan hoppe over ventetid i rene visningsfaser. */
  advance(byId: string, now: number): EngineResult {
    if (byId !== this.hostId) return fail('Bare verten kan gå videre');
    if (!ADVANCEABLE.includes(this.phase) || this.paused) return fail('Kan ikke hoppe videre nå');
    this.deadline = now;
    this.tick(now);
    return OK;
  }

  // ───────────────────────── tid ─────────────────────────

  tick(now: number): boolean {
    let changed = false;
    let guard = 0;
    while (!this.paused && this.deadline != null && now >= this.deadline + this.grace() && guard++ < 20) {
      this.onDeadline(now);
      changed = true;
    }
    return changed;
  }

  private onDeadline(now: number): void {
    switch (this.phase) {
      case 'INTRO':
        return this.beginRound(0, now);
      case 'ROUND_INTRO':
        return this.nextQuestion(now);
      case 'QUESTION':
        if (this.roundType === 'bomb') {
          if (this.fuseLeft(now) <= 0) return this.explode(now);
          return this.bombAnswered(this.bomb!.holderId, null, now);
        }
        if (this.roundType === 'fastest') return this.revealFastest(now);
        return this.closeQuestion(now);
      case 'BUZZ_ANSWER':
        return this.fastestWrong(this.buzz!.active!, null, now);
      case 'REVEAL':
        return this.afterReveal(now);
      case 'TARGETING':
        if (this.targeting?.kind === 'bomb' && this.fuseLeft(now) <= 0) return this.explode(now);
        return this.resolveTargeting(now);
      case 'ACTION_RESULT':
        return this.afterAction(now);
      case 'SCOREBOARD':
        if (this.roundIndex + 1 < this.rounds.length) return this.beginRound(this.roundIndex + 1, now);
        return this.finishGame(now);
      case 'CEREMONY':
        this.setPhase('GAME_OVER', now, null);
        return;
      default:
        this.deadline = null;
    }
  }

  // ───────────────────────── runder og spørsmål ─────────────────────────

  private beginRound(index: number, now: number): void {
    this.roundIndex = index;
    this.qInRound = 0;
    this.current = null;
    this.reveal = null;
    this.buzz = null;
    this.targeting = null;
    this.actions = [];
    this.bomb = null;
    this.final = null;
    this.eligible = null;
    this.resetDeltas();
    const type = this.roundType!;
    const cfg = LENGTH_CONFIG[this.settings.length];
    if (type === 'bomb') {
      const fuse = this.rng.range(TIMING.bombFuseMin, TIMING.bombFuseMax);
      const holder = this.rng.pick(this.connectedActive().length ? this.connectedActive() : this.activePlayers());
      this.bomb = {
        holderId: holder.id,
        fuseTotal: this.dur(fuse),
        fuseLeft: this.dur(fuse),
        runningSince: null,
        bombsLeft: cfg.bombsPerRound,
        exploded: false,
        lastCorrect: false,
      };
    }
    if (type === 'final') {
      const max = Math.max(0, ...this.players.map((p) => p.score));
      for (const p of this.players) {
        p.finalSteps = max > 0 ? Math.round((SCORING.finalHeadStartMax * p.score) / max) : 0;
      }
      this.final = { goal: cfg.finalGoal, maxQuestions: cfg.finalMaxQuestions, questionNo: 0, tiebreak: null };
      this.say('final');
    } else {
      this.say('roundIntro');
    }
    this.pushFx('roundStart');
    this.setPhase('ROUND_INTRO', now, TIMING.roundIntro);
  }

  private drawQuestion(): Question | null {
    for (const q of this.pool) {
      if (!this.used.has(q.id)) {
        this.used.add(q.id);
        return q;
      }
    }
    return null;
  }

  private nextQuestion(now: number): void {
    const type = this.roundType!;
    const cfg = LENGTH_CONFIG[this.settings.length];
    if ((type === 'collector' || type === 'fastest' || type === 'thief' || type === 'pie') && this.qInRound >= cfg.questionsPerRound) {
      return this.endRound(now);
    }
    const q = this.drawQuestion();
    if (!q) {
      if (type === 'final') return this.resolveFinalFallback(now);
      return this.endRound(now);
    }
    this.qInRound++;
    this.reveal = null;
    this.targeting = null;
    this.actions = [];
    this.resetDeltas();
    this.eligible = null;
    this.buzz = null;

    let duration: number = this.settings.difficulty === 'barn' ? TIMING.questionKids : TIMING.question;
    if (type === 'fastest') {
      duration = TIMING.buzzWindow;
      this.buzz = { order: [], active: null, lockedOut: new Set(), answerStart: now, deltas: new Map() };
    } else if (type === 'bomb') {
      const b = this.bomb!;
      const holder = this.getPlayer(b.holderId);
      if (!holder || holder.left || !holder.connected) {
        const others = this.connectedActive().filter((p) => p.id !== b.holderId);
        if (others.length) {
          const to = this.rng.pick(others);
          this.actions = [{ kind: 'bombPass', fromId: null, toId: to.id, amount: 0 }];
          b.holderId = to.id;
          this.pushFx('bombPass', { targetId: to.id });
        }
      }
      this.eligible = new Set([b.holderId]);
      duration = TIMING.bombQuestion;
      if (this.qInRound === 1) this.say('bombStart', { name: this.name(b.holderId) });
    } else if (type === 'final') {
      const f = this.final!;
      f.questionNo++;
      const t = Math.min(1, (f.questionNo - 1) / Math.max(1, f.maxQuestions - 1));
      duration = Math.round(TIMING.finalQuestionStart - (TIMING.finalQuestionStart - TIMING.finalQuestionMin) * t);
      if (f.tiebreak) this.eligible = new Set(f.tiebreak);
    }
    this.current = { q, startedAt: now, durationMs: this.dur(duration), answers: new Map() };
    this.setPhase('QUESTION', now, duration);
    if (type === 'bomb') {
      this.bomb!.runningSince = now;
      this.deadline = Math.min(this.deadline!, now + this.bomb!.fuseLeft);
    }
    this.pushFx('questionStart');
  }

  private isEligible(pid: string): boolean {
    const p = this.getPlayer(pid);
    if (!p || p.left) return false;
    return this.eligible == null || this.eligible.has(pid);
  }

  private allAnswered(): boolean {
    if (!this.current) return false;
    const list = this.connectedActive().filter((p) => this.isEligible(p.id));
    if (list.length === 0) return false;
    return list.every((p) => this.current!.answers.has(p.id));
  }

  canAnswer(pid: string): boolean {
    if (!this.current) return false;
    if (this.phase === 'QUESTION') {
      if (this.roundType === 'fastest') return false;
      return this.isEligible(pid) && !this.current.answers.has(pid);
    }
    if (this.phase === 'BUZZ_ANSWER') return this.buzz?.active === pid;
    return false;
  }

  canBuzz(pid: string): boolean {
    const p = this.getPlayer(pid);
    return (
      this.phase === 'QUESTION' &&
      this.roundType === 'fastest' &&
      !!this.buzz &&
      this.buzz.active == null &&
      !!p &&
      !p.left &&
      !this.buzz.lockedOut.has(pid)
    );
  }

  // ───────────────────────── handlinger ─────────────────────────

  answer(pid: string, questionId: string, choice: number, actionId: string, now: number): EngineResult {
    if (this.dedupe(pid, actionId)) return { ok: true, duplicate: true };
    if (!this.current || this.current.q.id !== questionId) return fail('Spørsmålet er ikke aktivt lenger');
    if (!this.canAnswer(pid)) return fail('Du kan ikke svare nå');
    if (this.shownDeadline != null && now > this.shownDeadline + this.dur(TIMING.answerGrace)) return fail('For sent!');
    if (this.roundType === 'bomb' && this.fuseLeft(now) <= 0) return fail('For sent – bomben smalt!');
    if (choice < 0 || choice > 3) return fail('Ugyldig svar');
    const start = this.phase === 'BUZZ_ANSWER' ? this.buzz!.answerStart : this.current.startedAt;
    const ms = Math.max(0, now - start);
    this.current.answers.set(pid, { choice, at: now, ms });
    const p = this.getPlayer(pid)!;
    p.answered++;
    p.totalMs += ms;
    this.pushFx('answerLocked', { playerId: pid });

    const correct = choice === this.current.q.correctIndex;
    if (this.phase === 'BUZZ_ANSWER') {
      if (correct) this.fastestCorrect(pid, now);
      else this.fastestWrong(pid, choice, now);
    } else if (this.roundType === 'bomb') {
      this.bombAnswered(pid, choice, now);
    } else if (this.allAnswered()) {
      this.closeQuestion(now);
    }
    return OK;
  }

  buzzIn(pid: string, questionId: string, actionId: string, now: number): EngineResult {
    if (this.dedupe(pid, actionId)) return { ok: true, duplicate: true };
    if (!this.current || this.current.q.id !== questionId) return fail('Spørsmålet er ikke aktivt lenger');
    if (!this.canBuzz(pid)) {
      if (this.buzz?.active) return fail(`${this.name(this.buzz.active)} var raskere!`);
      return fail('Du kan ikke buzze nå');
    }
    if (this.shownDeadline != null && now > this.shownDeadline + this.dur(TIMING.answerGrace)) return fail('For sent!');
    // Serverens mottaksrekkefølge avgjør – ikke klientens klokke. Node behandler hendelser sekvensielt,
    // så to «samtidige» trykk får alltid en entydig rekkefølge.
    const b = this.buzz!;
    b.order.push(pid);
    b.active = pid;
    b.answerStart = now;
    this.pushFx('buzz', { playerId: pid });
    this.say('buzz', { name: this.name(pid) });
    this.setPhase('BUZZ_ANSWER', now, TIMING.buzzAnswer);
    return OK;
  }

  chooseTarget(pid: string, targetId: string, actionId: string, now: number): EngineResult {
    if (this.dedupe(pid, actionId)) return { ok: true, duplicate: true };
    const t = this.targeting;
    if (this.phase !== 'TARGETING' || !t) return fail('Ingen mål å velge nå');
    if (!t.eligible.includes(pid)) return fail('Du kan ikke velge mål nå');
    if (t.chosen.has(pid)) return fail('Du har allerede valgt');
    if (!this.targetOptions(pid).includes(targetId)) return fail('Ugyldig mål');
    t.chosen.set(pid, targetId);
    if (this.allTargeted()) this.resolveTargeting(now);
    return OK;
  }

  targetOptions(pid: string): string[] {
    return this.activePlayers()
      .filter((p) => p.id !== pid)
      .map((p) => p.id);
  }

  private allTargeted(): boolean {
    const t = this.targeting!;
    const waiting = t.eligible.filter((id) => {
      const p = this.getPlayer(id);
      return p && p.connected && !p.left && !t.chosen.has(id);
    });
    return waiting.length === 0;
  }

  // ───────────────────────── avslutning av spørsmål ─────────────────────────

  private closeQuestion(now: number): void {
    const cur = this.current!;
    const type = this.roundType!;
    const q = cur.q;
    this.resetDeltas();
    const participants = this.activePlayers().filter((p) => this.isEligible(p.id));
    const results: RevealResult[] = [];
    const tiebreak = type === 'final' && !!this.final?.tiebreak;

    let fastestCorrectId: string | null = null;
    let fastestMs = Infinity;
    for (const p of participants) {
      const a = cur.answers.get(p.id);
      if (a && a.choice === q.correctIndex && a.ms < fastestMs) {
        fastestMs = a.ms;
        fastestCorrectId = p.id;
      }
    }

    for (const p of participants) {
      const a = cur.answers.get(p.id);
      const correct = !!a && a.choice === q.correctIndex;
      let delta = 0;
      if (correct) {
        p.correct++;
        p.streak++;
        p.bestStreak = Math.max(p.bestStreak, p.streak);
      } else {
        p.streak = 0;
      }
      if (type === 'collector' && correct) {
        const frac = Math.max(0, 1 - a!.ms / cur.durationMs);
        delta = SCORING.collectorBase + Math.round((SCORING.collectorSpeedMax * frac) / 10) * 10;
      } else if (type === 'thief' && correct) delta = SCORING.thiefCorrect;
      else if (type === 'pie' && correct) delta = SCORING.pieCorrect;
      else if (type === 'final' && !tiebreak) {
        if (correct) {
          const steps = p.id === fastestCorrectId ? 2 : 1;
          p.finalSteps += steps;
          delta = SCORING.finalCorrectPoints;
          this.pushFx('finalStep', { playerId: p.id, amount: steps });
        } else if (a && a.choice != null) {
          p.finalSteps = Math.max(0, p.finalSteps - 1);
          this.pushFx('finalStep', { playerId: p.id, amount: -1 });
        }
      }
      const real = delta ? this.addScore(p, delta) : 0;
      results.push({ playerId: p.id, choice: a?.choice ?? null, correct, delta: real, ms: a?.ms ?? null });
      this.pushFx(correct ? 'correct' : a ? 'wrong' : 'timeout', { playerId: p.id, amount: real });
    }

    this.reveal = { correctIndex: q.correctIndex, results };
    this.commentOnResults(results, cur.durationMs);
    if (tiebreak && fastestCorrectId) this.winnerId = fastestCorrectId;
    this.setPhase('REVEAL', now, TIMING.reveal);
  }

  private commentOnResults(results: RevealResult[], durationMs: number): void {
    const correct = results.filter((r) => r.correct);
    const answered = results.filter((r) => r.choice != null);
    const streaker = this.players.filter((p) => p.streak >= 3 && correct.some((r) => r.playerId === p.id)).sort((a, b) => b.streak - a.streak)[0];
    if (answered.length === 0) return this.say('noAnswer');
    if (streaker && streaker.streak % 3 === 0) return this.say('streak', { name: streaker.name, n: streaker.streak });
    if (results.length >= 2 && correct.length === results.length) return this.say('allCorrect');
    if (correct.length === 0) return this.say('allWrong');
    const fastest = [...correct].sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0))[0];
    if (fastest && (fastest.ms ?? Infinity) < durationMs * 0.3) return this.say('fastCorrect', { name: this.name(fastest.playerId) });
    if (correct.length >= answered.length / 2) return this.say('correct', { name: this.name(fastest?.playerId) });
    const wrong = answered.find((r) => !r.correct);
    return this.say('wrong', { name: this.name(wrong?.playerId) });
  }

  private afterReveal(now: number): void {
    const type = this.roundType!;
    if (type === 'thief' || type === 'pie') {
      const correct = (this.reveal?.results ?? [])
        .filter((r) => r.correct && !this.getPlayer(r.playerId)?.left)
        .sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0))
        .map((r) => r.playerId);
      if (correct.length > 0 && this.activePlayers().length >= 2) {
        this.targeting = { kind: type === 'thief' ? 'steal' : 'pie', eligible: correct, chosen: new Map() };
        this.setPhase('TARGETING', now, TIMING.targeting);
        return;
      }
      if (type === 'thief') this.say('noSteal');
      return this.nextQuestion(now);
    }
    if (type === 'bomb') {
      const b = this.bomb!;
      if (b.lastCorrect && this.activePlayers().length >= 2) {
        this.targeting = { kind: 'bomb', eligible: [b.holderId], chosen: new Map() };
        this.setPhase('TARGETING', now, TIMING.bombTargeting);
        b.runningSince = now;
        this.deadline = Math.min(this.deadline!, now + b.fuseLeft);
        return;
      }
      return this.nextQuestion(now);
    }
    if (type === 'final') return this.checkFinal(now);
    return this.nextQuestion(now);
  }

  private resolveTargeting(now: number): void {
    const t = this.targeting!;
    this.resetDeltas();
    this.actions = [];
    if (t.kind === 'bomb') {
      const b = this.bomb!;
      this.stopFuse(now);
      let to = t.chosen.get(b.holderId);
      if (!to) {
        const opts = this.connectedActive().filter((p) => p.id !== b.holderId);
        const pool = opts.length ? opts : this.activePlayers().filter((p) => p.id !== b.holderId);
        to = pool.length ? this.rng.pick(pool).id : b.holderId;
      }
      this.actions.push({ kind: 'bombPass', fromId: b.holderId, toId: to, amount: 0 });
      this.pushFx('bombPass', { playerId: b.holderId, targetId: to });
      this.say('bombPass', { name: this.name(b.holderId), target: this.name(to) });
      b.holderId = to;
      this.setPhase('ACTION_RESULT', now, TIMING.revealShort);
      return;
    }
    for (const pid of t.eligible) {
      const targetId = t.chosen.get(pid);
      if (!targetId) continue;
      const from = this.getPlayer(pid)!;
      const target = this.getPlayer(targetId)!;
      if (t.kind === 'steal') {
        const amount = Math.min(SCORING.stealAmount, target.score);
        this.addScore(target, -amount);
        this.addScore(from, amount);
        this.actions.push({ kind: 'steal', fromId: pid, toId: targetId, amount });
        this.pushFx('steal', { playerId: pid, targetId, amount });
      } else {
        const amount = Math.min(SCORING.pieHit, target.score);
        this.addScore(target, -amount);
        this.addScore(from, SCORING.pieThrowerBonus);
        this.actions.push({ kind: 'pie', fromId: pid, toId: targetId, amount });
        this.pushFx('pie', { playerId: pid, targetId, amount });
      }
    }
    const first = this.actions[0];
    if (first) this.say(t.kind === 'steal' ? 'steal' : 'pie', { name: this.name(first.fromId), target: this.name(first.toId) });
    else if (t.kind === 'steal') this.say('noSteal');
    this.setPhase('ACTION_RESULT', now, TIMING.actionResult);
  }

  private afterAction(now: number): void {
    if (this.roundType === 'bomb') {
      const b = this.bomb!;
      if (b.exploded) {
        if (b.bombsLeft <= 0) return this.endRound(now);
        const exploded = b.holderId;
        const opts = this.connectedActive().filter((p) => p.id !== exploded);
        const next = opts.length ? this.rng.pick(opts) : this.getPlayer(exploded)!;
        const fuse = this.dur(this.rng.range(TIMING.bombFuseMin, TIMING.bombFuseMax));
        Object.assign(b, { holderId: next.id, fuseTotal: fuse, fuseLeft: fuse, runningSince: null, exploded: false, lastCorrect: false });
        this.say('bombStart', { name: next.name });
      }
    }
    this.nextQuestion(now);
  }

  // ───────────────────────── Raskest på knappen ─────────────────────────

  private fastestCorrect(pid: string, now: number): void {
    const p = this.getPlayer(pid)!;
    p.correct++;
    p.streak++;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    const real = this.addScore(p, SCORING.fastestCorrect);
    this.buzz!.deltas.set(pid, real);
    this.pushFx('correct', { playerId: pid, amount: real });
    this.revealFastest(now, pid);
  }

  private fastestWrong(pid: string, choice: number | null, now: number): void {
    const p = this.getPlayer(pid)!;
    const b = this.buzz!;
    if (choice == null) this.current!.answers.set(pid, { choice: null, at: now, ms: now - b.answerStart });
    p.streak = 0;
    const real = this.addScore(p, -SCORING.fastestWrong);
    b.deltas.set(pid, real);
    b.lockedOut.add(pid);
    b.active = null;
    this.pushFx('wrong', { playerId: pid, amount: real });
    this.say('wrong', { name: p.name });
    const remaining = this.activePlayers().filter((x) => !b.lockedOut.has(x.id) && x.connected);
    if (remaining.length > 0) {
      this.setPhase('QUESTION', now, TIMING.buzzReopen);
    } else {
      this.revealFastest(now);
    }
  }

  private revealFastest(now: number, winner: string | null = null): void {
    const cur = this.current!;
    const results: RevealResult[] = [];
    for (const [pid, a] of cur.answers) {
      const correct = a.choice === cur.q.correctIndex;
      results.push({ playerId: pid, choice: a.choice, correct, delta: this.buzz?.deltas.get(pid) ?? 0, ms: a.ms });
    }
    if (winner) {
      const p = this.getPlayer(winner)!;
      const ms = cur.answers.get(winner)?.ms ?? 9999;
      if (p.streak >= 3 && p.streak % 3 === 0) this.say('streak', { name: p.name, n: p.streak });
      else if (ms < 2500 * (this.settings.timeScale ?? 1)) this.say('fastCorrect', { name: p.name });
      else this.say('correct', { name: p.name });
    } else if (this.buzz && this.buzz.order.length === 0) {
      this.say('noAnswer');
    } else {
      this.say('allWrong');
    }
    this.reveal = { correctIndex: cur.q.correctIndex, results };
    this.setPhase('REVEAL', now, TIMING.reveal);
  }

  // ───────────────────────── Tikkende bombe ─────────────────────────

  private fuseLeft(now: number): number {
    const b = this.bomb;
    if (!b) return Infinity;
    return b.runningSince == null ? b.fuseLeft : b.fuseLeft - (now - b.runningSince);
  }

  private stopFuse(now: number): void {
    const b = this.bomb;
    if (!b || b.runningSince == null) return;
    b.fuseLeft -= now - b.runningSince;
    b.runningSince = null;
  }

  private bombAnswered(pid: string, choice: number | null, now: number): void {
    this.stopFuse(now);
    const b = this.bomb!;
    const p = this.getPlayer(pid)!;
    const q = this.current!.q;
    const correct = choice != null && choice === q.correctIndex;
    this.resetDeltas();
    let delta = 0;
    if (correct) {
      p.correct++;
      p.streak++;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
      delta = this.addScore(p, SCORING.bombCorrect);
    } else {
      p.streak = 0;
      this.say('bombKeep', { name: p.name });
    }
    b.lastCorrect = correct;
    this.pushFx(correct ? 'correct' : choice == null ? 'timeout' : 'wrong', { playerId: pid, amount: delta });
    const ms = this.current!.answers.get(pid)?.ms ?? null;
    this.reveal = { correctIndex: q.correctIndex, results: [{ playerId: pid, choice, correct, delta, ms }] };
    if (correct) this.say('correct', { name: p.name });
    this.setPhase('REVEAL', now, TIMING.revealShort);
  }

  private explode(now: number): void {
    this.stopFuse(now);
    const b = this.bomb!;
    const p = this.getPlayer(b.holderId)!;
    this.resetDeltas();
    const real = this.addScore(p, -SCORING.bombExplode);
    p.streak = 0;
    b.exploded = true;
    b.bombsLeft--;
    this.reveal = null;
    this.targeting = null;
    this.actions = [{ kind: 'explode', fromId: null, toId: p.id, amount: -real }];
    this.pushFx('explode', { playerId: p.id, amount: real });
    this.say('explode', { name: p.name });
    this.setPhase('ACTION_RESULT', now, TIMING.actionResult);
  }

  // ───────────────────────── Finale ─────────────────────────

  private checkFinal(now: number): void {
    const f = this.final!;
    if (f.tiebreak) {
      if (this.winnerId) return this.finishGame(now);
      return this.nextQuestion(now);
    }
    const active = this.activePlayers();
    const maxSteps = Math.max(...active.map((p) => p.finalSteps));
    const reached = active.some((p) => p.finalSteps >= f.goal);
    if (reached || f.questionNo >= f.maxQuestions) {
      const leaders = active.filter((p) => p.finalSteps === maxSteps);
      if (leaders.length === 1) {
        this.winnerId = leaders[0].id;
        return this.finishGame(now);
      }
      f.tiebreak = leaders.map((p) => p.id);
      this.pushFx('tiebreak');
      this.say('tiebreak');
      return this.nextQuestion(now);
    }
    const close = active.filter((p) => p.finalSteps >= f.goal - 1).sort((a, b) => b.finalSteps - a.finalSteps)[0];
    if (close && this.rng.next() < 0.6) this.say('finalClose', { name: close.name });
    return this.nextQuestion(now);
  }

  /** Brukes bare hvis spørsmålene tar slutt: steg → poeng → raskest snittid → tidligst innlogget. */
  private resolveFinalFallback(now: number): void {
    const candidates = this.final?.tiebreak
      ? this.activePlayers().filter((p) => this.final!.tiebreak!.includes(p.id))
      : this.activePlayers();
    const avg = (p: EnginePlayer) => (p.answered ? p.totalMs / p.answered : Infinity);
    const sorted = [...candidates].sort(
      (a, b) => b.finalSteps - a.finalSteps || b.score - a.score || avg(a) - avg(b) || a.joinOrder - b.joinOrder,
    );
    this.winnerId = sorted[0]?.id ?? null;
    this.finishGame(now);
  }

  private computeRanking(): string[] {
    return [...this.players]
      .sort((a, b) => {
        if (a.id === this.winnerId) return -1;
        if (b.id === this.winnerId) return 1;
        return b.finalSteps - a.finalSteps || b.score - a.score || a.joinOrder - b.joinOrder;
      })
      .map((p) => p.id);
  }

  private endRound(now: number): void {
    this.current = null;
    this.reveal = null;
    this.targeting = null;
    this.actions = [];
    this.ranking = [...this.players].sort((a, b) => b.score - a.score || a.joinOrder - b.joinOrder).map((p) => p.id);
    const [a, b] = this.ranking.map((id) => this.getPlayer(id)!);
    if (a && b && a.score - b.score >= 1500) this.say('bigLead', { name: a.name });
    else if (a && b && a.score - b.score <= 300) this.say('tight');
    this.pushFx('scoreboard');
    this.setPhase('SCOREBOARD', now, TIMING.scoreboard);
  }

  private finishGame(now: number): void {
    if (!this.winnerId) {
      const best = [...this.activePlayers()].sort((a, b) => b.finalSteps - a.finalSteps || b.score - a.score || a.joinOrder - b.joinOrder)[0];
      this.winnerId = best?.id ?? null;
    }
    this.current = null;
    this.reveal = null;
    this.targeting = null;
    this.actions = [];
    this.ranking = this.computeRanking();
    this.endedAt = now;
    this.pushFx('winner', { playerId: this.winnerId ?? undefined });
    this.say('winner', { name: this.name(this.winnerId) });
    this.setPhase('CEREMONY', now, TIMING.ceremony);
  }

  // ───────────────────────── omkamp ─────────────────────────

  resetToLobby(pool: Question[], warnings: string[] = []): void {
    this.players = this.players.filter((p) => !p.left);
    for (const p of this.players) {
      Object.assign(p, { ready: p.isBot, score: 0, lastDelta: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, totalMs: 0, finalSteps: 0 });
    }
    this.pool = pool;
    this.warnings = warnings;
    this.used.clear();
    this.phase = 'LOBBY';
    this.deadline = null;
    this.shownDeadline = null;
    this.paused = false;
    this.pausePending = false;
    this.rounds = [];
    this.roundIndex = -1;
    this.current = null;
    this.reveal = null;
    this.buzz = null;
    this.targeting = null;
    this.actions = [];
    this.bomb = null;
    this.final = null;
    this.winnerId = null;
    this.ranking = [];
    this.commentary = null;
    this.startedAt = null;
    this.endedAt = null;
  }

  // ───────────────────────── utdata ─────────────────────────

  stats(): PlayerStats[] {
    return this.players.map((p) => ({
      playerId: p.id,
      correct: p.correct,
      answered: p.answered,
      avgMs: p.answered ? Math.round(p.totalMs / p.answered) : null,
      bestStreak: p.bestStreak,
    }));
  }

  resultSummary(): GameResultSummary | null {
    if (this.startedAt == null || this.endedAt == null) return null;
    const ranking = this.computeRanking();
    return {
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      winnerId: this.winnerId,
      rounds: this.rounds,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        characterId: p.characterId,
        isBot: p.isBot,
        score: p.score,
        rank: ranking.indexOf(p.id) + 1,
        correct: p.correct,
        answered: p.answered,
        totalMs: p.totalMs,
      })),
    };
  }

  /** Personlig, sensurert øyeblikksbilde. Riktig svar og andres valg skjules til avsløringen. */
  snapshot(viewer: Viewer, now: number): PublicState {
    const cur = this.current;
    const type = this.roundType;
    const showQuestion = !!cur && ['QUESTION', 'BUZZ_ANSWER', 'REVEAL', 'TARGETING'].includes(this.phase);
    const pid = viewer.playerId;
    const answeringPhase = this.phase === 'QUESTION' || this.phase === 'BUZZ_ANSWER';

    const players: PublicPlayer[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      characterId: p.characterId,
      variant: p.variant,
      ready: p.ready,
      connected: p.connected,
      left: p.left,
      view: p.view,
      isBot: p.isBot,
      score: p.score,
      lastDelta: p.lastDelta,
      streak: p.streak,
      hasAnswered: !!cur && answeringPhase && cur.answers.has(p.id) && cur.answers.get(p.id)!.choice != null,
      finalSteps: p.finalSteps,
    }));

    const t = this.targeting;
    const b = this.bomb;
    const myAnswer = pid && cur ? cur.answers.get(pid) : undefined;
    const canTarget = !!pid && this.phase === 'TARGETING' && !!t && t.eligible.includes(pid) && !t.chosen.has(pid);

    return {
      code: this.code,
      phase: this.phase,
      paused: this.paused,
      pausePending: this.pausePending,
      settings: { ...this.settings },
      hostId: this.hostId,
      players,
      round:
        type && this.roundIndex >= 0
          ? { index: this.roundIndex, total: this.rounds.length, type, name: ROUND_INFO[type].name, description: ROUND_INFO[type].description }
          : null,
      question: showQuestion
        ? {
            id: cur!.q.id,
            text: cur!.q.text,
            options: cur!.q.options,
            category: cur!.q.category,
            language: cur!.q.language,
            source: cur!.q.source,
            number: this.qInRound,
            total: type === 'bomb' || type === 'final' ? null : LENGTH_CONFIG[this.settings.length].questionsPerRound,
          }
        : null,
      deadline: this.paused ? null : this.shownDeadline,
      phaseStartedAt: this.phaseStartedAt,
      serverNow: now,
      reveal: this.reveal && ['REVEAL', 'TARGETING', 'ACTION_RESULT'].includes(this.phase) ? this.reveal : null,
      buzz: this.buzz && type === 'fastest' ? { order: [...this.buzz.order], activePlayerId: this.buzz.active, lockedOut: [...this.buzz.lockedOut] } : null,
      bomb: b
        ? {
            holderId: b.holderId,
            intensity: Math.min(1, Math.max(0, 1 - this.fuseLeft(now) / b.fuseTotal)),
            bombsLeft: b.bombsLeft,
            exploded: b.exploded,
          }
        : null,
      targeting: t ? { kind: t.kind, eligible: [...t.eligible], chosen: [...t.chosen.keys()] } : null,
      actions: this.phase === 'ACTION_RESULT' || (this.phase === 'QUESTION' && type === 'bomb') ? [...this.actions] : [],
      final: this.final ? { goal: this.final.goal, tiebreak: this.final.tiebreak, questionNo: this.final.questionNo, maxQuestions: this.final.maxQuestions } : null,
      ranking: this.phase === 'SCOREBOARD' || this.phase === 'CEREMONY' || this.phase === 'GAME_OVER' ? [...this.ranking] : [],
      winnerId: this.phase === 'CEREMONY' || this.phase === 'GAME_OVER' ? this.winnerId : null,
      stats: this.phase === 'CEREMONY' || this.phase === 'GAME_OVER' ? this.stats() : null,
      commentary: this.commentary,
      fx: [...this.fx],
      you: {
        playerId: pid,
        memberId: viewer.memberId,
        isHost: viewer.isHost,
        isScreen: viewer.isScreen,
        choice: myAnswer?.choice ?? null,
        canAnswer: !!pid && this.canAnswer(pid),
        canBuzz: !!pid && this.canBuzz(pid),
        canTarget,
        targetOptions: canTarget ? this.targetOptions(pid!) : [],
        chosenTarget: pid && t ? t.chosen.get(pid) ?? null : null,
      },
      warnings: this.phase === 'LOBBY' ? [...this.warnings] : [],
    };
  }

  /** For bots/simulator: gir riktig svar (aldri sendt til klienter før avsløring). */
  peekCorrectIndex(): number | null {
    return this.current?.q.correctIndex ?? null;
  }
}
