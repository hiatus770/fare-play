'use client';

import { useWalletConnection } from '@solana/react-hooks';
import { useState } from 'react';

export function WalletConnectButton({
  className = '',
  onConnect,
}: {
  className?: string;
  onConnect?: () => void;
}) {
  const { connectors, connect, disconnect, wallet, connected, isReady } = useWalletConnection();
  const [showConnectors, setShowConnectors] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Not yet hydrated on client
  if (!isReady) {
    return (
      <button
        disabled
        className={className || "px-4 py-2 bg-gray-600 text-white rounded-lg cursor-not-allowed"}
      >
        Loading...
      </button>
    );
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Connected state
  if (connected && wallet) {
    return (
      <button
        onClick={() => disconnect()}
        className={className || "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"}
      >
        {wallet.account.address ? truncateAddress(wallet.account.address) : 'Connected'}
      </button>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <button
        disabled
        className={className || "px-4 py-2 bg-gray-600 text-white rounded-lg cursor-not-allowed"}
      >
        Connecting...
      </button>
    );
  }

  // Disconnected state - show wallet selection
  if (showConnectors) {
    return (
      <div className="relative">
        <div className="absolute top-0 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[200px] z-50 p-2">
          <div className="text-sm text-gray-600 dark:text-gray-400 px-3 py-2">
            Select a wallet:
          </div>
          {connectors.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              No wallets detected. Install Phantom or Solflare.
            </div>
          ) : (
            connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={async () => {
                  try {
                    setIsConnecting(true);
                    await connect(connector.id);
                    setShowConnectors(false);
                    if (onConnect) {
                      onConnect();
                    }
                  } catch (err) {
                    console.error('Connect failed:', err);
                    alert('Failed to connect wallet. Please try again.');
                  } finally {
                    setIsConnecting(false);
                  }
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition text-sm"
              >
                {connector.name || connector.id}
              </button>
            ))
          )}
          <button
            onClick={() => setShowConnectors(false)}
            className="w-full px-3 py-2 text-left text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition text-sm mt-1"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Default: show connect button
  return (
    <button
      onClick={() => setShowConnectors(true)}
      className={className || "px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"}
    >
      Connect Wallet
    </button>
  );
}
