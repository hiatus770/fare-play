"use client";

import React, { useState, useMemo } from "react";
import {
  calculatePrices,
  calculateSharesForCost,
  calculateBuyCost,
  type LMSRState,
  type Outcome,
} from "../../lib/lmsr";
import type { MarketData } from "../../hooks/useMarkets";

const LAMPORTS_PER_SOL = 1_000_000_000;

interface BetPanelProps {
  market: MarketData;
  selectedOutcome: string;
  walletAddress: string;
  offChainBalance: number; // lamports
  onClose: () => void;
  onSuccess: () => void;
}

export function BetPanel({
  market,
  selectedOutcome,
  walletAddress,
  offChainBalance,
  onClose,
  onSuccess,
}: BetPanelProps) {
  const [outcome, setOutcome] = useState<Outcome>(selectedOutcome as Outcome);
  const [solAmount, setSolAmount] = useState("0.01");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state: LMSRState = {
    q_early: market.q_early,
    q_ontime: market.q_ontime,
    q_late: market.q_late,
    b: market.b,
  };

  const amountLamports = Math.floor(parseFloat(solAmount || "0") * LAMPORTS_PER_SOL);

  // Client-side LMSR preview
  const preview = useMemo(() => {
    if (amountLamports <= 0) return null;
    const shares = calculateSharesForCost(state, outcome, amountLamports);
    const cost = calculateBuyCost(state, outcome, shares);
    const newState: LMSRState = {
      ...state,
      q_early: state.q_early + (outcome === "EARLY" ? shares : 0),
      q_ontime: state.q_ontime + (outcome === "ON_TIME" ? shares : 0),
      q_late: state.q_late + (outcome === "LATE" ? shares : 0),
    };
    const newPrices = calculatePrices(newState);
    const currentPrices = calculatePrices(state);
    return {
      shares,
      cost,
      potentialPayout: shares,
      currentPrice: currentPrices[outcome],
      newPrice: newPrices[outcome],
      priceImpact: newPrices[outcome] - currentPrices[outcome],
    };
  }, [amountLamports, outcome, state.q_early, state.q_ontime, state.q_late, state.b]);

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const resp = await fetch(`/api/markets/${market.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: walletAddress,
          outcome,
          amount_lamports: amountLamports,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Purchase failed");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const balanceSol = (offChainBalance / LAMPORTS_PER_SOL).toFixed(4);
  const insufficientBalance = amountLamports > offChainBalance;

  const outcomes: Array<{ key: Outcome; label: string; color: string }> = [
    { key: "EARLY", label: "Early", color: "#4ade80" },
    { key: "ON_TIME", label: "On Time", color: "#facc15" },
    { key: "LATE", label: "Late", color: "#f87171" },
  ];

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontWeight: 700, fontSize: "15px", color: "#fff" }}>
          Place Bet — Route {market.route_tag} Vehicle {market.vehicle_id}
        </span>
        <button onClick={onClose} style={closeBtnStyle}>
          &times;
        </button>
      </div>

      {/* Balance */}
      <div style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
        Betting balance: {balanceSol} SOL
      </div>

      {/* Outcome selector */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        {outcomes.map((o) => (
          <button
            key={o.key}
            onClick={() => setOutcome(o.key)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: "6px",
              border: `2px solid ${o.color}`,
              background: outcome === o.key ? o.color : "transparent",
              color: outcome === o.key ? "#000" : o.color,
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div style={{ marginBottom: "12px" }}>
        <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "4px" }}>
          Amount (SOL)
        </label>
        <input
          type="number"
          min="0"
          step="0.001"
          value={solAmount}
          onChange={(e) => setSolAmount(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Preview */}
      {preview && preview.shares > 0 && (
        <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "10px", marginBottom: "12px", border: "1px solid #333" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#ccc", marginBottom: "4px" }}>
            <span>Shares</span>
            <span>{preview.shares.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#ccc", marginBottom: "4px" }}>
            <span>Potential payout</span>
            <span>{(preview.potentialPayout / LAMPORTS_PER_SOL).toFixed(6)} SOL</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#ccc", marginBottom: "4px" }}>
            <span>Current price</span>
            <span>{(preview.currentPrice * 100).toFixed(1)}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#ccc" }}>
            <span>Price after</span>
            <span>
              {(preview.newPrice * 100).toFixed(1)}%
              <span style={{ color: preview.priceImpact > 0 ? "#f87171" : "#4ade80", marginLeft: "4px" }}>
                ({preview.priceImpact > 0 ? "+" : ""}
                {(preview.priceImpact * 100).toFixed(1)}%)
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "8px" }}>{error}</div>
      )}
      {insufficientBalance && (
        <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "8px" }}>
          Insufficient balance. Deposit more SOL.
        </div>
      )}

      {/* Confirm */}
      <button
        onClick={handleConfirm}
        disabled={submitting || amountLamports <= 0 || insufficientBalance}
        style={{
          ...confirmBtnStyle,
          opacity: submitting || amountLamports <= 0 || insufficientBalance ? 0.4 : 1,
          cursor: submitting || amountLamports <= 0 || insufficientBalance ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Confirming..." : "Confirm Bet"}
      </button>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "#252525",
  borderRadius: "10px",
  padding: "16px",
  marginBottom: "10px",
  border: "1px solid #444",
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#888",
  fontSize: "20px",
  cursor: "pointer",
  padding: "0 4px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
};

const confirmBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "none",
  background: "#fff",
  color: "#000",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};
