'use client';
import {useState,useRef,Fragment} from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {navigation,type Role} from '@/lib/domain';
import {availableCreationActions,contextualTabs,moduleSections,type WorkspaceDestination} from '@/lib/workspace-navigation';
import Sheet from './sheet';
import WorkspaceIcon from './workspace-icon';
import {InstallWorkspace} from './workspace-pwa';
export default function MobileTabs({role,name,onSignOut,onCreate}:{role:Role;name:string;onSignOut:()=>Promise<void>;onCreate:(id:string)=>void}){
 const [panel,setPanel]=useState<'more'|'create'|'sections'|null>(null),[sectionModule,setSectionModule]=useState<WorkspaceDestination|null>(null);
 const pending=useRef<{href?:string;create?:string}|null>(null),router=useRouter(),path=usePathname();
 const currentModule=path.split('/')[2]||'overview';
 const permitted=navigation.filter(item=>(item[3] as readonly string[]).includes(role));
 const selected=permitted.find(item=>item[1]=== (currentModule==='overview'?'/dashboard':'/dashboard/'+currentModule));
 const current=selected?{label:selected[0]==='Inventory'?'Stock':selected[0]==='Purchases & Expenses'?'Purchases':selected[0],href:selected[1],icon:selected[0]}:undefined;
 const primary=contextualTabs(role,current),creations=availableCreationActions(role);
 const active=(href:string)=>href==='/dashboard'?path===href:path===href||path.startsWith(href+'/');
 const close=()=>setPanel(null);
 const afterClose=(open:boolean)=>{if(open)return;const next=pending.current;pending.current=null;if(next?.href)router.push(next.href);if(next?.create)onCreate(next.create);};
 const navigate=(event:React.MouseEvent,href:string)=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();pending.current={href};close();};
 const moduleTap=(event:React.MouseEvent,tab:WorkspaceDestination)=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&active(tab.href)&&moduleSections(tab.href.split('/')[2]).length){event.preventDefault();setSectionModule(tab);setPanel('sections');}};
 const tile=(destination:WorkspaceDestination)=><Link className="studio-navigation-tile" key={destination.href} href={destination.href} onClick={event=>navigate(event,destination.href)} aria-current={path===destination.href?'page':undefined}><span className="studio-navigation-tile-icon"><WorkspaceIcon name={destination.icon}/></span><span className="studio-navigation-tile-label">{destination.label}</span></Link>;
 return <><nav className="studio-mobile-dock" aria-label="Workspace tabs">
  {primary.map((tab,index)=><Fragment key={tab.href}>
   {index===Math.min(2,primary.length-1)&&creations.length>0&&<button aria-label="Create or record" className="studio-mobile-tab dock-create" data-active={panel==='create'||path.endsWith('/new')||undefined} onClick={()=>setPanel('create')}><span className="studio-mobile-tab-icon"><WorkspaceIcon name="plus"/></span><span>New</span></button>}
   <Link href={tab.href} className="studio-mobile-tab" data-active={active(tab.href)||undefined} aria-current={active(tab.href)?'page':undefined} onClick={event=>moduleTap(event,tab)} aria-label={tab.label+(active(tab.href)&&moduleSections(tab.href.split('/')[2]).length?' · tap again for sections':'')}><span className="studio-mobile-tab-icon"><WorkspaceIcon name={tab.icon}/></span><span>{tab.label}</span></Link>
  </Fragment>)}
  <button aria-label="More workspace options" aria-expanded={panel==='more'} onClick={()=>setPanel('more')} className="studio-mobile-tab" data-active={panel==='more'||undefined}><span className="studio-mobile-tab-icon"><WorkspaceIcon name="more"/></span><span>More</span></button>
 </nav>
 <Sheet open={panel==='more'} onClose={close} onOpenChangeComplete={afterClose} title="Your workspace" variant="navigation" footer={<><InstallWorkspace/><button className="mobile-signout" onClick={()=>void onSignOut()}>Sign out</button></>}><p className="sheet-account">{name} · {role==='admin'?'Owner':role.replace('_',' ')}</p><nav className="studio-navigation-grid" aria-label="All workspace pages">{permitted.map(([label,href])=>tile({label,href,icon:label}))}</nav></Sheet>
 <Sheet open={panel==='create'} onClose={close} onOpenChangeComplete={afterClose} title="Create or record" variant="navigation"><div className="creation-menu">{creations.map(action=><button key={action.id} onClick={()=>{pending.current={create:action.id};close();}}><span className="creation-icon"><WorkspaceIcon name={action.icon}/></span><span><strong>{action.label}</strong><small>{action.description}</small></span><span aria-hidden="true">→</span></button>)}</div></Sheet>
 <Sheet open={panel==='sections'} onClose={close} onOpenChangeComplete={afterClose} title={sectionModule?.label||'Sections'} variant="navigation"><nav className="studio-navigation-grid" aria-label="Module sections">{moduleSections(sectionModule?.href.split('/')[2]||'').map(tile)}</nav></Sheet>
 </>;
}
