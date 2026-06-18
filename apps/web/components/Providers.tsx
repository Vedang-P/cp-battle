'use client';

import { SessionProvider } from 'next-auth/react';
import { AudioPlayerProvider } from '@/lib/audio-player';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AudioPlayerProvider>{children}</AudioPlayerProvider>
    </SessionProvider>
  );
}
