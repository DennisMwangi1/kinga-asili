'use client';
import {useState,useRef,useEffect,useCallback} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useWorkspaceToast} from './workspace-toasts';
import {workspaceError} from '@/lib/operation-errors';
import {MessageCircle,History,ArrowLeft,Plus,Copy,Check,Package,ShoppingBag,FlaskConical} from 'lucide-react';
import type {Snapshot} from '@/lib/domain';
import type {Proposal,ApprovalMode} from '@/lib/assistant/types';
import ProposalCard from './assistant/proposal-card';
import {copyText} from '@/lib/assistant/clipboard';
import Sheet from './sheet';
import {RichText} from './assistant/rich-text';
import Thinking from './assistant/thinking';
import {PromptBar} from './ui/prompt-bar';
import ApprovalModeControl from './assistant/approval-mode';
import {useConversations} from './assistant/use-conversations';

type Props={snapshot:Snapshot;getToken:()=>Promise<string|undefined>;onSaved:()=>Promise<void>};
export default function KingaBot({snapshot,getToken,onSaved}:Props){
 const [open,setOpen]=useState(false),[working,setWorking]=useState<'answer'|'save'|null>(null),[text,setText]=useState('');
 const [approvalMode,setApprovalMode]=useState<ApprovalMode>('manual');
 const [copied,setCopied]=useState<string|null>(null),[historyOpen,setHistoryOpen]=useState(false),[historySearch,setHistorySearch]=useState('');
 const end=useRef<HTMLDivElement>(null),box=useRef<HTMLTextAreaElement>(null),request=useRef<AbortController|null>(null),inFlight=useRef(false);
 const {add:notify,close:closeToast}=useWorkspaceToast(),pathname=usePathname();
 const reportError=useCallback((description:string)=>{notify({id:'kinga-ai-error',title:'Kinga AI',description,type:'error',priority:'high',timeout:7000,data:{pathname}});},[notify,pathname]);
 const history=useConversations({active:open,getToken,onError:reportError});
 const {messages,setMessages}=history;
 const close=useCallback(()=>{setOpen(false);closeToast('kinga-ai-error');},[closeToast]);
 const busy=working!==null||history.loading;
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[messages,working,open,historyOpen]);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function send(value:string){
  const question=value.trim();if(!question||inFlight.current||history.loading)return;
  if(!navigator.onLine){reportError('Reconnect before sending a message.');return;}
  inFlight.current=true;setText('');closeToast('kinga-ai-error');setWorking('answer');
  const controller=new AbortController();request.current=controller;
  const turnHistory=messages.filter(message=>!message.stopped).map(message=>({role:message.role,content:message.content+(message.proposal?'\nProposed changes: '+JSON.stringify({action:message.proposal.action,data:message.proposal.data,summary:message.proposal.summary,status:message.execution?.status||(message.dismissed?'dismissed':message.archived?'historical proposal; request a fresh review':'awaiting approval')}):'')}));
  setMessages(current=>[...current,{id:crypto.randomUUID(),role:'user',content:question}]);
  try{
   const token=await getToken();if(!token)throw Error('Sign in again to use Kinga AI.');
   const response=await fetch('/api/assistant',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({message:question,history:turnHistory,approvalMode})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',content:result.message,proposal:result.proposal,execution:result.execution,applied:result.execution?.status==='complete',autoAccepted:approvalMode==='auto'&&!!result.execution}]);
   if(result.execution)await onSaved().catch(()=>reportError('Changes were processed, but the workspace could not refresh. Reopen the workspace to see the latest records.'));
  }catch(e){
   if(controller.signal.aborted)setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',content:'Answer stopped.',stopped:true}]);
   else {reportError(workspaceError(e));setText(current=>current||question);}
  }finally{if(request.current===controller){request.current=null;inFlight.current=false;setWorking(null);}}
 }
 async function confirm(id:string,proposal:Proposal){
  if(inFlight.current)return;
  inFlight.current=true;setWorking('save');closeToast('kinga-ai-error');
  try{
   const token=await getToken();if(!token)throw Error('Sign in again before saving.');
   const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:'execute',token:proposal.token})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   setMessages(current=>[...current.map(message=>message.id===id?{...message,execution:result.execution,applied:result.execution?.status==='complete'}:message),{id:crypto.randomUUID(),role:'assistant',content:result.message}]);
   await onSaved().catch(()=>reportError('Changes were processed, but the workspace could not refresh. Reopen the workspace to see the latest records.'));
  }catch(e){reportError(workspaceError(e));}finally{inFlight.current=false;setWorking(null);}
 }
 const suggestions=snapshot.role==='driver'?['Which deliveries need attention?','What is on my delivery list?']:['What needs attention today?','Which blends are low on stock?','What payments are outstanding?','Which batches need verification?'];
 const shortcuts=[{href:'/dashboard/orders/new',label:'New order',icon:ShoppingBag,roles:['admin','sales','cashier']},{href:'/dashboard/inventory',label:'Stock',icon:Package,roles:['admin','stock_keeper','cashier']},{href:'/dashboard/production',label:'Production',icon:FlaskConical,roles:['admin','stock_keeper']}].filter(item=>item.roles.includes(snapshot.role));
 return <>
  <button className="kinga-bot-launcher kai-launcher" onClick={()=>setOpen(current=>!current)} aria-label={open?'Close Kinga AI':'Open Kinga AI'} title="Kinga AI" aria-expanded={open}><MessageCircle size={24} strokeWidth={1.75}/></button>
  <Sheet open={open} title="Kinga AI" onClose={close} variant="assistant"
   headerContent={<><button className="kai-icon-button" type="button" aria-label="Conversation history" title="Conversation history" aria-pressed={historyOpen} disabled={working!==null} onClick={()=>{setHistoryOpen(true);setHistorySearch('');void history.refresh();}}><History size={20}/></button><button className="kai-icon-button" type="button" aria-label="New chat" title="New chat" disabled={busy} onClick={async()=>{if(!await history.newChat()){setHistoryOpen(true);return;}setHistoryOpen(false);closeToast('kinga-ai-error');setCopied(null);setText('');setApprovalMode('manual');box.current?.focus();}}><Plus size={20}/></button></>}
   contentHeader={<>{shortcuts.length>0&&<nav className="kai-pills" aria-label="AI quick actions">{shortcuts.map(item=><Link className="kai-chip kai-chip--action" key={item.href} href={item.href} onClick={close}><item.icon size={15}/>{item.label}</Link>)}</nav>}</>}

   footer={historyOpen?<button className="secondary kai-history-back" onClick={()=>setHistoryOpen(false)}><ArrowLeft size={17}/>Back to conversation</button>:<><form className="kai-composer" onSubmit={event=>{event.preventDefault();void send(text);}}>
     <PromptBar value={text} onChange={setText} onSend={()=>void send(text)} inputRef={box} label="Message Kinga AI" placeholder="Ask Kinga or paste an order…" busy={busy} disabled={working==='save'} minRows={1} maxLength={12000} onStop={working==='answer'&&approvalMode==='manual'?()=>request.current?.abort():undefined} options={<ApprovalModeControl mode={approvalMode} onChange={setApprovalMode} disabled={busy}/>}/>
    </form><p className="kai-composer-note">{history.saveStatus==='saving'?'Saving conversation…':history.loading?'Loading your conversations…':working==='save'?'Saving your confirmed change…':approvalMode==='auto'?'Auto-accept is on for new requests in this chat.':'Review and confirm each requested group of changes.'}</p></>}
  >
   {historyOpen?<section className="kai-history"><div className="section-title"><h2>Recent conversations</h2><button type="button" disabled={history.loading} onClick={()=>void history.refresh()}>Refresh</button></div><input type="search" aria-label="Search conversations" placeholder="Search conversations…" value={historySearch} onChange={event=>setHistorySearch(event.target.value)}/>{history.loading?<p role="status">Loading conversations…</p>:<div className="kai-history-list">{history.conversations.filter(item=>item.title.toLowerCase().includes(historySearch.toLowerCase())).map(item=><button type="button" key={item.id} aria-current={item.id===history.id?'true':undefined} onClick={async()=>{if(await history.restore(item.id)){setHistoryOpen(false);setText('');setCopied(null);setApprovalMode('manual');}}}><MessageCircle size={18} aria-hidden="true"/><span><strong>{item.title}</strong><time dateTime={item.updated_at}>{new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Nairobi'}).format(new Date(item.updated_at))}</time></span><span aria-hidden="true">→</span></button>)}{!history.conversations.length&&<p>No saved conversations yet. Your chats appear here after your first message.</p>}{history.conversations.length>0&&!history.conversations.some(item=>item.title.toLowerCase().includes(historySearch.toLowerCase()))&&<p>No matching conversations.</p>}</div>}{history.saveStatus==='error'&&<button type="button" onClick={history.retrySave}>Retry saving current conversation</button>}</section>:<>
   <div className="order-bot__thread kai-thread" role="log" aria-label="Kinga AI conversation" aria-live="polite" aria-busy={busy}>
    {!messages.length&&<div className="kai-intro"><span className="kai-intro-mark"><MessageCircle size={25} strokeWidth={1.5}/></span><h3 className="kai-intro__title">How can I help?</h3><p className="kai-intro__text">Ask about sales, stock, production or payments. You can also paste a customer order for review.</p><div className="kai-suggest">{suggestions.map(question=><button type="button" key={question} className="kai-suggest__item" onClick={()=>void send(question)} disabled={busy}>{question}<span aria-hidden="true">↗</span></button>)}</div></div>}
    {messages.map(message=><article className={'order-bot__msg '+(message.role==='user'?'order-bot__msg--me':'order-bot__msg--bot kai-answer')} key={message.id} aria-label={message.role==='user'?'You':'Kinga AI'}>
      {message.role==='user'?<p className="kai-user-text">{message.content}</p>:<>
       {message.stopped?<p className="kai-stopped">{message.content}</p>:<RichText text={message.content} onNavigate={close}/>}
       {message.proposal&&<ProposalCard archived={message.archived} proposal={message.proposal} execution={message.execution} dismissed={message.dismissed} autoAccepted={message.autoAccepted} busy={busy} snapshot={snapshot} onNavigate={close} onConfirm={()=>void confirm(message.id,message.proposal!)} onDismiss={()=>setMessages(current=>current.map(item=>item.id===message.id?{...item,dismissed:true}:item))}/>}

       {!message.stopped&&<button className="kai-copy-answer" type="button" onClick={async()=>{if(await copyText(message.content))setCopied(message.id);else reportError('Clipboard unavailable. You can select and copy the answer.');}} aria-label={copied===message.id?'Answer copied':'Copy answer'}>{copied===message.id?<Check size={14}/>:<Copy size={14}/>}<span>{copied===message.id?'Copied':'Copy'}</span></button>}
      </>}
     </article>)}
    {working&&<Thinking key={working} label={working==='save'?'Saving your confirmed change':approvalMode==='auto'?'Preparing and applying your request':'Preparing your answer'}/>}
    <div ref={end}/>
   </div>
   </>}
  </Sheet>
 </>;
}
