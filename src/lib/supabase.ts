import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnon = ((import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string) || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && 
  (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
);

if (!isSupabaseConfigured) {
  console.warn('Supabase env vars missing — some features will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
