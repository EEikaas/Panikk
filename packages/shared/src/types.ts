// Felles typer for server, spillmotor og klienter.

export type DisplayMode = 'screen' | 'mobile' | 'mixed';
export type Difficulty = 'barn' | 'familie' | 'voksen';
export type GameLength = 'kort' | 'normal' | 'lang';
export type RoundType = 'fastest' | 'collector' | 'thief' | 'bomb' | 'pie' | 'final';
export type ViewMode = 'controller' | 'full';
export type Language = 'nb' | 'en';
export type BotLevel = 'lett' | 'middels' | 'vanskelig';

export type CategoryId =
  | 'generelt'
  | 'geografi'
  | 'historie'
  | 'vitenskap'
  | 'filmtv'
  | 'musikk'
  | 'sport'
  | 'dyr'
  | 'mat'
  | 'teknologi'
  | 'norge'
  | 'voksen18'
  | 'blandet';

export type Phase =
  | 'LOBBY'
  | 'INTRO'
  | 'ROUND_INTRO'
  | 'QUESTION'
  | 'BUZZ_ANSWER'
  | 'REVEAL'
  | 'TARGETING'
  | 'ACTION_RESULT'
  | 'SCOREBOARD'
  | 'CEREMONY'
  | 'GAME_OVER';

export interface GameSettings {
  displayMode: DisplayMode;
  difficulty: Difficulty;
  length: GameLength;
  maxPlayers: number; // 2–12
  categories: CategoryId[]; // tom liste = alle
  useExternal: boolean;
  /** Enspillermodus: én menneskelig spiller mot datastyrte motstandere. */
  solo?: boolean;
  /** Styrken til datastyrte motstandere (solomodus). */
  botLevel?: BotLevel;
  /** Kun for tester/simulator – ignoreres av serveren uten ALLOW_TIME_SCALE. */
  timeScale?: number;
}

export interface Question {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  category: CategoryId;
  difficulty: Difficulty;
  language: Language;
  source?: string;
}

export type FxType =
  | 'join'
  | 'roundStart'
  | 'questionStart'
  | 'buzz'
  | 'answerLocked'
  | 'correct'
  | 'wrong'
  | 'timeout'
  | 'steal'
  | 'pie'
  | 'bombPass'
  | 'explode'
  | 'finalStep'
  | 'tiebreak'
  | 'winner'
  | 'scoreboard';

export interface FxEvent {
  id: number;
  type: FxType;
  playerId?: string;
  targetId?: string;
  amount?: number;
}

export type CommentaryMood = 'happy' | 'sad' | 'drama' | 'funny' | 'neutral';

export interface Commentary {
  id: number;
  text: string;
  mood: CommentaryMood;
}

export interface PublicPlayer {
  id: string;
  name: string;
  characterId: string;
  variant: number;
  ready: boolean;
  connected: boolean;
  left: boolean;
  view: ViewMode;
  isBot: boolean;
  score: number;
  lastDelta: number;
  streak: number;
  hasAnswered: boolean;
  finalSteps: number;
}

export interface PublicQuestion {
  id: string;
  text: string;
  options: [string, string, string, string];
  category: CategoryId;
  language: Language;
  source?: string;
  number: number; // 1-basert i runden
  total: number | null; // null = ubestemt (bombe/finale)
}

export interface RevealResult {
  playerId: string;
  choice: number | null;
  correct: boolean;
  delta: number;
  ms: number | null;
}

export interface ActionResult {
  kind: 'steal' | 'pie' | 'bombPass' | 'explode';
  fromId: string | null;
  toId: string;
  amount: number;
}

export interface PlayerStats {
  playerId: string;
  correct: number;
  answered: number;
  avgMs: number | null;
  bestStreak: number;
}

export interface YouState {
  playerId: string | null;
  memberId: string;
  isHost: boolean;
  isScreen: boolean;
  choice: number | null;
  canAnswer: boolean;
  canBuzz: boolean;
  canTarget: boolean;
  targetOptions: string[];
  chosenTarget: string | null;
}

export interface PublicState {
  code: string;
  phase: Phase;
  paused: boolean;
  pausePending: boolean;
  settings: GameSettings;
  hostId: string;
  players: PublicPlayer[];
  round: { index: number; total: number; type: RoundType; name: string; description: string } | null;
  question: PublicQuestion | null;
  deadline: number | null;
  phaseStartedAt: number;
  serverNow: number;
  reveal: { correctIndex: number; results: RevealResult[] } | null;
  buzz: { order: string[]; activePlayerId: string | null; lockedOut: string[] } | null;
  bomb: { holderId: string; intensity: number; bombsLeft: number; exploded: boolean } | null;
  targeting: { kind: 'steal' | 'pie' | 'bomb'; eligible: string[]; chosen: string[] } | null;
  actions: ActionResult[];
  final: { goal: number; tiebreak: string[] | null; questionNo: number; maxQuestions: number } | null;
  ranking: string[];
  winnerId: string | null;
  stats: PlayerStats[] | null;
  commentary: Commentary | null;
  fx: FxEvent[];
  you: YouState;
  warnings: string[];
}
