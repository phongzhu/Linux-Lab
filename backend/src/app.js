import express from 'express';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import lessonRoutes from './routes/lessonRoutes.js';
import attemptRoutes from './routes/attemptRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import freeTerminalRoutes from './routes/freeTerminalRoutes.js';
import { notFoundMiddleware } from './middleware/notFound.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';

const here = dirname(fileURLToPath(import.meta.url));
const sessionDirectory = resolve(here, '../database');
mkdirSync(sessionDirectory, { recursive: true });
const SQLiteStore = connectSqlite3(session);
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.nodeEnv === 'production' ? 1 : 'loopback');
app.use(express.json({ limit: '48kb' }));
app.use(session({
  name: 'linux.sid',
  store: new SQLiteStore({ dir: sessionDirectory, db: 'sessions.sqlite', table: 'sessions', concurrentDB: true }),
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 14 },
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/units', lessonRoutes);
app.use('/api/v1/lessons', lessonRoutes);
app.use('/api/v1/attempts', attemptRoutes);
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/terminal', freeTerminalRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
