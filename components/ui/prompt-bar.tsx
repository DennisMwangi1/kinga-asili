'use client';
import {useId,useLayoutEffect,useRef,type KeyboardEvent,type ReactNode,type RefObject} from 'react';
import {ArrowUp,Square} from 'lucide-react';
import {Button} from './button';
interface PromptBarProps {
 value:string;onChange:(value:string)=>void;onSend:()=>void;
 label:string;placeholder:string;sendLabel?:string;busy?:boolean;disabled?:boolean;
 maxLength?:number;minRows?:number;options?:ReactNode;onStop?:()=>void;
 inputRef?:RefObject<HTMLTextAreaElement|null>;
}
/** Adapted from andishixkikapu/studio/src/ui/PromptBar.tsx. */
export function PromptBar({value,onChange,onSend,label,placeholder,sendLabel='Send message',busy=false,disabled=false,maxLength=12000,minRows=1,options,onStop,inputRef}:PromptBarProps){
 const localInput=useRef<HTMLTextAreaElement>(null),input=inputRef||localInput,id=useId();
 useLayoutEffect(()=>{
  const field=input.current;if(!field)return;
  field.style.height='auto';
  const line=Number.parseFloat(getComputedStyle(field).lineHeight)||22;
  field.style.height=`${Math.min(Math.max(field.scrollHeight,line*minRows),line*5)}px`;
  field.style.overflowY=field.scrollHeight>line*5?'auto':'hidden';
 },[value,minRows,input]);
 function onKeyDown(event:KeyboardEvent<HTMLTextAreaElement>){
  if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(!busy&&!disabled&&value.trim())onSend();}
 }
 return <div className="studio-prompt-bar" data-busy={busy||undefined} data-compact={minRows<2||undefined}>
  <textarea className="studio-control studio-textarea" ref={input} id={id} aria-label={label} placeholder={placeholder} value={value} rows={minRows} maxLength={maxLength} disabled={disabled} onChange={event=>onChange(event.target.value)} onKeyDown={onKeyDown}/>
  <div className="studio-prompt-bar-tools">{options}<span className="studio-prompt-bar-end">{onStop&&busy?<Button className="studio-prompt-bar-send" variant="secondary" size="icon" type="button" aria-label="Stop the answer" title="Stop answer" onClick={onStop}><Square size={16} fill="currentColor" aria-hidden="true"/></Button>:<Button className="studio-prompt-bar-send" type="submit" size="icon" aria-label={sendLabel} title={sendLabel} busy={busy} disabled={busy||disabled||!value.trim()}>{!busy&&<ArrowUp size={20} strokeWidth={2.2} aria-hidden="true"/>}</Button>}</span></div>
 </div>;
}
