"use client";

import { useState, useEffect, useCallback } from "react";

export function useOffChainBalance(walletAddress: string | undefined) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(0);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/balance?wallet=${walletAddress}`);
      const data = await resp.json();
      setBalance(data.balance_lamports ?? 0);
    } catch (err) {
      console.error("Failed to fetch off-chain balance:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, refetch: fetchBalance };
}
