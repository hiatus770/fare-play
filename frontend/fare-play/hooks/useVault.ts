"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useWalletConnection,
  useSendTransaction,
  useBalance,
} from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  type Address,
} from "@solana/kit";
import {
  getDepositInstructionDataEncoder,
  getWithdrawInstructionDataEncoder,
  VAULT_PROGRAM_ADDRESS,
} from "../app/generated/vault";

const LAMPORTS_PER_SOL = 1_000_000_000n;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

export function useVault() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [vaultAddress, setVaultAddress] = useState<Address | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const walletAddress = wallet?.account.address;
  const walletStatus = status;

  // Derive vault PDA when wallet connects
  useEffect(() => {
    async function deriveVault() {
      if (!walletAddress) {
        setVaultAddress(null);
        return;
      }

      const [pda] = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(
            new Uint8Array([118, 97, 117, 108, 116]) // "vault"
          ),
          getAddressEncoder().encode(walletAddress),
        ],
      });

      setVaultAddress(pda);
    }

    deriveVault();
  }, [walletAddress]);

  // Get vault balance
  const vaultBalance = useBalance(vaultAddress ?? undefined);
  const vaultLamports = vaultBalance?.lamports ?? 0n;
  const vaultSol = Number(vaultLamports) / Number(LAMPORTS_PER_SOL);

  const deposit = useCallback(
    async (amount: string) => {
      if (!wallet || !amount) return;

      try {
        setTxStatus("Building transaction...");

        const depositAmount = BigInt(
          Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL))
        );

        // Manually construct instruction (like VaultCard)
        const instruction = {
          programAddress: VAULT_PROGRAM_ADDRESS,
          accounts: [
            { address: walletAddress!, role: 3 }, // WritableSigner
            { address: vaultAddress!, role: 1 }, // Writable
            { address: SYSTEM_PROGRAM_ADDRESS, role: 0 }, // Readonly
          ],
          data: getDepositInstructionDataEncoder().encode({
            amount: depositAmount,
          }),
        };

        setTxStatus("Awaiting signature...");

        const signature = await send({
          instructions: [instruction],
        });

        setTxStatus(
          `Deposited! Tx: ${String(signature)?.slice(0, 20)}...`
        );

        // Sync to off-chain balance
        try {
          await fetch("/api/balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wallet_address: walletAddress,
              amount_lamports: Number(depositAmount),
            }),
          });
        } catch (syncErr) {
          console.error("Off-chain balance sync failed:", syncErr);
        }
      } catch (err: any) {
        console.error("Deposit failed:", err);
        // Log the full error details including transactionPlanResult
        if (err?.transactionPlanResult) {
          console.error("Transaction plan result:", JSON.stringify(err.transactionPlanResult, null, 2));
        }
        if (err?.cause) {
          console.error("Cause:", err.cause);
        }
        // Log all enumerable properties
        console.error("Full error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        setTxStatus(
          `Error: ${err?.message || "Unknown error"}`
        );
      }
    },
    [wallet, send]
  );

  const withdraw = useCallback(async () => {
    if (!wallet) return;

    try {
      setTxStatus("Building transaction...");

      // Manually construct instruction (like VaultCard)
      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress!, role: 3 }, // WritableSigner
          { address: vaultAddress!, role: 1 }, // Writable
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 }, // Readonly
        ],
        data: getWithdrawInstructionDataEncoder().encode({}),
      };

      setTxStatus("Awaiting signature...");

      const signature = await send({
        instructions: [instruction],
      });

      setTxStatus(
        `Withdrawn! Tx: ${String(signature)?.slice(0, 20)}...`
      );

      // Zero out off-chain balance on withdraw
      try {
        await fetch("/api/balance", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet_address: walletAddress }),
        });
      } catch (syncErr) {
        console.error("Off-chain balance zero-out failed:", syncErr);
      }
    } catch (err: any) {
      console.error("Withdraw failed:", err);
      if (err?.transactionPlanResult) {
        console.error("Transaction plan result:", JSON.stringify(err.transactionPlanResult, null, 2));
      }
      if (err?.cause) {
        console.error("Cause:", err.cause);
      }
      console.error("Full error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      setTxStatus(
        `Error: ${err?.message || "Unknown error"}`
      );
    }
  }, [wallet, send]);

  const clearStatus = useCallback(() => setTxStatus(null), []);

  return {
    walletAddress,
    walletStatus,
    vaultAddress,
    vaultSol,
    vaultLamports,
    deposit,
    withdraw,
    isSending,
    txStatus,
    clearStatus,
  };
}
