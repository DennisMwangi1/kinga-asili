import { requestDatabase } from '@/lib/supabase';
export async function POST(request: Request) { try {
    const d = await request.json();
    const { data, error } = await requestDatabase().rpc('kinga_public_request', { p_data: d });
    if (error)
        return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ reference: data }, { status: 201 });
}
catch {
    return Response.json({ error: 'We could not submit your request. Please try again.' }, { status: 503 });
} }
