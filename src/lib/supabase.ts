import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Typed Supabase client, initialized once at module load.
 *
 * Fails loudly and immediately if the required env vars are absent, rather
 * than letting the app boot into a broken state where every query throws a
 * confusing runtime error later. EXPO_PUBLIC_* vars are inlined into the
 * client bundle by Expo/Metro at build time; see .env.example.
 *
 * Once `supabase gen types typescript` has been run against
 * supabase/migrations, replace `SupabaseClient` below with
 * `SupabaseClient<Database>` (generated Database type) to get typed
 * query results end-to-end. Left untyped here deliberately — generating
 * that type is not part of this scaffold.
 */

function readRequiredEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Remy cannot start: missing required environment variable "${name}". ` +
        'Copy .env.example to .env and fill in your Supabase project credentials.',
    );
  }

  return value;
}

const supabaseUrl = readRequiredEnvVar(
  'EXPO_PUBLIC_SUPABASE_URL',
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);

const supabaseAnonKey = readRequiredEnvVar(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    /**
     * REQUIRED on React Native — persistSession has no effect without it.
     * supabase-js defaults its session store to localStorage, which does
     * not exist on native, so the session would be dropped on every cold
     * start and every RLS-scoped query would silently run as anon. Passing
     * AsyncStorage is what makes persistSession true actually mean it.
     */
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
