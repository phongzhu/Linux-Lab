import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, '../../.env') });
dotenv.config({ path: resolve(here, '../../../frontend/.env.local') });

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  supabaseUrl: process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY,
  sessionSecret: process.env.SESSION_SECRET || 'local-development-only-change-before-deploying',
};

export function assertEnvironment() {
  if (!env.supabaseUrl || !env.supabaseKey) throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env.');
  if (env.nodeEnv === 'production' && env.sessionSecret === 'local-development-only-change-before-deploying') throw new Error('Set SESSION_SECRET in the production environment.');
}
