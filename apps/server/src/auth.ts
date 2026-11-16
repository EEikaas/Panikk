import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { CHARACTER_IDS } from '@podiepanikk/shared';
import type { Config } from './config';
import type { Store, UserRecord } from './store';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_COOKIE = 'pp_session';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64url');
  const key = await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length, SCRYPT);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export const newToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignorer */
    }
  }
  return out;
}

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.-]{3,24}$/, 'Brukernavn: 3–24 tegn (a–z, 0–9, _ . -)');
export const passwordSchema = z.string().min(8, 'Passordet må ha minst 8 tegn').max(200);
export const displayNameSchema = z
  .string()
  .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, '').trim())
  .pipe(z.string().min(1).max(16));
export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  characterId: z.string().refine((c) => CHARACTER_IDS.includes(c)).optional(),
});
export const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(200) });

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  characterId: string;
  showOnLeaderboard: boolean;
}

export const publicUser = (u: UserRecord): PublicUser => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  characterId: u.characterId,
  showOnLeaderboard: u.showOnLeaderboard,
});

export class AuthService {
  constructor(private store: Store, private config: Config) {}

  cookie(token: string): string {
    const maxAge = this.config.sessionDays * 86400;
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.config.isProd ? '; Secure' : ''}`;
  }
  clearCookie(): string {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${this.config.isProd ? '; Secure' : ''}`;
  }

  async startSession(userId: string): Promise<string> {
    const token = newToken();
    await this.store.createSession(userId, hashToken(token), Date.now() + this.config.sessionDays * 86400_000);
    return token;
  }

  async userFromCookie(header: string | undefined): Promise<UserRecord | null> {
    const token = parseCookies(header)[SESSION_COOKIE];
    if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
    const s = await this.store.getSession(hashToken(token));
    return s ? this.store.findUserById(s.userId) : null;
  }

  async logout(header: string | undefined): Promise<void> {
    const token = parseCookies(header)[SESSION_COOKIE];
    if (token) await this.store.deleteSession(hashToken(token));
  }

  /** Oppretter/oppdaterer administrator fra miljøvariabler ved oppstart. */
  async ensureAdmin(): Promise<void> {
    const { adminUsername, adminPassword } = this.config;
    if (!adminUsername || !adminPassword) return;
    if (adminPassword.length < 12) {
      console.warn('[auth] ADMIN_PASSWORD bør ha minst 12 tegn – administrator ble IKKE opprettet.');
      return;
    }
    const existing = await this.store.findUserByUsername(adminUsername);
    const passwordHash = await hashPassword(adminPassword);
    if (existing) await this.store.updateUser(existing.id, { role: 'admin', passwordHash });
    else await this.store.createUser({ username: adminUsername, passwordHash, displayName: 'Admin', role: 'admin', characterId: 'pling', showOnLeaderboard: false });
    console.log(`[auth] Administrator «${adminUsername}» er klar.`);
  }
}
