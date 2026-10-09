'use client';

import { SWRConfig } from 'swr';
import { api } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ fetcher: (path: string) => api(path), revalidateOnFocus: false }}>
    <AuthProvider>{children}</AuthProvider>
  </SWRConfig>
);
