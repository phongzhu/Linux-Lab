import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import connectSqlite3 from 'connect-sqlite3';
import pg from 'pg';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertEnvironment, env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import lessonRoutes from './routes/lessonRoutes.js';
import attemptRoutes from './routes/attemptRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import freeTerminalRoutes from './routes/freeTerminalRoutes.js';
import { notFoundMiddleware } from './middleware/notFound.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';

const here = dirname(fileURLToPath(import.meta.url));
assertEnvironment();

let sessionStore;
let sessionPool;
if (env.databaseUrl) {
  const { Pool } = pg;
  const PostgresStore = connectPgSimple(session);
  sessionPool = new Pool({
    connectionString: env.databaseUrl,
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
    // Supabase's pooler can present a certificate chain that Node's
    // serverless runtime does not trust. Keep TLS encryption enabled while
    // matching PostgreSQL's `sslmode=require` behavior.
    ssl: { rejectUnauthorized: false },
  });
  sessionStore = new PostgresStore({
    pool: sessionPool,
    schemaName: 'public',
    tableName: 'linuxlab_sessions',
    createTableIfMissing: false,
    pruneSessionInterval: 900,
  });
} else {
  const sessionDirectory = resolve(here, '../database');
  mkdirSync(sessionDirectory, { recursive: true });
  const SQLiteStore = connectSqlite3(session);
  sessionStore = new SQLiteStore({ dir: sessionDirectory, db: 'sessions.sqlite', table: 'sessions', concurrentDB: true });
}
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.nodeEnv === 'production' ? 1 : 'loopback');
app.use(express.json({ limit: '48kb' }));
app.use(session({
  name: 'linux.sid',
  store: sessionStore,
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 14 },
}));

app.get('/api/health', (_req, res) => {
  if (!sessionPool) return res.json({ ok: true, sessionStore: 'sqlite' });
  sessionPool.query("SELECT to_regclass('public.linuxlab_sessions') IS NOT NULL AS ready")
    .then(({ rows }) => rows[0]?.ready
      ? res.json({ ok: true, sessionStore: 'postgres' })
      : res.status(503).json({ ok: false, sessionStore: 'postgres', message: 'Session table is not installed.' }))
    .catch(() => res.status(503).json({ ok: false, sessionStore: 'postgres' }));
});
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/units', lessonRoutes);
app.use('/api/v1/lessons', lessonRoutes);
app.use('/api/v1/attempts', attemptRoutes);
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/terminal', freeTerminalRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
