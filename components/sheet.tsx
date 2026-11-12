'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import { useMobile } from '@/lib/use-mobile';

const FooterTarget = createContext<HTMLElement | null | undefined>(undefined);
/** Forms can place totals/actions in the sheet's pinned footer without a second scroll container. */
export function SheetFooter({ children }: { children: ReactNode }) {
  const target = useContext(FooterTarget);
  return target === undefined ? <>{children}</> : target ? createPortal(children, target) : null;
}

/** Adapted from andishixkikapu/studio/src/ui/Sheet.tsx. Base UI owns gestures, focus and presence. */
export default function Sheet({ open, onClose, title, children, footer, variant = 'default', busy = false, onOpenChangeComplete, headerContent, contentHeader }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
  headerContent?: ReactNode; contentHeader?: ReactNode; footer?: ReactNode; variant?: 'default' | 'navigation' | 'assistant'; busy?: boolean;
  onOpenChangeComplete?: (open: boolean) => void;
}) {
  const mobile = useMobile();
  const side = mobile ? 'bottom' : 'right';
  const [footerTarget, setFooterTarget] = useState<HTMLElement | null>(null);
  return <Drawer.Root modal open={open} swipeDirection={side === 'right' ? 'right' : 'down'}
    onOpenChange={(next, event) => { if (!next) { if (busy) event.cancel(); else onClose(); } }}
    onOpenChangeComplete={onOpenChangeComplete}>
    <Drawer.Portal>
      <Drawer.Backdrop className="studio-sheet-backdrop"/>
      <Drawer.Viewport className="studio-sheet-viewport" data-side={side} data-variant={variant}>
        <Drawer.Popup className="studio-sheet" data-side={side} data-variant={variant}>
          <Drawer.VirtualKeyboardProvider>
            <FooterTarget.Provider value={footerTarget}>
              {side === 'bottom' && <div className="studio-sheet-handle" aria-hidden="true"><span/></div>}
              <header className="studio-sheet-header">
                <Drawer.Title className="studio-sheet-title">{title}</Drawer.Title>
                {headerContent}
                <Drawer.Close className="studio-button studio-button--tertiary studio-button--icon sheet-close" aria-label={`Close ${title}`} disabled={busy}><X size={20} strokeWidth={1.75}/></Drawer.Close>
              </header>
              {contentHeader && <div className="studio-sheet-content-header">{contentHeader}</div>}
              <Drawer.Content className="studio-sheet-body">{children}</Drawer.Content>
              <footer className="studio-sheet-footer" ref={setFooterTarget} data-base-ui-swipe-ignore>{footer}</footer>
            </FooterTarget.Provider>
          </Drawer.VirtualKeyboardProvider>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>;
}
