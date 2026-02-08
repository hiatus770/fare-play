"use client";

import { useState, useEffect, useCallback } from "react";

export interface MarketData {
  id: string;
  route_tag: string;
  stop_tag: string;
  vehicle_id: string;
  direction: string | null;
  predicted_eta_seconds: number;
  q_early: number;
  q_ontime: number;
  q_late: number;
  b: number;
  status: string;
  resolved_outcome: string | null;
  error_seconds: number | null;
  total_volume_lamports: number;
  created_at: string;
  closes_at: string;
  resolved_at: string | null;
  prices: { EARLY: number; ON_TIME: number; LATE: number };
}

export function useMarkets(pollInterval = 15000) {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [resolvedMarkets, setResolvedMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    try {
      const [openResp, resolvedResp] = await Promise.all([
        fetch("/api/markets?status=open"),
        fetch("/api/markets?status=resolved"),
      ]);
      const openData = await openResp.json();
      const resolvedData = await resolvedResp.json();
      setMarkets(openData.markets ?? []);
      setResolvedMarkets(resolvedData.markets ?? []);
    } catch (err) {
      console.error("Failed to fetch markets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, pollInterval);
    return () => clearInterval(interval);
  }, [fetchMarkets, pollInterval]);

  return { markets, resolvedMarkets, loading, refetch: fetchMarkets };
}
