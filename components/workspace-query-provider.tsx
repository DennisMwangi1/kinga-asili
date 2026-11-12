'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
export default function WorkspaceQueryProvider({children}:{children:ReactNode}) {
  const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,gcTime:5*60*1000}}}));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
