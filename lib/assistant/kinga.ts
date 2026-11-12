import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import type {Snapshot,Role} from '@/lib/domain';
import {eatDate,weeklyMetrics} from '@/lib/domain';
import type {Proposal,ProposalChange} from './types';
import {allowedBotActions,validateChanges} from './plans';
export {allowedBotActions} from './plans';
export function signProposal(user:string,role:Role,input:ProposalChange):Proposal{
 const changes=validateChanges(input,role);
 const secret=process.env.ASSISTANT_PROPOSAL_SECRET;if(!secret)throw Error('Assistant proposal signing is not configured.');
 const id=randomUUID();
 const prepared=changes.map(change=>({...change,data:['save_order','save_purchase','save_batch'].includes(change.action)?{...change.data,idempotency_key:randomUUID()}:change.data}));
 const action=input.action==='batch'?'batch':prepared[0].action;
 const data=action==='batch'?{changes:prepared}:prepared[0].data;
 const payload=Buffer.from(JSON.stringify({user,id,action,data,summary:input.summary,expires:Date.now()+10*60*1000})).toString('base64url');
 const signature=createHmac('sha256',secret).update(payload).digest('base64url');
 return {action,data,summary:input.summary,token:payload+'.'+signature};
}
export function verifyProposal(token:string,user:string,role:Role){
 const secret=process.env.ASSISTANT_PROPOSAL_SECRET;if(!secret)throw Error('Assistant proposal signing is not configured.');
 const [payload,signature]=token.split('.');if(!payload||!signature||token.length>40000)throw Error('Invalid proposal.');
 const expected=createHmac('sha256',secret).update(payload).digest();const actual=Buffer.from(signature,'base64url');if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw Error('Proposal was changed. Prepare it again.');
 const p=JSON.parse(Buffer.from(payload,'base64url').toString()) as {user:string;id:string;action:string;data:Record<string,unknown>;summary?:string;expires:number};
 if(p.user!==user||p.expires<Date.now())throw Error('Proposal expired or is outside your role. Prepare it again.');
 validateChanges({...p,summary:p.summary||'Update record'},role);
 return {...p,summary:p.summary||'Update record'};
}
export function assistantContext(s:Snapshot){
 const today=eatDate();const start=new Date(today+'T09:00:00+03:00');start.setDate(start.getDate()-6);
 return {today,timeZone:'Africa/Nairobi',currency:'KES',role:s.role,weekly:s.role==='admin'?weeklyMetrics(s,eatDate(start),today):undefined,products:s.products,materials:s.materials,batches:s.batches.slice(0,60),batchStock:s.lots,orders:s.orders.slice(0,100).map(o=>({id:o.id,reference:o.reference,customer_name:o.customer_name,status:o.status,lines:o.lines,total:o.total,paid:o.paid,delivery_fee:o.delivery_fee,delivery_date:o.delivery_date,exception_reason:o.exception_reason})),purchases:s.purchases.slice(0,60),allowedActions:allowedBotActions(s.role),contextLimit:'Up to 100 recent orders and 60 batches/receipts. Never assume this is complete history.'};
}
