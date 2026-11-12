import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=async path=>ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const historyUrl=url(await compile('../lib/assistant/history.ts'));
const {conversationMessages,conversationTitle}=await import(historyUrl);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const message=(content='Review this week',role='user')=>({id:id(10),role,content});
test('conversation records preserve messages and saved-action results but discard unknown fields',()=>{const input=[{...message(),owner_id:'another staff member'},{id:id(11),role:'assistant',content:'Stock reviewed',execution:{status:'complete',total:1,saved:1,alreadyApplied:0,failed:0,items:[{index:0,action:'hold_lot',summary:'Release stock',status:'saved'}],message:'Saved'}}];const clean=conversationMessages(input);assert.equal(clean.length,2);assert.equal(clean[0].owner_id,undefined);assert.equal(clean[1].execution.saved,1);assert.equal(conversationTitle(clean),'Review this week');assert.equal(conversationTitle([message(' a\n   long title ')]),'a long title');});
test('invalid conversations and malformed saved proposals fail validation',()=>{for(const input of [null,[{...message(),role:'system'}],[{...message(),id:'invalid'}],Array.from({length:501},()=>message()),[{...message(),content:'a'.repeat(120001)}],[{...message(),proposal:{action:'batch',summary:'Bad',token:'signed',data:{changes:[{}]}}}]])assert.throws(()=>conversationMessages(input));});
const records=new Map();let actor='owner',role='admin',signedIn=true;
const db={auth:{getUser:async()=>({data:{user:signedIn?{id:actor}:null}})},from(table){
 if(table==='profiles')return {select(){return this},eq(){return this},single:async()=>({data:{role}})};
 const filters=[],query={operation:'read',fields:null,inserted:null,select(){return this},eq(key,value){filters.push([key,value]);return this},order(){return this},limit(){return this},insert(value){this.operation='insert';this.inserted=value;return this},update(value){this.operation='update';this.fields=value;return this},async result(single){
  let rows=[...records.values()].filter(row=>filters.every(([key,value])=>row[key]===value));
  if(this.operation==='insert'){if(records.has(this.inserted.id))return {error:{code:'23505'}};const record={created_at:new Date().toISOString(),...this.inserted};records.set(record.id,record);rows=[record];}
  if(this.operation==='update')rows=rows.map(row=>{const next={...row,...this.fields};records.set(row.id,next);return next;});
  return {data:single?rows[0]||null:rows,error:null};},maybeSingle(){return this.result(true)},single(){return this.result(true)},then(resolve,reject){return this.result(false).then(resolve,reject)}};return query;
}};
globalThis.__kingaConversationDb=db;
const dbUrl=url('export const requestDatabase=()=>globalThis.__kingaConversationDb');
const {GET,POST}=await import(url((await compile('../app/api/assistant/conversations/route.ts')).replaceAll("'@/lib/supabase'",JSON.stringify(dbUrl)).replaceAll("'@/lib/assistant/history'",JSON.stringify(historyUrl))));
const save=body=>POST(new Request('http://localhost/api/assistant/conversations',{method:'POST',body:JSON.stringify(body)}));
const get=(query='')=>GET(new Request('http://localhost/api/assistant/conversations'+query));
test('saved conversations can be listed, restored and continued without creating duplicate rows',async()=>{records.clear();const conversationId=id(1);assert.equal((await save({id:conversationId,messages:[message()],owner_id:'other'})).status,200);assert.equal(records.get(conversationId).owner_id,'owner');assert.equal((await (await get()).json()).conversations.length,1);assert.equal((await (await get('?id='+conversationId)).json()).conversation.messages[0].content,'Review this week');assert.equal((await save({id:conversationId,messages:[message(),{id:id(11),role:'assistant',content:'Ready'}]})).status,200);assert.equal(records.size,1);assert.equal(records.get(conversationId).messages.length,2);});
test('history never exposes or overwrites another staff member’s conversation',async()=>{actor='other';try{assert.deepEqual((await (await get()).json()).conversations,[]);assert.equal((await get('?id='+id(1))).status,404);assert.notEqual((await save({id:id(1),messages:[message('Overwrite')]})).status,200);assert.equal(records.get(id(1)).owner_id,'owner');assert.equal(records.get(id(1)).messages[0].content,'Review this week');}finally{actor='owner';}});
test('changing a staff role hides their previous privileged conversations',async()=>{role='sales';const previous=process.env.ASSISTANT_ROLES;process.env.ASSISTANT_ROLES='admin,sales';try{assert.deepEqual((await (await get()).json()).conversations,[]);assert.equal((await get('?id='+id(1))).status,404);}finally{role='admin';if(previous===undefined)delete process.env.ASSISTANT_ROLES;else process.env.ASSISTANT_ROLES=previous;}});
test('authentication, permissions and validation are enforced for history requests',async()=>{signedIn=false;assert.equal((await get()).status,401);signedIn=true;role='driver';assert.equal((await get()).status,403);role='admin';assert.equal((await get('?id=bad')).status,400);assert.equal((await save(null)).status,400);assert.equal((await save({id:id(3),messages:[]})).status,422);});
