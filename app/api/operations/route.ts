import {validatePurchase} from '@/lib/purchases';
import {operationError} from '@/lib/operation-errors';
import {validateCustomer} from '@/lib/customer-validation';
import { requestDatabase } from '@/lib/supabase';
export async function GET(request: Request) { try {
    const db = requestDatabase(request);
    const { data: { user } } = await db.auth.getUser();
    if (!user)
        return Response.json({ error: 'Sign in required' }, { status: 401 });
    const { data, error } = await db.rpc('kinga_snapshot');
    if (error)
        return Response.json({ error: error.message }, { status: 403 });
    if(data.role==='driver'){const catalogue=await db.rpc('kinga_catalogue');if(!catalogue.error)data.products=catalogue.data.products;}
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
} }
const actions = ['opening_stock', 'import_customers', 'adjust_material', 'update_request', 'save_order', 'transition_order', 'record_payment', 'save_batch', 'post_batch', 'save_purchase', 'post_purchase', 'save_customer', 'update_customer', 'save_material', 'save_review', 'save_product', 'save_bundle', 'update_delivery', 'hold_lot', 'adjust_stock'];
export async function POST(request: Request) { try {
    const db = requestDatabase(request);
    const { data: { user } } = await db.auth.getUser();
    if (!user)
        return Response.json({ error: 'Sign in required' }, { status: 401 });
    const { action, data: submitted } = await request.json();
    let data=submitted;
    if (!actions.includes(action))
        return Response.json({ error: 'Unsupported operation' }, { status: 400 });
    if(['save_customer','update_customer'].includes(action)){
        const checked=validateCustomer(data||{});
        if(Object.keys(checked.errors).length)return Response.json({error:Object.values(checked.errors)[0],fieldErrors:checked.errors},{status:422});
        if(action==='update_customer'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(data.id||'')))return Response.json({error:'Select a customer to edit.'},{status:422});
        data={...checked.value,...(action==='update_customer'?{id:data.id}:{})};
    }
    if(action==='save_purchase'){try{data=validatePurchase(data||{},true);}catch(error){return Response.json({error:(error as Error).message},{status:422});}}
    if(action==='import_customers'){
        if(!Array.isArray(data?.rows)||!data.rows.length||data.rows.length>1000)return Response.json({error:'Import between 1 and 1,000 customers.'},{status:422});
        const rows=[];
        for(const [index,row] of data.rows.entries()){
            const checked=validateCustomer({...row,marketing_opt_out:true});
            if(Object.keys(checked.errors).length)return Response.json({error:`Row ${index+2}: ${Object.values(checked.errors)[0]}`},{status:422});
            rows.push(checked.value);
        }
        data={rows};
    }
    const { data: result, error } = await db.rpc('kinga_' + action, { p_data: data });
    if (error) {
        const failure=operationError(action,error);
        return Response.json({error:failure.message,fieldErrors:failure.fieldErrors},{status:failure.status});
    }
    return Response.json({ result });
}
catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
} }
