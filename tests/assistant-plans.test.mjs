import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=async path=>ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const plansUrl=url(await compile('../lib/assistant/plans.ts'));
const {bulkHoldRequest,validateChanges,createPlanExecutor}=await import(plansUrl);
const domainUrl=url(await compile('../shared/domain.ts'));
const kingaSource=(await compile('../lib/assistant/kinga.ts')).replaceAll("'./plans'",JSON.stringify(plansUrl)).replaceAll("'@/lib/domain'",JSON.stringify(domainUrl));
const {signProposal,verifyProposal}=await import(url(kingaSource));
process.env.ASSISTANT_PROPOSAL_SECRET='isolated-assistant-plan-test-key';
const uuid=index=>'00000000-0000-4000-8000-'+String(index).padStart(12,'0');
const snapshot={products:[{id:'glt',blend:'GLT',volume_ml:60},{id:'got',blend:'GOT',volume_ml:120}],lots:Array.from({length:6},(_,i)=>({id:uuid(i+1),product_id:i<3?'glt':'got',batch_id:i<3?'batch-a':'batch-b',batch_reference:i<3?'GLT-01':'GOT-01',held:true,quantity:20,reserved:0}))};
const plan=()=>bulkHoldRequest('Release all held stock',[],snapshot);

test('all stock holds become one group containing all six records',()=>{
 const group=plan();assert.equal(group.action,'batch');assert.equal(group.data.changes.length,6);
 assert.equal(new Set(group.data.changes.map(change=>change.data.id)).size,6);
 assert.ok(group.data.changes.every(change=>change.data.held===false));
 assert.ok(group.data.changes.every(change=>!change.data.reason.includes('review complete')));
});
test('all of them follows the release question and ignores already released stock',()=>{
 const current={...snapshot,lots:snapshot.lots.map((stock,i)=>({...stock,held:i!==0}))};
 const group=bulkHoldRequest('all of them',[{role:'assistant',content:'Which batch stock holds would you like me to release?'}],current);
 assert.equal(group.data.changes.length,5);assert.ok(!group.data.changes.some(change=>change.data.id===uuid(1)));
 assert.equal(bulkHoldRequest('all of them',[{role:'assistant',content:'Which orders should I cancel?'}],current),null);
});
test('negated and subset requests do not release all stock',()=>{
 for(const message of ['Do not release all held stock','Release all except GLT','Release only the first stock entry','Release all GLT held stock','How do I release all held stock?','Release all stock from GLT-01'])assert.equal(bulkHoldRequest(message,[],snapshot),null);
});
test('every member of a group is role-checked before signing',()=>{
 assert.throws(()=>signProposal('sales-user','sales',plan()),/outside your role/);
 assert.equal(validateChanges(plan(),'stock_keeper').length,6);
 const invalid={action:'batch',summary:'Mixed access',data:{changes:[{action:'save_customer',summary:'Customer',data:{name:'Customer'}},{action:'hold_lot',summary:'Release',data:{id:uuid(1),held:false}}]}};
 assert.throws(()=>validateChanges(invalid,'sales'),/outside your role/);
 assert.throws(()=>validateChanges({action:'batch',summary:'empty',data:{changes:[]}},'admin'),/1 to 50/);
});
test('signed groups bind all records to the user and reject tampering and expiry',()=>{
 const signed=signProposal('owner','admin',plan());assert.equal(verifyProposal(signed.token,'owner','admin').data.changes.length,6);
 assert.throws(()=>verifyProposal(signed.token,'other-owner','admin'),/outside your role/);
 const [encoded,signature]=signed.token.split('.');const payload=JSON.parse(Buffer.from(encoded,'base64url'));
 payload.data.changes[0].data.held=true;
 assert.throws(()=>verifyProposal(Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+signature,'owner','admin'),/changed/);
 payload.expires=Date.now()-1;const expired=Buffer.from(JSON.stringify(payload)).toString('base64url');
 assert.throws(()=>verifyProposal(expired+'.'+createHmac('sha256',process.env.ASSISTANT_PROPOSAL_SECRET).update(expired).digest('base64url'),'owner','admin'),/expired/);
});
test('one confirmation completes six operations with an exact result for each',async()=>{
 const execute=createPlanExecutor(),changes=validateChanges(plan(),'admin'),seen=[];
 const result=await execute('owner:plan',Date.now()+60000,changes,async change=>{seen.push(change.data.id);return {status:'saved',recordId:change.data.id};});
 assert.equal(seen.length,6);assert.equal(result.status,'complete');assert.equal(result.total,6);assert.equal(result.saved,6);assert.equal(result.failed,0);assert.match(result.message,/6 of 6/);
});
test('partial failures are visible, other entries run, and retry only repeats the failed entry',async()=>{
 const execute=createPlanExecutor(),changes=validateChanges(plan(),'admin'),calls=Array(6).fill(0);
 const run=async(change,index)=>{calls[index]++;if(index===2&&calls[index]===1)throw Error('Stock record could not be updated');return {status:'saved'};};
 const first=await execute('partial',Date.now()+60000,changes,run);assert.equal(first.status,'partial');assert.equal(first.saved,5);assert.equal(first.failed,1);assert.equal(first.items[2].error,'Stock record could not be updated');
 const retried=await execute('partial',Date.now()+60000,changes,run);assert.equal(retried.status,'complete');assert.deepEqual(calls,[1,1,2,1,1,1]);
});
test('duplicate concurrent submissions share execution and do not double-apply',async()=>{
 const execute=createPlanExecutor(),changes=validateChanges(plan(),'admin');let calls=0;let release;
 const pause=new Promise(resolve=>{release=resolve;});
 const run=async()=>{calls++;await pause;return {status:'saved'};};
 const first=execute('same',Date.now()+60000,changes,run),second=execute('same',Date.now()+60000,changes,run);release();
 const results=await Promise.all([first,second]);assert.equal(calls,6);assert.deepEqual(results[0],results[1]);
 await execute('same',Date.now()+60000,changes,run);assert.equal(calls,6);
});
test('already-applied holds count as completed without another write',async()=>{
 const result=await createPlanExecutor()('already',Date.now()+60000,validateChanges(plan(),'admin'),async(_,index)=>({status:index===0?'already_applied':'saved'}));
 assert.equal(result.total,6);assert.equal(result.saved,5);assert.equal(result.alreadyApplied,1);assert.equal(result.status,'complete');
});
test('duplicate stock IDs are rejected and orders receive stable signed idempotency keys',()=>{
 const group=plan();group.data.changes[1].data.id=group.data.changes[0].data.id;
 assert.throws(()=>validateChanges(group,'admin'),/more than once/);
 const proposal=signProposal('owner','admin',{action:'batch',summary:'Two requests',data:{changes:[{action:'save_order',summary:'First',data:{}},{action:'save_order',summary:'Second',data:{}}]}});
 const signed=verifyProposal(proposal.token,'owner','admin');assert.notEqual(signed.data.changes[0].data.idempotency_key,signed.data.changes[1].data.idempotency_key);
 assert.equal(verifyProposal(proposal.token,'owner','admin').data.changes[0].data.idempotency_key,signed.data.changes[0].data.idempotency_key);
});

