import type { Metadata, Viewport } from 'next';
import '../shared/ui.css';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/bricolage-grotesque';
import '@/components/ui/tokens.css';
import './globals.css';
import '@/components/ui/controls.css';
import '@/components/ui/sheet.css';
import '@/components/ui/mobile-bottom-nav.css';
import '@/components/ui/navigation-grid.css';
import '@/components/ui/action-footer.css';
import '@/components/ui/prompt-bar.css';
import './workspace-design.css';
import '@/components/assistant/assistant.css';
import '@/components/assistant/kinga-chat.css';
import {WorkspacePwa} from '@/components/workspace-pwa';
export const metadata: Metadata = { title: 'Kinga Asili | The art of everyday care', description: 'Natural blends. Thoughtful operations. Kinga Asili wellness blends and digital operations.', manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'default',title:'Kinga Workspace'},icons: { icon: '/icon.svg',apple:'/icons/apple-touch-icon.png' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#344936',viewportFit:'cover' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body><WorkspacePwa>{children}</WorkspacePwa></body></html>; }
