import { createClient } from '@supabase/supabase-js';
export function requestDatabase() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; if (!url || !key)
    throw Error('Kinga catalogue is not configured'); return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
