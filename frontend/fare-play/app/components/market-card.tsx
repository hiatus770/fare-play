"use client";

import React from "react";
import type { MarketData } from "../../hooks/useMarkets";

interface MarketCardProps {
  market: MarketData;
  onBet?: (market: MarketData, outcome: string) => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

export function MarketCard({ market, onBet }: MarketCardProps) {
  const isOpen = market.status === "open";
  const isResolved = market.status === "resolved";

  const closesAt = new Date(market.closes_at);
  const now = new Date();
  const remainingMs = closesAt.getTime() - now.getTime();
  const remainingMin = Math.max(0, Math.floor(remainingMs / 60000));
  const remainingSec = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

  const volume = (market.total_volume_lamports / LAMPORTS_PER_SOL).toFixed(4);

  const prices = market.prices ?? { EARLY: 0.333, ON_TIME: 0.334, LATE: 0.333 };

  const outcomes = [
    { key: "EARLY", label: "Early", color: "#2e7d32", bg: "#e8f5e9", price: prices.EARLY },
    { key: "ON_TIME", label: "On Time", color: "#f57f17", bg: "#fff8e1", price: prices.ON_TIME },
    { key: "LATE", label: "Late", color: "#c62828", bg: "#ffebee", price: prices.LATE },
  ];

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: "15px", color: "#1a1a1a" }}>
            Route {market.route_tag}
          </span>
          <span style={{ color: "#6c757d", fontSize: "13px", marginLeft: "8px" }}>
            Stop {market.stop_tag}
          </span>
        </div>
        <span
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "6px",
            fontWeight: 600,
            background: isOpen ? "#e8f5e9" : isResolved ? "#e8f4fd" : "#ffebee",
            color: isOpen ? "#2e7d32" : isResolved ? "#0088CE" : "#c62828",
          }}
        >
          {market.status.toUpperCase()}
        </span>
      </div>

      {/* Vehicle + ETA */}
      <div style={{ fontSize: "13px", color: "#6c757d", marginBottom: "8px" }}>
        Vehicle {market.vehicle_id}
        {market.direction && <span> &middot; {market.direction}</span>}
        <span style={{ marginLeft: "8px" }}>
          ETA: {Math.floor(market.predicted_eta_seconds / 60)}m {market.predicted_eta_seconds % 60}s
        </span>
      </div>

      {/* Time remaining / Resolved outcome */}
      {isOpen && (
        <div style={{ fontSize: "12px", color: "#6c757d", marginBottom: "10px" }}>
          {remainingMs > 0
            ? `Closes in ${remainingMin}m ${remainingSec}s`
            : "Awaiting resolution..."}
        </div>
      )}
      {isResolved && market.resolved_outcome && (
        <div style={{ fontSize: "13px", marginBottom: "10px" }}>
          <span style={{ color: "#0088CE", fontWeight: 600 }}>
            Resolved: {market.resolved_outcome}
          </span>
          {market.error_seconds !== null && (
            <span style={{ color: "#6c757d", marginLeft: "8px" }}>
              (error: {market.error_seconds.toFixed(0)}s)
            </span>
          )}
        </div>
      )}

      {/* Probability bars */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ display: "flex", borderRadius: "6px", overflow: "hidden", height: "24px" }}>
          {outcomes.map((o) => (
            <div
              key={o.key}
              style={{
                width: `${Math.max(o.price * 100, 2)}%`,
                background: o.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: 700,
                color: "#fff",
                transition: "width 0.3s ease",
              }}
              title={`${o.label}: ${(o.price * 100).toFixed(1)}%`}
            >
              {o.price >= 0.1 ? `${(o.price * 100).toFixed(0)}%` : ""}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
          {outcomes.map((o) => (
            <span key={o.key} style={{ fontSize: "11px", color: o.color, fontWeight: 500 }}>
              {o.label} {(o.price * 100).toFixed(1)}%
            </span>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div style={{ fontSize: "11px", color: "#adb5bd", marginBottom: "8px" }}>
        Volume: {volume} SOL
      </div>

      {/* Bet buttons */}
      {isOpen && onBet && remainingMs > 0 && (
        <div style={{ display: "flex", gap: "6px" }}>
          {outcomes.map((o) => (
            <button
              key={o.key}
              onClick={() => onBet(market, o.key)}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: "8px",
                border: `1.5px solid ${o.color}`,
                background: o.bg,
                color: o.color,
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Bet {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "10px",
  border: "1.5px solid #e9ecef",
};
