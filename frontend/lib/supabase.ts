import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedClient: any = null;

function getSupabaseClient() {
  if (!cachedClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return cachedClient;
}

export const supabase: any = new Proxy({} as any, {
  get(_target, prop) {
    const client = getSupabaseClient() as Record<PropertyKey, unknown>;
    return client[prop];
  },
});
