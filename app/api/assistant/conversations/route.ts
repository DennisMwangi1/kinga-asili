import {requestDatabase} from '@/lib/supabase';
import {conversationIdValid,conversationMessages,conversationTitle} from '@/lib/assistant/history';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
async function authenticate(request:Request){
 const db=requestDatabase(request),{data:{user}}=await db.auth.getUser();
 if(!user)return {response:Response.json({error:'Sign in to view your conversations.'},{status:401,headers})};
 const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();
 if(!profile||!(process.env.ASSISTANT_ROLES||'admin').split(',').map(value=>value.trim()).includes(profile.role))return {response:Response.json({error:'Kinga AI is not enabled for your role.'},{status:403,headers})};
 return {db,user,role:profile.role};
}
function failure(error:{code?:string}){return Response.json({error:['42P01','PGRST205'].includes(error.code||'')?'Chat history is not configured. Apply the chat-history database update.':'Conversation history could not be saved or loaded. Please try again.'},{status:503,headers});}
export async function GET(request:Request){try{
 const auth=await authenticate(request);if(auth.response)return auth.response;
 const id=new URL(request.url).searchParams.get('id');
 if(id&&!conversationIdValid(id))return Response.json({error:'Choose a valid conversation.'},{status:400,headers});
 const query=auth.db!.from('assistant_conversations').select(id?'id,title,messages,created_at,updated_at':'id,title,created_at,updated_at').eq('owner_id',auth.user!.id).eq('workspace_role',auth.role);
 const {data,error}=id?await query.eq('id',id).maybeSingle():await query.order('updated_at',{ascending:false}).limit(100);
 if(error)return failure(error);if(id&&!data)return Response.json({error:'Conversation not found.'},{status:404,headers});
 return Response.json(id?{conversation:data}:{conversations:data},{headers});
}catch{return failure({});}}
export async function POST(request:Request){try{
 const auth=await authenticate(request);if(auth.response)return auth.response;
 const text=await request.text();if(text.length>2_000_000)return Response.json({error:'This conversation is too large. Start a new chat.'},{status:413,headers});
 let body;try{body=JSON.parse(text);}catch{return Response.json({error:'Invalid conversation.'},{status:400,headers});}
 if(!body||typeof body!=='object'||!conversationIdValid(body.id))return Response.json({error:'Choose a valid conversation.'},{status:400,headers});
 let messages;try{messages=conversationMessages(body.messages);}catch(error){return Response.json({error:(error as Error).message},{status:422,headers});}
 if(!messages.length)return Response.json({error:'Empty conversations are not saved.'},{status:422,headers});
 const {data:existing,error:readError}=await auth.db!.from('assistant_conversations').select('id').eq('id',body.id).eq('owner_id',auth.user!.id).eq('workspace_role',auth.role).maybeSingle();if(readError)return failure(readError);
 const fields={title:conversationTitle(messages),messages,updated_at:new Date().toISOString()};
 const mutation=existing?auth.db!.from('assistant_conversations').update(fields).eq('id',body.id).eq('owner_id',auth.user!.id).eq('workspace_role',auth.role):auth.db!.from('assistant_conversations').insert({id:body.id,owner_id:auth.user!.id,workspace_role:auth.role,...fields});
 const {data,error}=await mutation.select('id,title,created_at,updated_at').single();if(error)return failure(error);
 return Response.json({conversation:data},{headers});
}catch{return failure({});}}
