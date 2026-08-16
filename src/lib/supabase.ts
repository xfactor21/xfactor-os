import { createClient } from '@supabase/supabase-js';

/**
 * Supabase is optional for the local-first xFactor.OS release. Production
 * cloud sync/auth is enabled only when both Vite environment variables are
 * supplied by the deployment. No project URL, publishable key, secret, or
 * credential is embedded in source control.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// createClient validates its arguments eagerly. When cloud services are not
// configured we still construct an inert client so modules can import the
// singleton safely; callers check `supabaseConfigured` before network work.
export const supabase = createClient(
  SUPABASE_URL || 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY || 'local-only-disabled',
  { auth: { persistSession: supabaseConfigured, autoRefreshToken: supabaseConfigured } },
);
