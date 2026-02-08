"use client";

import { useState, useEffect, useCallback } from "react";

export interface BettingMarket {
  id: string;
  market_vault_address: string;
  route: string;
  stop_tag: string;
  vehicle_id: string;
  created_at: string;
  freeze_time: string;
  predicted_arrival_seconds: number;
  actual_arrival_seconds: number | null;
  status: 'ACTIVE' | 'FROZEN' | 'RESOLVED' | 'CANCELLED';
  total_pool_lamports: string;
  bet_count: number;
  resolved_at: string | null;
  resolution_signature: string | null;
}

export interface BettingMarketWithStats extends BettingMarket {
  current_bet_count: number;
  current_pool_lamports: string;
  min_prediction: number | null;
  max_prediction: number | null;
  avg_prediction: number | null;
}

export function useBettingMarkets(pollInterval = 15000) {
  const [activeMarkets, setActiveMarkets] = useState<BettingMarketWithStats[]>([]);
  const [resolvedMarkets, setResolvedMarkets] = useState<BettingMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const [activeResp, resolvedResp] = await Promise.all([
        fetch("/api/betting/markets?status=active"),
        fetch("/api/betting/markets?status=resolved"),
      ]);

      if (!activeResp.ok || !resolvedResp.ok) {
        throw new Error('Failed to fetch markets');
      }

      const activeData = await activeResp.json();
      const resolvedData = await resolvedResp.json();

      setActiveMarkets(activeData.markets ?? []);
      setResolvedMarkets(resolvedData.markets ?? []);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch betting markets:", err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, pollInterval);
    return () => clearInterval(interval);
  }, [fetchMarkets, pollInterval]);

  return { activeMarkets, resolvedMarkets, loading, error, refetch: fetchMarkets };
}
