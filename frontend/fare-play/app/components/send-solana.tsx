'use client';

import { useState } from 'react';
import { useWalletConnection, useSendTransaction } from '@solana/react-hooks';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { Address } from '@solana/kit';

export default function SendSolana() {
  const { wallet, status: walletStatus } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('0.1');
  const [txStatus, setTxStatus] = useState('');
  const [signature, setSignature] = useState('');

  const publicKey = wallet?.account.address;
  const connected = walletStatus === 'connected';

  const sendSol = async () => {
    if (!publicKey) {
      setTxStatus('❌ Please connect your wallet first');
      return;
    }

    try {
      setTxStatus('🔄 Creating transaction...');

      // Validate recipient address
      const recipientAddress = recipient as Address;

      // Convert SOL to lamports
      const lamports = BigInt(Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL));

      // Create transfer instruction using @solana/react-hooks format
      const instruction = {
        programAddress: "11111111111111111111111111111111" as Address, // System Program
        accounts: [
          { address: publicKey, role: 3 as const }, // WritableSigner
          { address: recipientAddress, role: 1 as const }, // Writable
        ],
        data: new Uint8Array([2, 0, 0, 0, ...new Uint8Array(new BigUint64Array([lamports]).buffer)]),
      };

      setTxStatus('✍️ Waiting for wallet approval...');

      // Send transaction
      const sig = await send({ instructions: [instruction] });

      setTxStatus('✅ Transaction successful!');
      setSignature(sig || '');
      console.log('Transaction signature:', sig);

    } catch (error: any) {
      console.error('Error:', error);
      setTxStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Send SOL</h1>

      {connected && publicKey && (
        <div className="space-y-6">
          {/* Your Address */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Your Wallet</p>
            <p className="font-mono text-sm break-all">{publicKey}</p>
          </div>

          {/* Recipient Input */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Enter Solana wallet address"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 font-mono text-sm"
              disabled={isSending}
            />
            <p className="text-xs text-gray-400 mt-1">
              Paste the recipient's wallet address here
            </p>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Amount (SOL)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="0.01"
              min="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
              disabled={isSending}
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter amount in SOL (e.g., 0.1)
            </p>
          </div>

          {/* Status Display */}
          {txStatus && (
            <div className={`p-4 rounded-lg ${
              txStatus.includes('✅') ? 'bg-green-900/30 border border-green-500' :
              txStatus.includes('❌') ? 'bg-red-900/30 border border-red-500' :
              'bg-blue-900/30 border border-blue-500'
            }`}>
              <p>{txStatus}</p>
            </div>
          )}

          {/* Transaction Link */}
          {signature && (
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">Transaction Signature</p>
              <p className="font-mono text-xs break-all mb-3">{signature}</p>
              <a
                href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                View on Solana Explorer →
              </a>
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={sendSol}
            disabled={isSending || !recipient || !amount || parseFloat(amount) <= 0}
            className={`w-full p-4 rounded-lg font-bold text-lg transition ${
              isSending || !recipient || !amount || parseFloat(amount) <= 0
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isSending ? 'Sending...' : `Send ${amount} SOL`}
          </button>
        </div>
      )}

      {!connected && (
        <div className="text-center text-gray-400 mt-8">
          <p>Connect your wallet to send SOL</p>
        </div>
      )}
    </div>
  );
}