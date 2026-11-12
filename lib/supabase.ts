import { createClient } from '@supabase/supabase-js';
export function browserDatabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && key ? createClient(url, key) : null;
}
export function requestDatabase(request: Request) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
        throw Error('Kinga database is not configured. Contact your administrator to complete setup.');
    const token = request.headers.get('authorization');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: token ? { Authorization: token } : {} } });
}
