import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export function createPublicClient(accessToken) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  return createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers },
  });
}

export const createAuthClient = () => createPublicClient();
