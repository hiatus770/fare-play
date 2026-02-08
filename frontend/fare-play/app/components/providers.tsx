'use client';

import { SolanaProvider } from '@solana/react-hooks';

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  return (
    <SolanaProvider
      config={{
        endpoint:
          process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT ||
          'https://api.devnet.solana.com',
      }}
    >
      {children}
    </SolanaProvider>
  );
}
