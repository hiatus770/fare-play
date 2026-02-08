'use client';

import { SolanaProvider } from '@solana/react-hooks';
import { useMemo } from 'react';

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com',
    []
  );

  return (
    <SolanaProvider
      config={{
        endpoint,
        commitment: 'confirmed',
      }}
    >
      {children}
    </SolanaProvider>
  );
}
