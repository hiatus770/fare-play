"use client";

import React, { useState } from "react";
import { MarketCard } from "./market-card";
import type { MarketData } from "../../hooks/useMarkets";

interface MarketListProps {
  markets: MarketData[];
  resolvedMarkets: MarketData[];
  loading: boolean;
  onBet?: (market: MarketData, outcome: string) => void;
}

export function MarketList({ markets, resolvedMarkets, loading, onBet }: MarketListProps) {
  const [tab, setTab] = useState<"active" | "resolved">("active");

  const displayedMarkets = tab === "active" ? markets : resolvedMarkets;

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
        <button
          onClick={() => setTab("active")}
          style={{
            ...tabStyle,
            background: tab === "active" ? "#e8f4fd" : "#ffffff",
            color: tab === "active" ? "#0088CE" : "#6c757d",
            border: "1.5px solid " + (tab === "active" ? "#0088CE" : "#dee2e6"),
          }}
        >
          Active ({markets.length})
        </button>
        <button
          onClick={() => setTab("resolved")}
          style={{
            ...tabStyle,
            background: tab === "resolved" ? "#e8f4fd" : "#ffffff",
            color: tab === "resolved" ? "#0088CE" : "#6c757d",
            border: "1.5px solid " + (tab === "resolved" ? "#0088CE" : "#dee2e6"),
          }}
        >
          Resolved ({resolvedMarkets.length})
        </button>
      </div>

      {/* Content */}
      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ color: "#6c757d", fontSize: "14px", textAlign: "center", padding: "20px" }}>
            Loading markets...
          </div>
        ) : displayedMarkets.length === 0 ? (
          <div style={{ color: "#6c757d", fontSize: "14px", textAlign: "center", padding: "20px" }}>
            {tab === "active" ? "No active markets" : "No resolved markets"}
          </div>
        ) : (
          displayedMarkets.map((m) => (
            <MarketCard
              key={m.id}
              market={m}
              onBet={tab === "active" ? onBet : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

const tabStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s",
};
