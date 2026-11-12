import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Kinga Asili | The art of everyday care', description: 'Natural, cold-pressed ginger, citrus and turmeric blends. Made with care in Nairobi.', icons: { icon: '/favicon.png' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#344936' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body>{children}</body></html>; }
