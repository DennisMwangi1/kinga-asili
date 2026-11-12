import type { ReactNode } from 'react';
import './action-footer.css';

interface ActionFooterProps { children: ReactNode; className?: string }

/** The sheet owns its border/padding; standalone page footers own theirs. */
export function ActionFooter({ children, className = '' }: ActionFooterProps) {
  return <div className={`studio-action-footer ${className}`}>{children}</div>;
}
