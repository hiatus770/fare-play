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
      if (!walletAddress || !vaultAddress || !amount) return;

      try {
        setTxStatus("Building transaction...");

        const depositAmount = BigInt(
          Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL))
        );

        const instruction = {
          programAddress: VAULT_PROGRAM_ADDRESS,
          accounts: [
            { address: walletAddress, role: 3 as const },
            { address: vaultAddress, role: 1 as const },
            { address: SYSTEM_PROGRAM_ADDRESS, role: 0 as const },
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
      } catch (err) {
        console.error("Deposit failed:", err);
        setTxStatus(
          `Error: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    },
    [walletAddress, vaultAddress, send]
  );

  const withdraw = useCallback(async () => {
    if (!walletAddress || !vaultAddress) return;

    try {
      setTxStatus("Building transaction...");

      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress, role: 3 as const },
          { address: vaultAddress, role: 1 as const },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 as const },
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
    } catch (err) {
      console.error("Withdraw failed:", err);
      setTxStatus(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }, [walletAddress, vaultAddress, send]);

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
