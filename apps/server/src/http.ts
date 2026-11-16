import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { z } from 'zod';
import { importQuestionsCsv, importQuestionsJson } from '@podiepanikk/game-engine';
import { CATEGORIES, CHARACTER_IDS, categoryIdSchema, difficultySchema, questionInputSchema } from '@podiepanikk/shared';
import { AuthService, displayNameSchema, hashPassword, loginSchema, publicUser, registerSchema, verifyPassword } from './auth';
import type { Config } from './config';
import { BUILTIN_QUESTIONS } from './questions/bank';
import type { RoomManager } from './rooms';
import type { Store, UserRecord } from './store';

type AuthedRequest = Request & { user?: UserRecord };

/** Lokale IPv4-adresser, vanlige hjemmenett (192.168.x) først. */
export function lanAddresses(): string[] {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
    .filter((ip) => !ip.startsWith('169.254.'));
  const rank = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return [...new Set(ips)].sort((a, b) => rank(a) - rank(b));
}

const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86);

export function createHttpApp(deps: { config: Config; store: Store; auth: AuthService; rooms: RoomManager }) {
  const { config, store, auth, rooms } = deps;
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          // Ingen tredjepartsfonter/CDN-er: ingen IP-adresser lekkes til andre (GDPR).
          'style-src': ["'self'", "'unsafe-inline'"],
          'font-src': ["'self'", 'data:'],
          'img-src': ["'self'", 'data:', 'blob:'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'worker-src': ["'self'", 'blob:'],
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  // CSRF-vern: endrende API-kall må komme fra samme opprinnelse.
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers['x-forwarded-host'] ?? req.headers.host;
      const sameHost = (() => {
        try {
          return new URL(origin).host === host;
        } catch {
          return false;
        }
      })();
      if (!sameHost && !config.allowedOrigins.includes(origin)) return res.status(403).json({ error: 'Ugyldig opprinnelse' });
    }
    if (!req.is('application/json') && req.method !== 'DELETE') return res.status(415).json({ error: 'Forventer JSON' });
    next();
  });

  const apiLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false });
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'For mange forsøk – prøv igjen om litt.' } });
  app.use('/api', apiLimiter);

  const withUser = async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      req.user = (await auth.userFromCookie(req.headers.cookie)) ?? undefined;
      next();
    } catch (e) {
      next(e);
    }
  };
  const requireUser = (req: AuthedRequest, res: Response, next: NextFunction) => (req.user ? next() : res.status(401).json({ error: 'Du må logge inn' }));
  const requireAdmin = (req: AuthedRequest, res: Response, next: NextFunction) =>
    req.user?.role === 'admin' ? next() : res.status(req.user ? 403 : 401).json({ error: 'Krever administrator' });

  const ah = (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req as AuthedRequest, res).catch(next);

  app.get('/api/health', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size, store: store.kind }));

  app.get('/api/meta', (req, res) => {
    const counts: Record<string, number> = {};
    for (const q of BUILTIN_QUESTIONS) counts[q.difficulty] = (counts[q.difficulty] ?? 0) + 1;
    // Når storskjermen er åpnet som «localhost», trenger QR-koden PC-ens nettverksadresse.
    // Adressene oppgis kun til forespørsler fra maskinen selv (ikke ut på internett).
    // (Krever også localhost i Host-hodet, så en reverse proxy på samme maskin ikke utløser det.)
    const hostName = (req.headers.host ?? '').replace(/:\d+$/, '');
    const fromLocal =
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') && ['localhost', '127.0.0.1', '[::1]'].includes(hostName);
    const lanUrls = fromLocal ? lanAddresses().map((ip) => `http://${ip}:${req.socket.localPort}`) : [];
    res.json({ categories: CATEGORIES, builtinCounts: counts, allowBots: config.allowBots, lanUrls });
  });

  // ── Autentisering ──
  app.post('/api/auth/register', authLimiter, ah(async (req, res) => {
    const p = registerSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? 'Ugyldig' });
    if (await store.findUserByUsername(p.data.username)) return res.status(409).json({ error: 'Brukernavnet er opptatt' });
    const user = await store.createUser({
      username: p.data.username,
      passwordHash: await hashPassword(p.data.password),
      displayName: p.data.displayName,
      role: 'player', // roller kan aldri settes fra klienten
      characterId: p.data.characterId ?? 'krutt',
      showOnLeaderboard: false, // personvernvennlig standard
    });
    res.setHeader('Set-Cookie', auth.cookie(await auth.startSession(user.id)));
    res.status(201).json({ user: publicUser(user) });
  }));

  app.post('/api/auth/login', authLimiter, ah(async (req, res) => {
    const p = loginSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Feil brukernavn eller passord' });
    const user = await store.findUserByUsername(p.data.username);
    const ok = await verifyPassword(p.data.password, user?.passwordHash ?? DUMMY_HASH); // lik tidsbruk
    if (!user || !ok) return res.status(401).json({ error: 'Feil brukernavn eller passord' });
    res.setHeader('Set-Cookie', auth.cookie(await auth.startSession(user.id)));
    res.json({ user: publicUser(user) });
  }));

  app.post('/api/auth/logout', ah(async (req, res) => {
    await auth.logout(req.headers.cookie);
    res.setHeader('Set-Cookie', auth.clearCookie());
    res.json({ ok: true });
  }));

  app.get('/api/auth/me', withUser, (req: AuthedRequest, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

  // ── Profil ──
  app.get('/api/profile', withUser, requireUser, ah(async (req, res) => {
    const [stats, history] = await Promise.all([store.userStats(req.user!.id), store.userHistory(req.user!.id, 20)]);
    res.json({ user: publicUser(req.user!), stats, history });
  }));

  const profilePatch = z.object({
    displayName: displayNameSchema.optional(),
    characterId: z.string().refine((c) => CHARACTER_IDS.includes(c)).optional(),
    showOnLeaderboard: z.boolean().optional(),
  });
  app.patch('/api/profile', withUser, requireUser, ah(async (req, res) => {
    const p = profilePatch.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Ugyldige verdier' });
    const user = await store.updateUser(req.user!.id, p.data);
    res.json({ user: user ? publicUser(user) : null });
  }));

  app.delete('/api/profile', withUser, requireUser, ah(async (req, res) => {
    if (req.user!.role === 'admin') return res.status(400).json({ error: 'Administratorkontoer slettes via miljøvariabler/database' });
    await store.deleteUser(req.user!.id);
    res.setHeader('Set-Cookie', auth.clearCookie());
    res.json({ ok: true });
  }));

  // ── Toppliste (kun visningsnavn for spillere som selv har valgt å være med) ──
  app.get('/api/leaderboard', ah(async (req, res) => {
    const kind = z.enum(['wins', 'score', 'accuracy', 'games']).catch('wins').parse(req.query.kind);
    res.json({ kind, rows: await store.leaderboard(kind, 25) });
  }));

  // ── Administrasjon ──
  const admin = express.Router();
  admin.use(withUser, requireAdmin);
  const listQuery = z.object({
    active: z.enum(['true', 'false']).optional(),
    difficulty: difficultySchema.optional(),
    category: categoryIdSchema.optional(),
    search: z.string().max(100).optional(),
  });
  admin.get('/questions', ah(async (req, res) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return res.status(400).json({ error: 'Ugyldig filter' });
    const rows = await store.listQuestions({ ...q.data, active: q.data.active == null ? undefined : q.data.active === 'true' });
    res.json({ questions: rows, builtinCount: BUILTIN_QUESTIONS.length });
  }));
  admin.get('/builtin', (_req, res) => res.json({ questions: BUILTIN_QUESTIONS }));
  admin.post('/questions', ah(async (req, res) => {
    const p = questionInputSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues.map((i) => i.message).join('; ') });
    res.status(201).json({ question: await store.createQuestion(p.data) });
  }));
  admin.put('/questions/:id', ah(async (req, res) => {
    const p = questionInputSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues.map((i) => i.message).join('; ') });
    const q = await store.updateQuestion(String(req.params.id), p.data);
    if (!q) return res.status(404).json({ error: 'Fant ikke spørsmålet' });
    res.json({ question: q });
  }));
  admin.delete('/questions/:id', ah(async (req, res) => {
    const ok = await store.deleteQuestion(String(req.params.id));
    res.status(ok ? 200 : 404).json({ ok });
  }));
  admin.post('/questions/import', ah(async (req, res) => {
    const p = z.object({ format: z.enum(['csv', 'json']), data: z.string().max(1_500_000), dryRun: z.boolean().default(false) }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Ugyldig import' });
    const r = p.data.format === 'csv' ? importQuestionsCsv(p.data.data) : importQuestionsJson(p.data.data);
    if (r.valid.length > 2000) return res.status(400).json({ error: 'Maks 2000 spørsmål per import' });
    let imported = 0;
    if (!p.data.dryRun) for (const q of r.valid) (await store.createQuestion(q), imported++);
    res.json({ imported, valid: r.valid.length, errors: r.errors.slice(0, 100) });
  }));
  admin.get('/stats', (_req, res) => {
    const list = [...rooms.rooms.values()].map((r) => ({
      code: r.code,
      phase: r.engine.phase,
      players: r.engine.players.length,
      createdAt: r.createdAt,
    }));
    res.json({ rooms: list, store: store.kind });
  });
  app.use('/api/admin', admin);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ikke funnet' }));

  // ── Statisk frontend (produksjon) ──
  if (config.webDist && existsSync(config.webDist)) {
    app.use('/assets', express.static(resolve(config.webDist, 'assets'), { immutable: true, maxAge: '365d' }));
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(resolve(config.webDist!, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[http]', err);
    res.status(500).json({ error: 'Intern feil' });
  });

  return app;
}
