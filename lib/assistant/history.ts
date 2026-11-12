import type {Proposal,ExecutionResult} from './types';
export interface ChatMessage {id:string;role:'user'|'assistant';content:string;proposal?:Proposal;applied?:boolean;execution?:ExecutionResult;autoAccepted?:boolean;dismissed?:boolean;stopped?:boolean;archived?:boolean;}
export interface ConversationSummary {id:string;title:string;updated_at:string;created_at:string;}
export const conversationIdValid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function conversationTitle(messages:ChatMessage[]){return (messages.find(message=>message.role==='user')?.content||'New conversation').replace(/\s+/g,' ').trim().slice(0,100)||'New conversation';}
export function conversationMessages(input:unknown):ChatMessage[]{
 if(!Array.isArray(input)||input.length>500)throw Error('A conversation can contain up to 500 messages. Start a new chat to continue.');
 return input.map(item=>{
  if(!item||!conversationIdValid(item.id)||!['user','assistant'].includes(item.role)||typeof item.content!=='string'||item.content.length>120000)throw Error('Conversation messages are invalid.');
  const message:ChatMessage={id:item.id,role:item.role,content:item.content};
  for(const key of ['applied','autoAccepted','dismissed','stopped','archived'] as const)if(typeof item[key]==='boolean')message[key]=item[key];
  if(item.proposal){const p=item.proposal;if(typeof p.action!=='string'||typeof p.summary!=='string'||typeof p.token!=='string'||!p.data||typeof p.data!=='object'||Array.isArray(p.data))throw Error('Conversation proposal is invalid.');if(p.action==='batch'&&(!Array.isArray(p.data.changes)||p.data.changes.length>50||p.data.changes.some((change:Record<string,unknown>)=>!change||typeof change.action!=='string'||typeof change.summary!=='string'||!change.data||typeof change.data!=='object'||Array.isArray(change.data))))throw Error('Conversation proposal is invalid.');message.proposal={action:p.action,summary:p.summary,token:p.token,data:p.data};}
  if(item.execution){const e=item.execution;if(!['complete','partial','failed'].includes(e.status)||!Array.isArray(e.items)||e.items.length>50||typeof e.message!=='string'||['total','saved','alreadyApplied','failed'].some(key=>!Number.isInteger(e[key])||e[key]<0)||e.items.some((entry:Record<string,unknown>)=>!entry||!Number.isInteger(entry.index)||typeof entry.action!=='string'||typeof entry.summary!=='string'||!['saved','already_applied','failed'].includes(String(entry.status))))throw Error('Conversation result is invalid.');message.execution=e;}
  return message;
 });
}
