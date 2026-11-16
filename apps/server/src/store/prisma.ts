import { randomUUID } from 'node:crypto';
import type { CategoryId, Difficulty, Language, Question, QuestionInput } from '@podiepanikk/shared';
import {
  computeStats,
  leaderboardValue,
  type GameRecord,
  type HistoryRow,
  type LeaderboardKind,
  type LeaderboardRow,
  type QuestionFilter,
  type Role,
  type Store,
  type StoredQuestion,
  type UserRecord,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type DbUser = { id: string; username: string; passwordHash: string; displayName: string; role: string; characterId: string; showOnLeaderboard: boolean; createdAt: Date };
type DbQuestion = { id: string; text: string; options: string[]; correctIndex: number; category: string; difficulty: string; language: string; source: string | null; active: boolean; createdAt: Date; updatedAt: Date };

const toUser = (u: DbUser): UserRecord => ({ ...u, role: u.role as Role, createdAt: u.createdAt.getTime() });
const toQuestion = (q: DbQuestion): StoredQuestion => ({
  id: q.id,
  text: q.text,
  options: q.options as Question['options'],
  correctIndex: q.correctIndex as Question['correctIndex'],
  category: q.category as CategoryId,
  difficulty: q.difficulty as Difficulty,
  language: q.language as Language,
  source: q.source ?? undefined,
  active: q.active,
  createdAt: q.createdAt.getTime(),
  updatedAt: q.updatedAt.getTime(),
});

/** PostgreSQL via Prisma. Aktiveres når DATABASE_URL er satt. */
export class PrismaStore implements Store {
  readonly kind = 'PostgreSQL (Prisma)';
  private db: any;

  async init(): Promise<void> {
    const mod: any = await import('@prisma/client');
    const PrismaClient = mod.PrismaClient ?? mod.default?.PrismaClient;
    this.db = new PrismaClient();
    await this.db.$connect();
  }

  async findUserByUsername(username: string) {
    const u = await this.db.user.findUnique({ where: { username: username.toLowerCase() } });
    return u ? toUser(u) : null;
  }
  async findUserById(id: string) {
    const u = await this.db.user.findUnique({ where: { id } });
    return u ? toUser(u) : null;
  }
  async createUser(u: Omit<UserRecord, 'id' | 'createdAt'>) {
    return toUser(await this.db.user.create({ data: { ...u, username: u.username.toLowerCase() } }));
  }
  async updateUser(id: string, patch: Partial<UserRecord>) {
    try {
      return toUser(await this.db.user.update({ where: { id }, data: patch }));
    } catch {
      return null;
    }
  }
  async deleteUser(id: string) {
    // Sesjoner slettes (cascade), resultater anonymiseres (SetNull).
    await this.db.user.delete({ where: { id } }).catch(() => undefined);
  }
  async createSession(userId: string, tokenHash: string, expiresAt: number) {
    await this.db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.db.session.create({ data: { userId, tokenHash, expiresAt: new Date(expiresAt) } });
  }
  async getSession(tokenHash: string) {
    const s = await this.db.session.findUnique({ where: { tokenHash } });
    if (!s || s.expiresAt.getTime() < Date.now()) return null;
    return { userId: s.userId, expiresAt: s.expiresAt.getTime() };
  }
  async deleteSession(tokenHash: string) {
    await this.db.session.deleteMany({ where: { tokenHash } });
  }

  async listQuestions(f: QuestionFilter = {}) {
    const rows = await this.db.question.findMany({
      where: {
        active: f.active,
        difficulty: f.difficulty,
        category: f.category,
        text: f.search ? { contains: f.search, mode: 'insensitive' } : undefined,
      },
      orderBy: { updatedAt: 'desc' },
      take: 2000,
    });
    return rows.map(toQuestion);
  }
  async getQuestion(id: string) {
    const q = await this.db.question.findUnique({ where: { id } });
    return q ? toQuestion(q) : null;
  }
  async createQuestion(input: QuestionInput) {
    return toQuestion(await this.db.question.create({ data: { ...input, id: `custom-${randomUUID()}` } }));
  }
  async updateQuestion(id: string, input: QuestionInput) {
    try {
      return toQuestion(await this.db.question.update({ where: { id }, data: input }));
    } catch {
      return null;
    }
  }
  async deleteQuestion(id: string) {
    const r = await this.db.question.deleteMany({ where: { id } });
    return r.count > 0;
  }
  async activeCustomQuestions(): Promise<Question[]> {
    const rows = await this.db.question.findMany({ where: { active: true } });
    return rows.map(toQuestion).map(({ active, createdAt, updatedAt, ...q }: StoredQuestion) => q);
  }

  async saveGame(g: GameRecord) {
    await this.db.game.create({
      data: {
        id: g.id,
        code: g.code,
        mode: g.mode,
        difficulty: g.difficulty,
        length: g.length,
        playerCount: g.playerCount,
        startedAt: new Date(g.startedAt),
        endedAt: new Date(g.endedAt),
        results: { create: g.results },
      },
    });
  }
  private async rowsFor(userId: string) {
    return this.db.gameResult.findMany({ where: { userId } });
  }
  async userStats(userId: string) {
    return computeStats(await this.rowsFor(userId));
  }
  async userHistory(userId: string, limit: number): Promise<HistoryRow[]> {
    const rows = await this.db.gameResult.findMany({ where: { userId }, include: { game: true }, orderBy: { game: { endedAt: 'desc' } }, take: limit });
    return rows.map((r: any) => ({
      gameId: r.gameId,
      endedAt: r.game.endedAt.getTime(),
      difficulty: r.game.difficulty,
      length: r.game.length,
      playerCount: r.game.playerCount,
      rank: r.rank,
      score: r.score,
      won: r.won,
    }));
  }
  async leaderboard(kind: LeaderboardKind, limit: number): Promise<LeaderboardRow[]> {
    const users = await this.db.user.findMany({ where: { showOnLeaderboard: true }, include: { results: true }, take: 5000 });
    const rows: LeaderboardRow[] = [];
    for (const u of users) {
      const s = computeStats(u.results);
      const value = leaderboardValue(kind, s);
      if (value != null && s.games > 0) rows.push({ displayName: u.displayName, characterId: u.characterId, value, games: s.games });
    }
    return rows.sort((a, b) => b.value - a.value || b.games - a.games).slice(0, limit);
  }
}
