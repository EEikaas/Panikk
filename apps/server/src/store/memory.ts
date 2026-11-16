import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Question, QuestionInput } from '@podiepanikk/shared';
import {
  computeStats,
  leaderboardValue,
  type GameRecord,
  type HistoryRow,
  type LeaderboardKind,
  type LeaderboardRow,
  type QuestionFilter,
  type Store,
  type StoredQuestion,
  type UserRecord,
} from './types';

interface Data {
  users: UserRecord[];
  sessions: { tokenHash: string; userId: string; expiresAt: number }[];
  questions: StoredQuestion[];
  games: GameRecord[];
}

/**
 * Lagring i minnet, valgfritt speilet til en JSON-fil (DATA_FILE).
 * Egnet for lokal utvikling, tester og små installasjoner. Bruk PostgreSQL i produksjon.
 */
export class MemoryStore implements Store {
  readonly kind: string;
  private d: Data = { users: [], sessions: [], questions: [], games: [] };
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private file?: string) {
    this.kind = file ? `fil (${file})` : 'minne';
  }

  async init(): Promise<void> {
    if (!this.file) return;
    try {
      this.d = { ...this.d, ...JSON.parse(await readFile(this.file, 'utf8')) };
    } catch {
      /* ny fil */
    }
  }

  private persist(): void {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      const tmp = `${this.file}.tmp`;
      await mkdir(dirname(this.file!), { recursive: true });
      await writeFile(tmp, JSON.stringify(this.d));
      await rename(tmp, this.file!);
    }, 300);
  }

  async findUserByUsername(username: string) {
    return this.d.users.find((u) => u.username === username.toLowerCase()) ?? null;
  }
  async findUserById(id: string) {
    return this.d.users.find((u) => u.id === id) ?? null;
  }
  async createUser(u: Omit<UserRecord, 'id' | 'createdAt'>) {
    const rec: UserRecord = { ...u, username: u.username.toLowerCase(), id: randomUUID(), createdAt: Date.now() };
    this.d.users.push(rec);
    this.persist();
    return rec;
  }
  async updateUser(id: string, patch: Partial<UserRecord>) {
    const u = this.d.users.find((x) => x.id === id);
    if (!u) return null;
    Object.assign(u, patch);
    this.persist();
    return u;
  }
  async deleteUser(id: string) {
    this.d.users = this.d.users.filter((u) => u.id !== id);
    this.d.sessions = this.d.sessions.filter((s) => s.userId !== id);
    // Resultater anonymiseres (spillstatistikken for andre spillere bevares).
    for (const g of this.d.games) for (const r of g.results) if (r.userId === id) r.userId = null;
    this.persist();
  }
  async createSession(userId: string, tokenHash: string, expiresAt: number) {
    const now = Date.now();
    this.d.sessions = this.d.sessions.filter((s) => s.expiresAt > now);
    this.d.sessions.push({ userId, tokenHash, expiresAt });
    this.persist();
  }
  async getSession(tokenHash: string) {
    const s = this.d.sessions.find((x) => x.tokenHash === tokenHash);
    return s && s.expiresAt > Date.now() ? { userId: s.userId, expiresAt: s.expiresAt } : null;
  }
  async deleteSession(tokenHash: string) {
    this.d.sessions = this.d.sessions.filter((s) => s.tokenHash !== tokenHash);
    this.persist();
  }

  async listQuestions(f: QuestionFilter = {}) {
    const s = f.search?.toLowerCase();
    return this.d.questions
      .filter(
        (q) =>
          (f.active === undefined || q.active === f.active) &&
          (!f.difficulty || q.difficulty === f.difficulty) &&
          (!f.category || q.category === f.category) &&
          (!s || q.text.toLowerCase().includes(s)),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async getQuestion(id: string) {
    return this.d.questions.find((q) => q.id === id) ?? null;
  }
  async createQuestion(input: QuestionInput) {
    const now = Date.now();
    const q: StoredQuestion = {
      ...input,
      correctIndex: input.correctIndex as Question['correctIndex'],
      options: input.options as Question['options'],
      id: `custom-${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    };
    this.d.questions.push(q);
    this.persist();
    return q;
  }
  async updateQuestion(id: string, input: QuestionInput) {
    const q = this.d.questions.find((x) => x.id === id);
    if (!q) return null;
    Object.assign(q, input, { updatedAt: Date.now() });
    this.persist();
    return q;
  }
  async deleteQuestion(id: string) {
    const before = this.d.questions.length;
    this.d.questions = this.d.questions.filter((q) => q.id !== id);
    this.persist();
    return this.d.questions.length < before;
  }
  async activeCustomQuestions(): Promise<Question[]> {
    return this.d.questions.filter((q) => q.active).map(({ active, createdAt, updatedAt, ...q }) => q);
  }

  async saveGame(g: GameRecord) {
    this.d.games.push(g);
    if (this.d.games.length > 20000) this.d.games.shift();
    this.persist();
  }
  private rowsFor(userId: string) {
    return this.d.games.flatMap((g) => g.results.filter((r) => r.userId === userId));
  }
  async userStats(userId: string) {
    return computeStats(this.rowsFor(userId));
  }
  async userHistory(userId: string, limit: number): Promise<HistoryRow[]> {
    return this.d.games
      .filter((g) => g.results.some((r) => r.userId === userId))
      .sort((a, b) => b.endedAt - a.endedAt)
      .slice(0, limit)
      .map((g) => {
        const r = g.results.find((x) => x.userId === userId)!;
        return { gameId: g.id, endedAt: g.endedAt, difficulty: g.difficulty, length: g.length, playerCount: g.playerCount, rank: r.rank, score: r.score, won: r.won };
      });
  }
  async leaderboard(kind: LeaderboardKind, limit: number): Promise<LeaderboardRow[]> {
    const rows: LeaderboardRow[] = [];
    for (const u of this.d.users.filter((x) => x.showOnLeaderboard)) {
      const s = computeStats(this.rowsFor(u.id));
      const value = leaderboardValue(kind, s);
      if (value != null && s.games > 0) rows.push({ displayName: u.displayName, characterId: u.characterId, value, games: s.games });
    }
    return rows.sort((a, b) => b.value - a.value || b.games - a.games).slice(0, limit);
  }
}
