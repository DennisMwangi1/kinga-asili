'use client';
import {useState} from 'react';
import {Menu} from '@base-ui/react/menu';
import {Check,ChevronDown,Hand,ShieldCheck} from 'lucide-react';
import type {ApprovalMode} from '@/lib/assistant/types';
/** Andishixkikapu's compact composer mode menu, wired to Kinga's approval rules. */
export default function ApprovalModeControl({mode,onChange,disabled}:{mode:ApprovalMode;onChange:(mode:ApprovalMode)=>void;disabled:boolean}){
 const [open,setOpen]=useState(false),Icon=mode==='auto'?ShieldCheck:Hand;
 return <Menu.Root modal={false} open={open} onOpenChange={setOpen}>
  <Menu.Trigger type="button" disabled={disabled} className="studio-button studio-button--tertiary studio-button--small kai-mode-trigger" aria-label={`Assistant mode: ${mode==='auto'?'Auto':'Manual'}`} title="Change approval mode"><Icon size={14} aria-hidden="true"/><span>{mode==='auto'?'Auto':'Manual'}</span><ChevronDown size={12} aria-hidden="true"/></Menu.Trigger>
  <Menu.Portal><Menu.Positioner side="top" align="start" sideOffset={8} collisionPadding={8} className="studio-prompt-bar-positioner"><Menu.Popup className="studio-select-popup kai-mode-menu" onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);}}}>
   <Menu.RadioGroup value={mode} onValueChange={value=>{if(value==='manual'||value==='auto')onChange(value);}} aria-label="Change approval mode">
    <Menu.RadioItem value="manual" label="Manual" closeOnClick className="studio-select-item kai-mode-option"><Hand size={16} aria-hidden="true"/><span><span className="kai-mode-option-title">Manual</span><span className="kai-mode-note">Review and confirm each group of changes before saving.</span></span><Menu.RadioItemIndicator className="kai-mode-check"><Check size={16} aria-hidden="true"/></Menu.RadioItemIndicator></Menu.RadioItem>
    <Menu.RadioItem value="auto" label="Auto" closeOnClick className="studio-select-item kai-mode-option"><ShieldCheck size={16} aria-hidden="true"/><span><span className="kai-mode-option-title">Auto · Approve for me</span><span className="kai-mode-note">Apply changes requested in new messages automatically, using your staff permissions.</span></span><Menu.RadioItemIndicator className="kai-mode-check"><Check size={16} aria-hidden="true"/></Menu.RadioItemIndicator></Menu.RadioItem>
   </Menu.RadioGroup>
  </Menu.Popup></Menu.Positioner></Menu.Portal>
 </Menu.Root>;
}