// Exercise the actual HTTP handler with an isolated database adapter; never call Supabase or Bedrock.
const dbStub=url('export function requestDatabase(){return globalThis.__kingaPlanHttp.db;}');
const bedrockStub=url('export function createBedrockClient(){throw Error("Unexpected model call in a bulk stock test");}');
const routeSource=(await compile('../app/api/assistant/route.ts'))
 .replaceAll("'@/lib/operation-errors'",JSON.stringify(url(await compile('../lib/operation-errors.ts'))))
 .replaceAll("'@/lib/supabase'",JSON.stringify(dbStub))
 .replaceAll("'@/lib/assistant/bedrock'",JSON.stringify(bedrockStub))
 .replaceAll("'@/lib/assistant/kinga'",JSON.stringify(url(kingaSource)))
 .replaceAll("'@/lib/assistant/plans'",JSON.stringify(plansUrl));
const {POST}=await import(url(routeSource));
function fixture(role='admin'){
 const stocks=new Map(snapshot.lots.map(stock=>[stock.id,{...stock}]));const state={writes:[],fail:null,role};
 const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){
  let key;
  return {select(){return this;},eq(_,value){key=value;return this;},single:async()=>({data:{role:state.role}}),maybeSingle:async()=>({data:table==='stock_lots'?stocks.get(key)||null:null})};
 },async rpc(name,{p_data}={}){
  if(name==='kinga_snapshot')return {data:{...snapshot,lots:[...stocks.values()]}};
  if(name!=='kinga_hold_lot')throw Error('Unexpected write '+name);
  state.writes.push(p_data.id);
  if(state.fail===p_data.id)return {error:{message:'This stock entry is temporarily blocked'}};
  stocks.get(p_data.id).held=p_data.held;return {data:p_data.id};
 }};
 globalThis.__kingaPlanHttp={db};return state;
}
const post=body=>POST(new Request('http://kinga.test/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
test('HTTP manual approval prepares six changes without writing, then one confirmation applies all',async()=>{
 const state=fixture();const response=await post({message:'Release all held stock',approvalMode:'manual'});assert.equal(response.status,200);
 const prepared=await response.json();assert.equal(state.writes.length,0);assert.equal(prepared.proposal.data.changes.length,6);assert.equal(prepared.execution,undefined);
 const confirmed=await post({action:'execute',token:prepared.proposal.token});const applied=await confirmed.json();assert.equal(confirmed.status,200);assert.equal(applied.execution.saved,6);assert.equal(state.writes.length,6);
 await post({action:'execute',token:prepared.proposal.token});assert.equal(state.writes.length,6);
});
test('HTTP auto-accept applies the whole group immediately and returns complete counts',async()=>{
 const state=fixture();const response=await post({message:'Release all held stock',approvalMode:'auto'});const result=await response.json();
 assert.equal(response.status,200);assert.equal(result.execution.status,'complete');assert.equal(result.execution.total,6);assert.equal(state.writes.length,6);assert.match(result.message,/6 of 6/);
});
test('HTTP auto-accept exposes a failed entry and manual retry only repeats that entry',async()=>{
 const state=fixture();state.fail=uuid(3);
 const response=await post({message:'Release all held stock',approvalMode:'auto'});const first=await response.json();assert.equal(first.execution.status,'partial');assert.equal(first.execution.saved,5);assert.equal(first.execution.failed,1);
 state.fail=null;const retry=await post({action:'execute',token:first.proposal.token});const result=await retry.json();assert.equal(result.execution.status,'complete');assert.equal(state.writes.length,7);assert.equal(state.writes.at(-1),uuid(3));
});
test('HTTP auto-accept cannot bypass role restrictions',async()=>{
 const prior=process.env.ASSISTANT_ROLES;process.env.ASSISTANT_ROLES='admin,cashier';
 try{const state=fixture('cashier');const response=await post({message:'Release all held stock',approvalMode:'auto'});assert.equal(response.status,400);assert.match((await response.json()).error,/outside your role/);assert.equal(state.writes.length,0);}
 finally{if(prior===undefined)delete process.env.ASSISTANT_ROLES;else process.env.ASSISTANT_ROLES=prior;}
});
