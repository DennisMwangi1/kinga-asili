'use client';
import {Check} from 'lucide-react';
import type {Snapshot} from '@/lib/domain';
import type {Proposal,ExecutionResult} from '@/lib/assistant/types';
import {proposalChanges} from '@/lib/assistant/plans';
import {RichText} from './rich-text';
export default function ProposalCard({proposal,execution,dismissed,autoAccepted,archived,busy,snapshot,onConfirm,onDismiss,onNavigate}:{
 proposal:Proposal;archived?:boolean;execution?:ExecutionResult;dismissed?:boolean;autoAccepted?:boolean;busy:boolean;snapshot:Snapshot;onConfirm:()=>void;onDismiss:()=>void;onNavigate:()=>void;
}) {
 const changes=proposalChanges(proposal),complete=execution?.status==='complete';
 const count=changes.length;
 const historical=archived&&!complete&&!dismissed;
 const title=historical?'Previous proposal':complete?(count>1?'Changes saved':'Change saved'):dismissed?'Proposal dismissed':execution?.failed?'Some changes need attention':`Review ${count>1?count+' changes':'proposed change'}`;
 return <section className={'kai-proposal'+(complete?' kai-proposal--applied':dismissed?' kai-proposal--dismissed':'')} aria-label="Proposed changes">
  <h4 className="kai-proposal__title">{title}</h4>
  {autoAccepted&&<span className="kai-approval-label">Auto-accepted</span>}
  <RichText text={proposal.summary} onNavigate={onNavigate}/>
  <ol className="kai-change-list">{changes.map((change,index)=>{
   const result=execution?.items.find(item=>item.index===index);
   const fields=<dl className="kai-proposal-details">{Object.entries(change.data).filter(([key])=>key!=='idempotency_key').map(([key,value])=><div key={key}><dt>{fieldLabel(key)}</dt><dd>{describe(value,snapshot)}</dd></div>)}</dl>;
   return <li key={index}>
    {count>1&&<p className="kai-change-summary">{change.summary}</p>}
    {count>1?<details><summary>View change details</summary>{fields}</details>:fields}
    {result&&<p className={'kai-change-result kai-change-result--'+result.status}>{result.status==='failed'?result.error:result.status==='already_applied'?'Already applied':<><Check size={14}/>Saved</>}</p>}
   </li>;
  })}</ol>
  {execution&&<p className="kai-execution-summary" role="status">{execution.saved+execution.alreadyApplied} of {execution.total} completed{execution.failed?` · ${execution.failed} failed`:''}</p>}
  {historical&&<p className="form-help">This proposal is from a previous session. Ask Kinga again to review it against current records.</p>}
  <div className="kai-proposal__actions">{!complete&&!dismissed&&!historical&&<>
   <button className="primary" disabled={busy} onClick={onConfirm}>{busy?'Saving…':execution?.failed?`Retry ${execution.failed} failed ${execution.failed===1?'change':'changes'}`:count>1?`Confirm all ${count} changes`:'Confirm & save'}</button>
   <button disabled={busy} onClick={onDismiss}>{execution?.failed?'Keep completed changes':'Dismiss'}</button>
  </>}</div>
 </section>;
}
function fieldLabel(key:string){return ({id:'Record',order_id:'Order',product_id:'Product',material_id:'Material',use_by:'Approved use-by date',held:'On hold'} as Record<string,string>)[key]||key.replaceAll('_',' ');}
function describe(value:unknown,snapshot:Snapshot):string{
 if(Array.isArray(value))return value.map(item=>describe(item,snapshot)).join('\n');
 if(value&&typeof value==='object')return Object.entries(value).map(([key,item])=>`${fieldLabel(key)}: ${describe(item,snapshot)}`).join(' · ');
 if(typeof value==='boolean')return value?'Yes':'No';
 if(typeof value==='string'){const p=snapshot.products.find(p=>p.id===value);if(p)return `${p.blend} · ${p.volume_ml} ml`;const m=snapshot.materials.find(m=>m.id===value);if(m)return String(m.name);const o=snapshot.orders.find(o=>o.id===value);if(o)return o.reference;const b=snapshot.batches.find(b=>b.id===value);if(b)return b.reference;const customer=snapshot.customers.find(c=>c.id===value);if(customer)return String(customer.name);const stock=snapshot.lots.find(stock=>stock.id===value);if(stock){const product=snapshot.products.find(product=>product.id===stock.product_id);return `${product?product.blend+' '+product.volume_ml+' ml · ':''}${stock.batch_reference}`;}}
 return String(value??'Not provided');
}
