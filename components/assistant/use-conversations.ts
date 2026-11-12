'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {conversationMessages,conversationTitle,type ChatMessage,type ConversationSummary} from '@/lib/assistant/history';
export function useConversations({active,getToken,onError}:{active:boolean;getToken:()=>Promise<string|undefined>;onError:(message:string)=>void}){
 const [id,setId]=useState(()=>crypto.randomUUID()),[messages,setMessages]=useState<ChatMessage[]>([]),[conversations,setConversations]=useState<ConversationSummary[]>([]),[loading,setLoading]=useState(true),[saveStatus,setSaveStatus]=useState<'idle'|'saving'|'saved'|'error'>('idle'),[retry,setRetry]=useState(0);
 const initialized=useRef(false),lastQueued=useRef(''),queue=useRef<Promise<void>>(Promise.resolve()),owner=useRef<string|null>(null),failed=useRef(new Set<string>());
 const api=useCallback(async(suffix='',body?:unknown)=>{
  const token=await getToken();if(!token)throw Error('Sign in again to load or save your conversations.');
  const subject=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;
  if(typeof subject!=='string'||owner.current&&owner.current!==subject)throw Error('Your staff session changed. Reopen Kinga AI in the current workspace.');
  owner.current=subject;
  const response=await fetch('/api/assistant/conversations'+suffix,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Conversation history is unavailable.');return result;
 },[getToken]);
 const restore=useCallback(async(conversationId:string)=>{
  setLoading(true);
  try{await queue.current;if(failed.current.has(id))throw Error('Your current conversation has not been saved. Retry saving it before switching chats.');const result=await api('?id='+encodeURIComponent(conversationId));const restored=conversationMessages(result.conversation.messages).map(message=>({...message,archived:true}));lastQueued.current=JSON.stringify({id:conversationId,messages:restored});setId(conversationId);setMessages(restored);setSaveStatus('saved');return true;}
  catch(error){onError((error as Error).message);return false;}finally{setLoading(false);}
 },[api,onError,id]);
 const refresh=useCallback(async()=>{
  setLoading(true);try{await queue.current;const result=await api();setConversations(result.conversations);return true;}catch(error){onError((error as Error).message);return false;}finally{setLoading(false);}
 },[api,onError]);
 useEffect(()=>{
  if(!active||initialized.current)return;initialized.current=true;
  void(async()=>{try{const result=await api();setConversations(result.conversations);if(result.conversations[0])await restore(result.conversations[0].id);}catch(error){onError((error as Error).message);}finally{setLoading(false);}})();
 },[active,api,restore,onError]);
 useEffect(()=>{
  if(!messages.length)return;
  const payload={id,messages},key=JSON.stringify(payload);if(lastQueued.current===key)return;lastQueued.current=key;
  queue.current=queue.current.then(async()=>{
   if(lastQueued.current===key)setSaveStatus('saving');
   try{const result=await api('',payload);failed.current.delete(id);setConversations(current=>[result.conversation,...current.filter(item=>item.id!==id)].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)));if(lastQueued.current===key)setSaveStatus('saved');}
   catch(error){failed.current.add(id);if(lastQueued.current===key){setSaveStatus('error');onError('Chat was not saved. '+(error as Error).message);}}
  });
 },[id,messages,api,onError,retry]);
 const newChat=async()=>{await queue.current;if(failed.current.has(id)){onError('Your current conversation has not been saved. Retry saving it before starting a new chat.');return false;}lastQueued.current='';setId(crypto.randomUUID());setMessages([]);setSaveStatus('idle');return true;};
 const retrySave=()=>{lastQueued.current='';setRetry(value=>value+1);};
 return {id,messages,setMessages,conversations,loading,saveStatus,refresh,restore,newChat,retrySave,title:messages.length?conversationTitle(messages):'New conversation'};
}
