'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
interface InstallEvent extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>;}
const Context=createContext({installed:false,offline:false,install:async()=>{},help:''});
export function WorkspacePwa({children}:{children:ReactNode}){
 const [prompt,setPrompt]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(false),[offline,setOffline]=useState(false),[help,setHelp]=useState('');
 useEffect(()=>{
  const mode=window.matchMedia('(display-mode: standalone)');
  const sync=()=>{setOffline(!navigator.onLine);setInstalled(mode.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);};sync();
  const capture=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
  const done=()=>{setInstalled(true);setPrompt(null);setHelp('');};
  window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',done);window.addEventListener('online',sync);window.addEventListener('offline',sync);mode.addEventListener('change',sync);
  if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>setHelp('Installation is available through your browser menu. Reopen the workspace if the browser is updating.'));
  return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',done);window.removeEventListener('online',sync);window.removeEventListener('offline',sync);mode.removeEventListener('change',sync);};
 },[]);
 async function install(){
  if(installed){setHelp('Kinga Workspace is already installed on this device.');return;}
  if(!window.isSecureContext){setHelp('Open the workspace using its HTTPS address to install it on your phone. A local HTTP network address cannot install the app.');return;}
  if(prompt){await prompt.prompt();const choice=await prompt.userChoice;setPrompt(null);if(choice.outcome==='dismissed')setHelp('You can install later from your browser menu.');return;}
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)setHelp('On iPhone or iPad: open this workspace in Safari, tap Share, then Add to Home Screen and Open as Web App.');
  else setHelp('Open your browser menu and choose Install app or Add to Home screen. On desktop, use the install icon in the address bar.');
 }
 return <Context.Provider value={{installed,offline,install,help}}>{offline&&<div className="offline-status" role="status">You’re offline. Reconnect to view live records or save changes.</div>}{children}</Context.Provider>;
}
export function InstallWorkspace(){const pwa=useContext(Context);return <div className="install-workspace"><button type="button" onClick={()=>void pwa.install()}><span aria-hidden="true">↓</span> {pwa.installed?'Workspace installed':'Install workspace'}</button>{pwa.help&&<p role="status">{pwa.help}</p>}<small>Add Kinga to your phone’s home screen.</small></div>;}
