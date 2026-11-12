'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {Toast} from '@base-ui/react/toast';
import {usePathname} from 'next/navigation';
import {CircleCheck,OctagonAlert,X} from 'lucide-react';
export function WorkspaceToasts({children}:{children:ReactNode}){
 return <Toast.Provider timeout={5000} limit={3}>{children}<ToastList/></Toast.Provider>;
}
function ToastList(){
 const {toasts,close}=Toast.useToastManager(),pathname=usePathname(),previousPath=useRef(pathname);
 useEffect(()=>{
  const moved=previousPath.current!==pathname;previousPath.current=pathname;
  for(const toast of toasts)if(toast.type==='error'&&toast.transitionStatus!=='ending'&&(toast.data?.pathname?toast.data.pathname!==pathname:moved))close(toast.id);
 },[pathname,toasts,close]);
 return <Toast.Portal><Toast.Viewport className="workspace-toast-viewport" aria-label="Workspace notifications">{toasts.filter(toast=>toast.type!=='error'||!toast.data?.pathname||toast.data.pathname===pathname).map(toast=><Toast.Root key={toast.id} toast={toast} className="workspace-toast" data-tone={toast.type} swipeDirection={['right','up']}>{toast.type==='error'?<OctagonAlert className="toast-error-icon" size={22} aria-hidden="true"/>:<CircleCheck className="toast-success-icon" size={22} aria-hidden="true"/>}<Toast.Content className="workspace-toast-content"><Toast.Title className="workspace-toast-title"/>{toast.description&&<Toast.Description className="workspace-toast-description"/>}</Toast.Content><Toast.Close className="workspace-toast-close" aria-label="Dismiss notification"><X size={18}/></Toast.Close></Toast.Root>)}</Toast.Viewport></Toast.Portal>;
}
export const useWorkspaceToast=()=>Toast.useToastManager();
