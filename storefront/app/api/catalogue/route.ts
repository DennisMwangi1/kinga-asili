import { requestDatabase } from '@/lib/supabase';
export async function GET() { try {
    const { data, error } = await requestDatabase().rpc('kinga_catalogue');
    if (error)
        throw error;
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
catch {
    return Response.json({ error: 'The catalogue is not connected yet. Please contact Kinga to order.' }, { status: 503 });
} }
