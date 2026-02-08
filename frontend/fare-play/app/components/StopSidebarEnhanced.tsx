"use client";
import React, { useState, useEffect } from "react";

interface RouteOption {
  tag: string;
  name: string;
  color: string;
}

interface Stop {
  tag: string;
  title: string;
  route: string;
}

interface Prediction {
  vehicle_id: string;
  current_eta_display: string;
  current_eta_seconds: number;
}

interface FrozenPrediction {
  vehicle_id: string;
  frozen_at: string;
  frozen_prediction_display: string;
  actual_elapsed_display: string;
  error_display: string;
  status: string;
}

interface CommunityMetrics {
  totalBets: number;
  uniqueBettors: number;
  mostPopularTime: string;
  averagePrediction: number;
  successRate: number;
}

interface VehicleStats {
  vehicle_id: string;
  betCount: number;
  averagePrediction: number;
  successRate: number;
}

interface StopSidebarEnhancedProps {
  selectedRoute?: string | null;
  selectedStop?: {
    tag: string;
    title: string;
    route: string;
  } | null;
  selectedVehicle?: string | null;
  onRouteSelect?: (route: string) => void;
  onStopSelect?: (stop: {
    tag: string;
    title: string;
    route: string;
  }) => void;
  onVehicleSelect?: (vehicleId: string) => void;
}

