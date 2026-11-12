'use client';
import { useSyncExternalStore } from 'react';
import { DESIGN_TOKENS } from '@/components/ui/theme/designTokens';
const query = `(max-width: ${DESIGN_TOKENS.layout.mobileBreakpoint - 1}px)`;
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export function useMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
