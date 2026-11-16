import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Config {
  port: number;
  host: string;
  isProd: boolean;
  databaseUrl?: string;
  dataFile?: string;
  adminUsername?: string;
  adminPassword?: string;
  allowBots: boolean;
  allowTimeScale: boolean;
  allowedOrigins: string[];
  trustProxy: boolean;
  webDist: string | null;
  sessionDays: number;
}

const here = dirname(fileURLToPath(import.meta.url));

function findWebDist(): string | null {
  const candidates = [resolve(here, '../../web/dist'), resolve(here, '../web/dist'), resolve(process.cwd(), 'apps/web/dist'), resolve(process.cwd(), '../web/dist')];
  return candidates.find((p) => existsSync(resolve(p, 'index.html'))) ?? null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProd = env.NODE_ENV === 'production';
  const bool = (v: string | undefined, def: boolean) => (v == null || v === '' ? def : ['1', 'true', 'yes'].includes(v.toLowerCase()));
  return {
    port: Number(env.PORT ?? 3001),
    host: env.HOST ?? '0.0.0.0',
    isProd,
    databaseUrl: env.DATABASE_URL || undefined,
    dataFile: env.DATA_FILE || (isProd ? undefined : resolve(process.cwd(), 'data/podiepanikk-dev.json')),
    adminUsername: env.ADMIN_USERNAME || undefined,
    adminPassword: env.ADMIN_PASSWORD || undefined,
    allowBots: bool(env.ALLOW_BOTS, !isProd),
    allowTimeScale: bool(env.ALLOW_TIME_SCALE, false),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    trustProxy: bool(env.TRUST_PROXY, isProd),
    webDist: env.WEB_DIST ? resolve(env.WEB_DIST) : findWebDist(),
    sessionDays: Number(env.SESSION_DAYS ?? 30),
  };
}
