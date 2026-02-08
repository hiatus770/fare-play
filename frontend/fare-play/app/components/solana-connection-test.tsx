'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useState, useEffect } from 'react';

export default function SolanaConnectionTest() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // Test connection on mount
  useEffect(() => {
    testConnection();
  }, []);

  // Get balance when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      getBalance();
    } else {
      setBalance(null);
    }
  }, [connected, publicKey]);

  const testConnection = async () => {
    try {
      setNetworkStatus('checking');
      const version = await connection.getVersion();
      console.log('Solana version:', version);
      setNetworkStatus('connected');
    } catch (error) {
      console.error('Connection error:', error);
      setNetworkStatus('error');
    }
  };

  const getBalance = async () => {
    if (!publicKey) return;
    
    try {
      setIsLoading(true);
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Error getting balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Solana Connection Test</h1>
      
      {/* Network Status */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">Network Status</h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            networkStatus === 'connected' ? 'bg-green-500' :
            networkStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
          }`} />
          <span>
            {networkStatus === 'connected' ? 'Connected to Solana' :
             networkStatus === 'error' ? 'Connection Error' : 'Checking...'}
          </span>
        </div>
        <button 
          onClick={testConnection}
          className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
        >
          Retest Connection
        </button>
      </div>

      {/* Wallet Status */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">Wallet Status</h2>
        {connected ? (
          <div>
            <p className="text-green-400 mb-2">✓ Wallet Connected</p>
            <p className="text-sm text-gray-400 break-all mb-3">
              Address: {publicKey?.toBase58()}
            </p>
            
            {isLoading ? (
              <p>Loading balance...</p>
            ) : balance !== null ? (
              <div className="bg-gray-700 p-3 rounded">
                <p className="text-2xl font-bold">{balance.toFixed(4)} SOL</p>
              </div>
            ) : null}
            
            <button 
              onClick={getBalance}
              className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
              disabled={isLoading}
            >
              Refresh Balance
            </button>
          </div>
        ) : (
          <p className="text-yellow-400">Please connect your wallet</p>
        )}
      </div>

      {/* Quick Info */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-2">Connection Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Endpoint:</span>
            <span className="text-blue-400">{connection.rpcEndpoint}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Commitment:</span>
            <span>{connection.commitment}</span>
          </div>
        </div>
      </div>
    </div>
  );
}