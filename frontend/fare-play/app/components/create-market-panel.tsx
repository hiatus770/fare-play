"use client";

import React, { useState, useEffect } from "react";

interface Prediction {
  vehicle_id: string;
  current_eta_seconds: number;
  current_eta_display: string;
  direction: string;
}

interface CreateMarketPanelProps {
  onCreated: () => void;
}

const ROUTES = [
  { tag: "501", name: "Queen" },
  { tag: "503", name: "King" },
];

const MIN_ETA_SECONDS = 120; // Filter out vehicles arriving in <2 minutes

export function CreateMarketPanel({ onCreated }: CreateMarketPanelProps) {
  const [selectedRoute, setSelectedRoute] = useState(ROUTES[0].tag);
  const [stopTag, setStopTag] = useState("24211");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/ttc/predictions?route=${selectedRoute}&stop=${stopTag}`);
      const data = await resp.json();
      if (data.current_predictions) {
        setPredictions(
          data.current_predictions.filter(
            (p: Prediction) => p.current_eta_seconds >= MIN_ETA_SECONDS
          )
        );
      } else {
        setPredictions([]);
        if (data.error) setError(data.error);
      }
    } catch {
      setError("Failed to fetch TTC predictions");
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, [selectedRoute, stopTag]);

  const handleCreate = async (prediction: Prediction) => {
    setCreating(prediction.vehicle_id);
    setError(null);

    try {
      const resp = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_tag: selectedRoute,
          stop_tag: stopTag,
          vehicle_id: prediction.vehicle_id,
          direction: prediction.direction,
          predicted_eta_seconds: prediction.current_eta_seconds,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Failed to create market");
        return;
      }

      onCreated();
    } catch {
      setError("Network error creating market");
    } finally {
      setCreating(null);
    }
  };

  return (
    <div>
      {/* Route selector */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
        {ROUTES.map((r) => (
          <button
            key={r.tag}
            onClick={() => setSelectedRoute(r.tag)}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "8px",
              border: "1.5px solid " + (selectedRoute === r.tag ? "#0088CE" : "#dee2e6"),
              background: selectedRoute === r.tag ? "#e8f4fd" : "#ffffff",
              color: selectedRoute === r.tag ? "#0088CE" : "#6c757d",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {r.tag} {r.name}
          </button>
        ))}
      </div>

      {/* Stop input */}
      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "12px", color: "#6c757d", display: "block", marginBottom: "4px" }}>
          Stop Tag
        </label>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            value={stopTag}
            onChange={(e) => setStopTag(e.target.value)}
            style={inputStyle}
            placeholder="e.g. 24211"
          />
          <button onClick={fetchPredictions} disabled={loading} style={refreshBtnStyle}>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: "#c62828", fontSize: "13px", marginBottom: "8px" }}>{error}</div>
      )}

      {/* Vehicle list */}
      <div style={{ maxHeight: "300px", overflowY: "auto" }}>
        {predictions.length === 0 && !loading ? (
          <div style={{ color: "#6c757d", fontSize: "13px", textAlign: "center", padding: "16px" }}>
            No vehicles with ETA &gt; 2 min
          </div>
        ) : (
          predictions.map((p) => (
            <div key={p.vehicle_id} style={vehicleRowStyle}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "#1a1a1a" }}>
                  Vehicle {p.vehicle_id}
                </div>
                <div style={{ fontSize: "12px", color: "#6c757d" }}>
                  {p.direction} &middot; ETA: {p.current_eta_display} ({p.current_eta_seconds}s)
                </div>
              </div>
              <button
                onClick={() => handleCreate(p)}
                disabled={creating === p.vehicle_id}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "1.5px solid #2e7d32",
                  background: "#e8f5e9",
                  color: "#2e7d32",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: creating === p.vehicle_id ? "not-allowed" : "pointer",
                  opacity: creating === p.vehicle_id ? 0.5 : 1,
                  transition: "all 0.15s",
                }}
              >
                {creating === p.vehicle_id ? "Creating..." : "Create Market"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1.5px solid #dee2e6",
  background: "#ffffff",
  color: "#1a1a1a",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const refreshBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1.5px solid #dee2e6",
  background: "#f8f9fa",
  color: "#1a1a1a",
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.15s",
};

const vehicleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#ffffff",
  borderRadius: "10px",
  padding: "12px 14px",
  marginBottom: "6px",
  border: "1.5px solid #e9ecef",
};
