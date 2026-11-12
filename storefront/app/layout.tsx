import type { Metadata, Viewport } from 'next';
import '@shared/ui.css';
import './globals.css';
export const metadata: Metadata = { title: 'Kinga Asili | The art of everyday care', description: 'Natural blends. Thoughtful operations. Kinga Asili wellness blends and digital operations.', icons: { icon: '/icon.svg' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#344936' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body>{children}</body></html>; }