const StopSidebarEnhanced: React.FC<StopSidebarEnhancedProps> = ({
  selectedRoute: externalSelectedRoute,
  selectedStop: externalSelectedStop,
  selectedVehicle: externalSelectedVehicle,
  onRouteSelect,
  onStopSelect,
  onVehicleSelect,
}) => {
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [routes] = useState<RouteOption[]>([
    { tag: "501", name: "Queen Streetcar", color: "#FF6B6B" },
    { tag: "503", name: "King Streetcar", color: "#4ECDC4" },
  ]);

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [frozenPredictions, setFrozenPredictions] = useState<FrozenPrediction[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [betAmount, setBetAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Community metrics (TODO: Connect to user DB backend)
  const [communityMetrics, setCommunityMetrics] = useState<CommunityMetrics | null>(null);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats | null>(null);

  // Sync with external props
  useEffect(() => {
    if (externalSelectedRoute) {
      const route = routes.find((r) => r.tag === externalSelectedRoute);
      if (route) {
        setSelectedRoute(route);
      }
    }
  }, [externalSelectedRoute, routes]);

  useEffect(() => {
    if (externalSelectedStop) {
      setSelectedStop(externalSelectedStop as Stop);
    }
  }, [externalSelectedStop]);

  useEffect(() => {
    if (externalSelectedVehicle) {
      setSelectedVehicle(externalSelectedVehicle);
    }
  }, [externalSelectedVehicle]);

  // Fetch predictions when stop is selected
  useEffect(() => {
    if (selectedStop && selectedRoute) {
      fetchPredictions(selectedRoute.tag, selectedStop.tag);
    }
  }, [selectedStop, selectedRoute]);

  // Fetch community metrics when stop is selected
  useEffect(() => {
    if (selectedStop && selectedRoute) {
      fetchCommunityMetrics(selectedRoute.tag, selectedStop.tag);
    }
  }, [selectedStop, selectedRoute]);

  // Update vehicle stats when vehicle is selected
  useEffect(() => {
    if (selectedVehicle && selectedRoute && selectedStop) {
      fetchVehicleStats(selectedRoute.tag, selectedStop.tag, selectedVehicle);
    }
  }, [selectedVehicle, selectedRoute, selectedStop]);

  const fetchPredictions = async (route: string, stop: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/stop/${route}/${stop}`
      );
      if (!response.ok) throw new Error("Failed to fetch predictions");

      const data = await response.json();
      setPredictions(data.current_predictions || []);
      setFrozenPredictions(data.frozen_predictions_history || []);
      setError("");
    } catch (err) {
      setError(`Failed to load predictions: ${err}`);
      setPredictions([]);
      setFrozenPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommunityMetrics = async (route: string, stop: string) => {
    try {
      // TODO: Replace with actual backend API call
      // const response = await fetch(`/api/community/metrics/${route}/${stop}`);
      // const data = await response.json();
      // setCommunityMetrics(data);

      // Mock data for now
      setCommunityMetrics({
        totalBets: Math.floor(Math.random() * 150) + 20,
        uniqueBettors: Math.floor(Math.random() * 50) + 10,
        mostPopularTime: (Math.floor(Math.random() * 60) + 20).toString(),
        averagePrediction: Math.floor(Math.random() * 60) + 15,
        successRate: Math.floor(Math.random() * 30) + 50,
      });
    } catch (err) {
      console.error("Failed to fetch community metrics:", err);
    }
  };

  const fetchVehicleStats = async (route: string, stop: string, vehicle: string) => {
    try {
      // TODO: Replace with actual backend API call
      // const response = await fetch(`/api/stats/vehicle/${route}/${stop}/${vehicle}`);
      // const data = await response.json();
      // setVehicleStats(data);

      // Mock data for now
      setVehicleStats({
        vehicle_id: vehicle,
        betCount: Math.floor(Math.random() * 50) + 5,
        averagePrediction: Math.floor(Math.random() * 60) + 10,
        successRate: Math.floor(Math.random() * 40) + 45,
      });
    } catch (err) {
      console.error("Failed to fetch vehicle stats:", err);
    }
  };

  const handleRouteSelect = (route: RouteOption) => {
    setSelectedRoute(route);
    setSelectedStop(null);
    setPredictions([]);
    setFrozenPredictions([]);
    setSelectedVehicle(null);
    setCommunityMetrics(null);
    setVehicleStats(null);
    if (onRouteSelect) {
      onRouteSelect(route.tag);
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
    setSelectedTime("");
    if (onVehicleSelect) {
      onVehicleSelect(vehicleId);
    }
  };

  const handleBet = async () => {
    if (!selectedVehicle || !selectedTime || !betAmount || !selectedStop) {
      setError("Please select vehicle, time, and enter bet amount");
      return;
    }

    setLoading(true);
    try {
      // TODO: Connect to Solana wallet and backend API for bet placement
      console.log("Placing bet:", {
        route: selectedRoute?.tag,
        stop: selectedStop.tag,
        vehicle: selectedVehicle,
        predictedTime: selectedTime,
        betAmount: betAmount,
      });

      setSuccess("Bet placed successfully!");
      setBetAmount("");
      setSelectedTime("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(`Failed to place bet: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "60px",
        left: 0,
        width: "450px",
        height: "calc(100vh - 60px)",
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        overflowY: "auto",
        zIndex: 10,
        padding: "20px",
        boxSizing: "border-box",
        boxShadow: "2px 0 20px rgba(0,0,0,0.5)",
      }}
    >
      {/* Step 1: Select Route */}
      {!selectedRoute && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ color: "#4ECDC4", fontSize: "12px", fontWeight: "600", marginBottom: "12px" }}>
            STEP 1: SELECT ROUTE
          </div>
          {routes.map((route) => (
            <button
              key={route.tag}
              onClick={() => handleRouteSelect(route)}
              style={{
                width: "100%",
                padding: "12px",
                marginBottom: "8px",
                background: "#232323",
                border: "1.5px solid #333",
                borderRadius: "8px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "14px",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = route.color;
                e.currentTarget.style.background = "rgba(79, 204, 196, 0.1)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "#333";
                e.currentTarget.style.background = "#232323";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: route.color,
                    borderRadius: "2px",
                  }}
                />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: "600" }}>Route {route.tag}</div>
                  <div style={{ fontSize: "12px", color: "#aaa" }}>{route.name}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Select Stop */}
      {selectedRoute && !selectedStop && (
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setSelectedRoute(null)}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#232323",
              border: "1px solid #333",
              borderRadius: "6px",
              color: "#aaa",
              cursor: "pointer",
              fontSize: "12px",
              marginBottom: "12px",
            }}
          >
            ← Change Route
          </button>

          <div style={{ color: "#4ECDC4", fontSize: "12px", fontWeight: "600", marginBottom: "12px" }}>
            STEP 2: SELECT STOP
          </div>

          <input
            type="text"
            placeholder="Search stops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              background: "#232323",
              border: "1.5px solid #333",
              borderRadius: "6px",
              color: "#fff",
              marginBottom: "12px",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />

          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              background: "#1a1a1a",
              borderRadius: "6px",
              border: "1px solid #333",
            }}
          >
            <p
              style={{
                color: "#aaa",
                fontSize: "12px",
                padding: "12px",
                textAlign: "center",
                margin: "0",
              }}
            >
              Stops will appear here (click on map)
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Select Vehicle & Place Bet */}
      {selectedRoute && selectedStop && (
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setSelectedStop(null)}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#232323",
              border: "1px solid #333",
              borderRadius: "6px",
              color: "#aaa",
              cursor: "pointer",
              fontSize: "12px",
              marginBottom: "12px",
            }}
          >
            ← Change Stop
          </button>

          {/* Stop Info Card */}
          <div
            style={{
              background: "#232323",
              border: "1.5px solid #333",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "16px",
            }}
          >
            <div style={{ color: "#4ECDC4", fontSize: "11px", fontWeight: "600", marginBottom: "6px" }}>
              SELECTED STOP
            </div>
            <div style={{ color: "#fff", fontSize: "13px", fontWeight: "600" }}>
              {selectedStop.title}
            </div>
            <div style={{ color: "#aaa", fontSize: "11px", marginTop: "4px" }}>
              Route {selectedRoute.tag}
            </div>
          </div>

          {/* Community Activity Stats */}
          {communityMetrics && (
            <div
              style={{
                background: "rgba(79, 204, 196, 0.1)",
                border: "1px solid #4ECDC4",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={{ color: "#4ECDC4", fontSize: "11px", fontWeight: "600", marginBottom: "10px" }}>
                🎲 COMMUNITY ACTIVITY
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <div style={{ color: "#aaa", fontSize: "10px", marginBottom: "2px" }}>
                    Total Bets
                  </div>
                  <div style={{ color: "#4ECDC4", fontSize: "16px", fontWeight: "700" }}>
                    {communityMetrics.totalBets}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#aaa", fontSize: "10px", marginBottom: "2px" }}>
                    Unique Bettors
                  </div>
                  <div style={{ color: "#4ECDC4", fontSize: "16px", fontWeight: "700" }}>
                    {communityMetrics.uniqueBettors}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#aaa", fontSize: "10px", marginBottom: "2px" }}>
                    Avg Prediction
                  </div>
                  <div style={{ color: "#FF6B6B", fontSize: "16px", fontWeight: "700" }}>
                    {communityMetrics.averagePrediction}s
                  </div>
                </div>

                <div>
                  <div style={{ color: "#aaa", fontSize: "10px", marginBottom: "2px" }}>
                    Success Rate
                  </div>
                  <div style={{ color: "#4ECDC4", fontSize: "16px", fontWeight: "700" }}>
                    {communityMetrics.successRate}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div style={{ color: "#aaa", textAlign: "center", padding: "20px" }}>
              Loading predictions...
            </div>
          )}

          {error && (
            <div
              style={{
                background: "#ff6b6b",
                color: "#fff",
                padding: "10px",
                borderRadius: "6px",
                marginBottom: "12px",
                fontSize: "12px",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: "#4ECDC4",
                color: "#000",
                padding: "10px",
                borderRadius: "6px",
                marginBottom: "12px",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              {success}
            </div>
          )}

          {/* Current Vehicles */}
          {predictions.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ color: "#4ECDC4", fontSize: "12px", fontWeight: "600", marginBottom: "10px" }}>
                🚊 ARRIVING VEHICLES
              </div>

              {predictions.map((pred) => (
                <button
                  key={pred.vehicle_id}
                  onClick={() => handleVehicleSelect(pred.vehicle_id)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    marginBottom: "8px",
                    background:
                      selectedVehicle === pred.vehicle_id
                        ? "rgba(79, 204, 196, 0.15)"
                        : "#232323",
                    border:
                      selectedVehicle === pred.vehicle_id
                        ? "1.5px solid #4ECDC4"
                        : "1.5px solid #333",
                    borderRadius: "6px",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "13px",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => {
                    if (selectedVehicle !== pred.vehicle_id) {
                      e.currentTarget.style.borderColor = "#4ECDC4";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedVehicle !== pred.vehicle_id) {
                      e.currentTarget.style.borderColor = "#333";
                    }
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: "600" }}>Vehicle {pred.vehicle_id}</span>
                    <span style={{ color: "#FF6B6B", fontWeight: "600" }}>
                      {pred.current_eta_display}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Vehicle Stats */}
          {selectedVehicle && vehicleStats && (
            <div
              style={{
                background: "rgba(255, 107, 107, 0.1)",
                border: "1px solid #FF6B6B",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={{ color: "#FF6B6B", fontSize: "11px", fontWeight: "600", marginBottom: "10px" }}>
                📊 VEHICLE {vehicleStats.vehicle_id} STATS
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <div style={{ color: "#aaa", fontSize: "10px", marginBottom: "2px" }}>
                    Times Bet On
                  </div>
                  <div style={{ color: "#FF6B6B", fontSize: "14px", fontWeight: "700" }}>
                    {vehicleStats.betCount}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#aaa", fontSize: "10px", marginBottom: "2px" }}>
                    Avg Prediction
                  </div>
                  <div style={{ color: "#FF6B6B", fontSize: "14px", fontWeight: "700" }}>
                    {vehicleStats.averagePrediction}s
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ color: "#aaa", fontSize: "10px", marginBottom: "2px" }}>
                    Accuracy
                  </div>
                  <div
                    style={{
                      background: "#1a1a1a",
                      borderRadius: "4px",
                      height: "6px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "#4ECDC4",
                        height: "100%",
                        width: `${vehicleStats.successRate}%`,
                      }}
                    />
                  </div>
                  <div style={{ color: "#aaa", fontSize: "10px", marginTop: "4px" }}>
                    {vehicleStats.successRate}% of bets were successful
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Frozen Prediction Display */}
          {selectedVehicle && frozenPredictions.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ color: "#FF6B6B", fontSize: "12px", fontWeight: "600", marginBottom: "10px" }}>
                ⏱️ PREDICTION FROM 5 MIN AGO
              </div>

              {frozenPredictions
                .filter((fp) => fp.vehicle_id === selectedVehicle)
                .slice(0, 1)
                .map((fp, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#232323",
                      border: "1.5px solid #FF6B6B",
                      borderRadius: "6px",
                      padding: "12px",
                      marginBottom: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <div>
                        <div style={{ color: "#aaa", fontSize: "11px" }}>PREDICTED</div>
                        <div
                          style={{
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: "600",
                          }}
                        >
                          {fp.frozen_prediction_display}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#aaa", fontSize: "11px" }}>ACTUAL</div>
                        <div
                          style={{
                            color: fp.status === "EARLY" ? "#4ECDC4" : "#FF6B6B",
                            fontSize: "14px",
                            fontWeight: "600",
                          }}
                        >
                          {fp.actual_elapsed_display}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#1a1a1a",
                        borderRadius: "4px",
                        padding: "8px",
                        color: fp.status === "EARLY" ? "#4ECDC4" : "#FF6B6B",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      {fp.status === "EARLY"
                        ? `✓ Arrived ${Math.abs(parseInt(fp.error_display))}s early`
                        : `✗ Arrived ${Math.abs(parseInt(fp.error_display))}s late`}
                    </div>
                  </div>
                ))}

              {/* Your Prediction Input */}
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    color: "#aaa",
                    fontSize: "11px",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  YOUR PREDICTION (seconds)
                </label>
                <input
                  type="number"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  placeholder="e.g., 30"
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#1a1a1a",
                    border: "1.5px solid #333",
                    borderRadius: "6px",
                    color: "#fff",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          )}

          {/* Bet Amount Input */}
          {selectedVehicle && selectedTime && (
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  color: "#aaa",
                  fontSize: "11px",
                  fontWeight: "600",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                BET AMOUNT (SOL)
              </label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.1"
                step="0.01"
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#1a1a1a",
                  border: "1.5px solid #333",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  marginBottom: "12px",
                }}
              />

              <button
                onClick={handleBet}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#4ECDC4",
                  color: "#000",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "PLACING BET..." : "PLACE BET"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "24px",
          padding: "12px",
          background: "rgba(79, 204, 196, 0.1)",
          borderRadius: "6px",
          border: "1px solid #4ECDC4",
          color: "#aaa",
          fontSize: "11px",
          lineHeight: "1.6",
        }}
      >
        <strong style={{ color: "#4ECDC4" }}>How to Play:</strong>
        <ol style={{ margin: "8px 0 0 16px", paddingLeft: "0" }}>
          <li>Select a TTC route</li>
          <li>Pick a stop (from map or search)</li>
          <li>See community predictions & stats</li>
          <li>View what was predicted 5 min ago</li>
          <li>Make your prediction</li>
          <li>Place bet & win SOL! 🚀</li>
        </ol>
      </div>
    </div>
  );
};

export default StopSidebarEnhanced;
