import type { CategoryId, Difficulty, Question, QuestionInput } from '@podiepanikk/shared';

export type Role = 'player' | 'admin';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  characterId: string;
  showOnLeaderboard: boolean;
  createdAt: number;
}

export interface StoredQuestion extends Question {
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ResultRow {
  userId: string | null;
  characterId: string;
  score: number;
  rank: number;
  won: boolean;
  correct: number;
  answered: number;
  totalMs: number;
}

export interface GameRecord {
  id: string;
  code: string;
  mode: string;
  difficulty: Difficulty;
  length: string;
  playerCount: number;
  startedAt: number;
  endedAt: number;
  results: ResultRow[];
}

export interface UserStats {
  games: number;
  wins: number;
  totalScore: number;
  bestScore: number;
  correct: number;
  answered: number;
  accuracy: number | null;
  avgMs: number | null;
}

export interface HistoryRow {
  gameId: string;
  endedAt: number;
  difficulty: string;
  length: string;
  playerCount: number;
  rank: number;
  score: number;
  won: boolean;
}

export type LeaderboardKind = 'wins' | 'score' | 'accuracy' | 'games';

export interface LeaderboardRow {
  displayName: string;
  characterId: string;
  value: number;
  games: number;
}

export interface QuestionFilter {
  active?: boolean;
  difficulty?: Difficulty;
  category?: CategoryId;
  search?: string;
}

export interface Store {
  readonly kind: string;
  init(): Promise<void>;
  findUserByUsername(username: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(u: Omit<UserRecord, 'id' | 'createdAt'>): Promise<UserRecord>;
  updateUser(id: string, patch: Partial<Pick<UserRecord, 'displayName' | 'characterId' | 'showOnLeaderboard' | 'role' | 'passwordHash'>>): Promise<UserRecord | null>;
  deleteUser(id: string): Promise<void>;
  createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void>;
  getSession(tokenHash: string): Promise<{ userId: string; expiresAt: number } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  listQuestions(filter?: QuestionFilter): Promise<StoredQuestion[]>;
  getQuestion(id: string): Promise<StoredQuestion | null>;
  createQuestion(input: QuestionInput): Promise<StoredQuestion>;
  updateQuestion(id: string, input: QuestionInput): Promise<StoredQuestion | null>;
  deleteQuestion(id: string): Promise<boolean>;
  activeCustomQuestions(): Promise<Question[]>;
  saveGame(g: GameRecord): Promise<void>;
  userStats(userId: string): Promise<UserStats>;
  userHistory(userId: string, limit: number): Promise<HistoryRow[]>;
  leaderboard(kind: LeaderboardKind, limit: number): Promise<LeaderboardRow[]>;
}

export function emptyStats(): UserStats {
  return { games: 0, wins: 0, totalScore: 0, bestScore: 0, correct: 0, answered: 0, accuracy: null, avgMs: null };
}

export function computeStats(rows: ResultRow[]): UserStats {
  const s = emptyStats();
  let ms = 0;
  for (const r of rows) {
    s.games++;
    if (r.won) s.wins++;
    s.totalScore += r.score;
    s.bestScore = Math.max(s.bestScore, r.score);
    s.correct += r.correct;
    s.answered += r.answered;
    ms += r.totalMs;
  }
  s.accuracy = s.answered ? Math.round((s.correct / s.answered) * 1000) / 10 : null;
  s.avgMs = s.answered ? Math.round(ms / s.answered) : null;
  return s;
}

/** Minst så mange svar før man kommer på lista for svarprosent (hindrer «1 av 1 = 100 %»). */
export const ACCURACY_MIN_ANSWERS = 20;

export function leaderboardValue(kind: LeaderboardKind, s: UserStats): number | null {
  switch (kind) {
    case 'wins':
      return s.wins;
    case 'score':
      return s.bestScore;
    case 'games':
      return s.games;
    case 'accuracy':
      return s.answered >= ACCURACY_MIN_ANSWERS ? s.accuracy : null;
  }
}
