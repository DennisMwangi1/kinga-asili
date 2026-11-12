'use client';
import { useEffect } from 'react';
export function useDialog(active: boolean, close: () => void) { useEffect(() => { if (!active)
    return; const previous = document.activeElement as HTMLElement | null; const dialog = document.querySelector<HTMLElement>('[role="dialog"]'); const first = dialog?.querySelector<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]'); first?.focus(); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') {
    close();
    return;
} if (e.key !== 'Tab' || !dialog)
    return; const elements = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([type="hidden"]):not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]')).filter(e => e.offsetParent !== null); const first = elements[0], last = elements.at(-1); if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
}
else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
} }; document.addEventListener('keydown', handle); return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handle); previous?.focus(); }; }, [active, close]); }
