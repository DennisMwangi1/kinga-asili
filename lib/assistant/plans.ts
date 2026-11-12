import {validatePurchase} from '@/lib/purchases';
import type {Role,Snapshot} from '@/lib/domain';
import type {ProposalChange,ExecutionItem,ExecutionResult} from './types';
export const botActions=['save_order','transition_order','record_payment','save_batch','post_batch','save_purchase','post_purchase','save_customer','save_material','hold_lot'] as const;
const roles:Record<string,readonly Role[]>={save_order:['admin','sales','cashier'],transition_order:['admin','sales','cashier'],record_payment:['admin','cashier'],save_batch:['admin','stock_keeper'],post_batch:['admin','stock_keeper'],save_purchase:['admin','cashier','stock_keeper'],post_purchase:['admin','cashier','stock_keeper'],save_customer:['admin','sales','cashier'],save_material:['admin','stock_keeper'],hold_lot:['admin','stock_keeper']};
export const allowedBotActions=(role:Role)=>botActions.filter(action=>roles[action].includes(role));
export const MAX_CHANGES=50;
export function proposalChanges(proposal:ProposalChange):ProposalChange[]{
 return proposal.action==='batch' ? proposal.data.changes as ProposalChange[] : [proposal];
}
export function validateChanges(proposal:ProposalChange,role:Role):ProposalChange[]{
 if(!proposal||typeof proposal.action!=='string'||!proposal.data||typeof proposal.data!=='object'||Array.isArray(proposal.data))throw Error('Invalid proposed change.');
 const changes=proposalChanges(proposal);
 if(!Array.isArray(changes)||changes.length<1||changes.length>MAX_CHANGES)throw Error(`A request must contain 1 to ${MAX_CHANGES} changes.`);
 const stockIds=new Set<string>();
 return changes.map(change=>{
  if(!change||!allowedBotActions(role).includes(change.action as typeof botActions[number]))throw Error('This action is outside your role.');
  if(!change.data||typeof change.data!=='object'||Array.isArray(change.data))throw Error('Invalid change details.');
  if(change.action==='batch')throw Error('Nested change groups are not supported.');
  const data:Record<string,unknown>=change.action==='save_purchase'?validatePurchase(change.data):{...change.data};
  if(change.action==='hold_lot'){
   if(typeof data.id!=='string'||!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(data.id)||typeof data.held!=='boolean')throw Error('Select valid batch stock and a hold setting.');
   if(stockIds.has(data.id))throw Error('The same batch stock appears more than once.');stockIds.add(data.id);
   if(typeof data.reason!=='string'||data.reason.trim().length<3)data.reason=data.held?'Stock hold requested by staff in Kinga AI.':'Hold release requested by staff in Kinga AI.';
  }
  return {action:change.action,data,summary:typeof change.summary==='string'&&change.summary.trim()?change.summary.trim().slice(0,1000):change.action.replaceAll('_',' ')};
 });
}
/** Resolve an unambiguous all-stock-holds request without forcing one model call per record. */
export function bulkHoldRequest(message:string,history:{role:string;content:string}[],snapshot:Snapshot):ProposalChange|null {
 const text=message.trim().toLowerCase().replace(/[.!]+$/,'');
 if(/\b(?:not|never|except|only|excluding)\b|don['’]t/.test(text))return null;
 const command=text.replace(/^(?:please|can you|could you|would you)\s+/,'').replace(/\s+please$/,'');
 // Scoped or explanatory requests go through the model; never broaden a subset to all stock.
 const explicit=/^(?:release|unhold)\s+(?:all|every)\s+(?:(?:the|currently)\s+)?(?:(?:held|on-hold)\s+)?(?:stock(?: entries)?|batch stock(?: entries)?|holds)(?:\s+(?:currently\s+)?on hold)?$/.test(command)||/^release (?:the )?holds? on all (?:the )?(?:batch )?stock$/.test(command);
 const followup=/^(?:yes[, ]+)?(?:please[, ]+)?all(?: of)?(?: them| those| the above| remaining)?(?: please)?$/.test(text);
 const previous=[...history].reverse().find(item=>item.role==='assistant')?.content||'';
 if(!explicit&&!(followup&&/\brelease\b|\bunhold\b/i.test(previous)&&/\bhold|\bbatch|\bstock\b/i.test(previous)))return null;
 const held=snapshot.lots.filter(stock=>stock.held===true);
 if(!held.length)return {action:'batch',data:{changes:[]},summary:'No batch stock is currently on hold.'};
 if(held.length>MAX_CHANGES)throw Error(`There are ${held.length} stock entries on hold. Select up to ${MAX_CHANGES} per request.`);
 return {action:'batch',summary:`Release holds on all ${held.length} stock entries across ${new Set(held.map(stock=>stock.batch_id||stock.batch_reference)).size} production batches.`,data:{changes:held.map(stock=>{
  const product=snapshot.products.find(product=>product.id===stock.product_id);
  return {action:'hold_lot',data:{id:stock.id,held:false,reason:'Hold release requested by staff in Kinga AI.'},summary:`Release ${product?`${product.blend} ${product.volume_ml} ml`:'batch stock'} · ${stock.batch_reference} (${stock.quantity} bottles).`};
 })}};
}
function summarize(items:ExecutionItem[]):ExecutionResult {
 const saved=items.filter(item=>item.status==='saved').length,alreadyApplied=items.filter(item=>item.status==='already_applied').length,failed=items.filter(item=>item.status==='failed').length,total=items.length;
 const message=failed ? `${saved+alreadyApplied} of ${total} changes completed; ${failed} failed. Retry the failed changes below.` : total===1 ? (alreadyApplied?'This change was already applied.':'1 of 1 changes saved.') : `${saved+alreadyApplied} of ${total} changes completed.${alreadyApplied?` ${alreadyApplied} already applied.`:''}`;
 return {status:failed?(saved+alreadyApplied?'partial':'failed'):'complete',total,saved,alreadyApplied,failed,items,message};
}
export type ChangeRunner=(change:ProposalChange,index:number)=>Promise<{status:'saved'|'already_applied';recordId?:string}>;
/** Serialize duplicate submissions; a retry runs only previously failed entries. */
export function createPlanExecutor(){
 const receipts=new Map<string,{expires:number;pending?:Promise<ExecutionResult>;result?:ExecutionResult}>();
 return async function execute(key:string,expires:number,changes:ProposalChange[],run:ChangeRunner):Promise<ExecutionResult>{
  for(const [id,receipt] of receipts)if(receipt.expires<Date.now())receipts.delete(id);
  const existing=receipts.get(key);
  if(existing?.pending)return existing.pending;
  if(existing?.result?.status==='complete')return existing.result;
  const receipt=existing||{expires};receipts.set(key,receipt);
  const pending=(async()=>{
   const items:ExecutionItem[]=[];
   for(let index=0;index<changes.length;index++){
    const change=changes[index],prior=receipt.result?.items[index];
    if(prior&&prior.status!=='failed'){items.push(prior);continue;}
    try {items.push({index,action:change.action,summary:change.summary,...await run(change,index)});}
    catch(error){items.push({index,action:change.action,summary:change.summary,status:'failed',error:error instanceof Error?error.message:'This change could not be saved.'});}
   }
   const result=summarize(items);receipt.result=result;return result;
  })();
  receipt.pending=pending;
  try{return await pending;}finally{receipt.pending=undefined;}
 };
}
