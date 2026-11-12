import {WorkspaceToasts} from '@/components/workspace-toasts';
import Operations from '@/components/operations';
import WorkspaceQueryProvider from '@/components/workspace-query-provider';

// Own the workspace above the changing route segment so navigation preserves
// its authenticated snapshot, navigation and assistant conversation.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceQueryProvider><WorkspaceToasts><Operations assistantRoles={(process.env.ASSISTANT_ROLES || 'admin').split(',').map(role => role.trim())}/>{children}</WorkspaceToasts></WorkspaceQueryProvider>;
}
