import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Backend = { status: 'ready'; client: SupabaseClient } | { status: 'unconfigured' } | { status: 'error'; message: string };
export function configureBackend(url?: string, key?: string): Backend {
  if (!url && !key) return { status: 'unconfigured' };
  try {
    if (!url || !key) throw new Error('Both Supabase settings are required.');
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw new Error('Use HTTPS for hosted Supabase.');
    if (key.startsWith('sb_secret_')) throw new Error('Use a publishable key, never a secret key.');
    if (!key.startsWith('sb_publishable_')) {
      const payload = JSON.parse(atob(key.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error('Only a publishable or anon key may be used in the browser.');
    }
    return { status: 'ready', client: createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) };
  } catch { return { status: 'error', message: 'Project storage is not configured correctly. Check the Supabase URL and browser-safe publishable key.' }; }
}
