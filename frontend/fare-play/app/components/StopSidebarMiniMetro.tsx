"use client";
import React, { useState, useEffect } from "react";

const COLORS = {
  white: "#ffffff",
  black: "#000000",
  lightGray: "#f5f5f5",
  mediumGray: "#e0e0e0",
  darkGray: "#333333",
  red: "#e4572e",
};

interface Stop {
  tag: string;
  title: string;
  lat: number;
  lon: number;
  routes: string[];
  distance?: number;
}

interface Prediction {
  vehicle_id: string;
  current_eta_display: string;
  current_eta_seconds: number;
}

const StopSidebarMiniMetro = () => {
  const [nearbyStops, setNearbyStops] = useState<Stop[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [betAmount, setBetAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Get nearby stops on mount
  useEffect(() => {
    getNearbyStops();
  }, []);

  const getNearbyStops = async () => {
    setLoadingLocation(true);
    try {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              const response = await fetch(
                `http://localhost:5000/stops/nearby?lat=${latitude}&lon=${longitude}&radius=2`
              );
              if (!response.ok) throw new Error("Failed to fetch nearby stops");
              const data = await response.json();
              setNearbyStops(data.stops || []);
              setError("");
            } catch (err) {
              console.error("Error fetching nearby stops:", err);
              setError("Could not load nearby stops");
            }
            setLoadingLocation(false);
          },
          (err) => {
            console.warn("Geolocation error:", err);
            setError("Enable location to see nearby stops");
            setLoadingLocation(false);
          }
        );
      } else {
        setError("Geolocation not supported");
        setLoadingLocation(false);
      }
    } catch (err) {
      console.error("Error:", err);
      setLoadingLocation(false);
    }
  };

  // Search for stops
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/stops/search?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error("Failed to search stops");
      const data = await response.json();
      setSearchResults(data.stops || []);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    }
  };

  // When a stop is selected
  const handleStopSelect = (stop: Stop) => {
    setSelectedStop(stop);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedVehicle(null);
    setPredictions([]);
    fetchPredictionsForStop(stop);
  };

  // Fetch predictions for the selected stop
  const fetchPredictionsForStop = async (stop: Stop) => {
    setLoading(true);
    try {
      const allPredictions: any[] = [];

      for (const route of stop.routes) {
        try {
          const response = await fetch(
            `http://localhost:5000/stop/${route}/${stop.tag}`
          );
          if (response.ok) {
            const data = await response.json();
            allPredictions.push(...(data.current_predictions || []));
          }
        } catch (e) {
          console.warn(`Failed to fetch predictions for route ${route}`);
        }
      }

      setPredictions(allPredictions);
      setError("");
    } catch (err) {
      setError("Failed to load predictions");
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBet = async () => {
    if (!selectedVehicle || !selectedTime || !betAmount || !selectedStop) {
      setError("Select vehicle, time, and bet amount");
      return;
    }

    setLoading(true);
    try {
      console.log("Placing bet:", {
        stop: selectedStop.tag,
        vehicle: selectedVehicle,
        predictedTime: selectedTime,
        betAmount: betAmount,
      });

      setSuccess("BET PLACED!");
      setBetAmount("");
      setSelectedTime("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to place bet");
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
        width: "380px",
        height: "calc(100vh - 60px)",
        background: COLORS.white,
        borderRight: "none",
        overflowY: "auto",
        zIndex: 10,
        padding: "20px",
        boxSizing: "border-box",
        fontFamily: "'Arial', sans-serif",
      }}
    >
      {!selectedStop ? (
        <>
          {/* NEARBY STOPS */}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                color: COLORS.red,
                fontSize: "12px",
                fontWeight: "900",
                textTransform: "uppercase",
                marginBottom: "12px",
                letterSpacing: "1px",
                borderBottom: `2px solid ${COLORS.red}`,
                paddingBottom: "8px",
              }}
            >
              📍 Nearby Stops
            </div>

            {loadingLocation ? (
              <div
                style={{
                  color: COLORS.darkGray,
                  fontSize: "12px",
                  padding: "12px",
                  textAlign: "center",
                }}
              >
                Getting your location...
              </div>
            ) : nearbyStops.length > 0 ? (
              <div style={{ marginBottom: "12px" }}>
                {nearbyStops.slice(0, 8).map((stop) => (
                  <button
                    key={stop.tag}
                    onClick={() => handleStopSelect(stop)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: COLORS.white,
                      border: `1px solid ${COLORS.mediumGray}`,
                      color: COLORS.darkGray,
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "700",
                      textAlign: "left",
                      marginBottom: "6px",
                      transition: "all 0.1s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = COLORS.red;
                      e.currentTarget.style.color = COLORS.red;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = COLORS.mediumGray;
                      e.currentTarget.style.color = COLORS.darkGray;
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: "900" }}>
                      {stop.title}
                    </div>
                    <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "4px" }}>
                      {stop.distance?.toFixed(2)}km • {stop.routes.length} route{stop.routes.length !== 1 ? "s" : ""}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div
                style={{
                  color: COLORS.darkGray,
                  fontSize: "12px",
                  padding: "12px",
                  background: COLORS.lightGray,
                  border: `1px solid ${COLORS.mediumGray}`,
                  textAlign: "center",
                }}
              >
                No nearby stops found
              </div>
            )}
          </div>

          {/* SEARCH STOPS */}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                color: COLORS.red,
                fontSize: "12px",
                fontWeight: "900",
                textTransform: "uppercase",
                marginBottom: "12px",
                letterSpacing: "1px",
                borderBottom: `2px solid ${COLORS.red}`,
                paddingBottom: "8px",
              }}
            >
              🔍 Search Stops
            </div>

            <input
              type="text"
              placeholder="Search stops..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                background: COLORS.white,
                border: `1px solid ${COLORS.mediumGray}`,
                color: COLORS.darkGray,
                fontSize: "12px",
                fontWeight: "700",
                boxSizing: "border-box",
                marginBottom: "12px",
              }}
            />

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                {searchResults.map((stop) => (
                  <button
                    key={stop.tag}
                    onClick={() => handleStopSelect(stop)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: COLORS.white,
                      border: `1px solid ${COLORS.mediumGray}`,
                      color: COLORS.darkGray,
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "700",
                      textAlign: "left",
                      marginBottom: "6px",
                      transition: "all 0.1s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = COLORS.red;
                      e.currentTarget.style.color = COLORS.red;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = COLORS.mediumGray;
                      e.currentTarget.style.color = COLORS.darkGray;
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: "900" }}>
                      {stop.title}
                    </div>
                    <div style={{ fontSize: "10px", opacity: 0.6, marginTop: "4px" }}>
                      {stop.routes.join(", ")} • {stop.routes.length} route{stop.routes.length !== 1 ? "s" : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <div
                style={{
                  color: COLORS.darkGray,
                  fontSize: "12px",
                  padding: "12px",
                  background: COLORS.lightGray,
                  border: `1px solid ${COLORS.mediumGray}`,
                  textAlign: "center",
                }}
              >
                No stops found
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* STOP DETAILS */}
          <button
            onClick={() => {
              setSelectedStop(null);
              setPredictions([]);
              setSelectedVehicle(null);
            }}
            style={{
              width: "100%",
              padding: "10px",
              background: COLORS.white,
              border: `1px solid ${COLORS.mediumGray}`,
              color: COLORS.darkGray,
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "700",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = COLORS.red;
              e.currentTarget.style.color = COLORS.red;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = COLORS.mediumGray;
              e.currentTarget.style.color = COLORS.darkGray;
            }}
          >
            ← Search Different Stop
          </button>

          <div
            style={{
              background: COLORS.lightGray,
              border: `1px solid ${COLORS.mediumGray}`,
              padding: "12px",
              marginBottom: "12px",
            }}
          >
            <div style={{ color: COLORS.red, fontSize: "10px", fontWeight: "700", textTransform: "uppercase" }}>
              Stop
            </div>
            <div style={{ color: COLORS.black, fontSize: "13px", fontWeight: "700", lineHeight: "1.3" }}>
              {selectedStop.title}
            </div>
            <div style={{ color: COLORS.darkGray, fontSize: "11px", marginTop: "6px" }}>
              {selectedStop.routes.length === 1 ? "1 route" : `${selectedStop.routes.length} routes`}
            </div>
          </div>

          {/* ROUTES SERVING THIS STOP */}
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                color: COLORS.red,
                fontSize: "12px",
                fontWeight: "900",
                textTransform: "uppercase",
                marginBottom: "8px",
                letterSpacing: "1px",
                borderBottom: `2px solid ${COLORS.red}`,
                paddingBottom: "6px",
              }}
            >
              Routes
            </div>

            {selectedStop.routes.map((route) => (
              <div
                key={route}
                style={{
                  padding: "8px 12px",
                  background: COLORS.lightGray,
                  border: `1px solid ${COLORS.mediumGray}`,
                  marginBottom: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: COLORS.darkGray,
                }}
              >
                Route {route}
              </div>
            ))}
          </div>

          {error && (
            <div
              style={{
                background: COLORS.white,
                color: COLORS.red,
                padding: "10px",
                marginBottom: "12px",
                fontSize: "11px",
                fontWeight: "700",
                border: `1px solid ${COLORS.red}`,
              }}
            >
              ✗ {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: COLORS.white,
                color: COLORS.red,
                padding: "10px",
                marginBottom: "12px",
                fontSize: "11px",
                fontWeight: "700",
                border: `1px solid ${COLORS.red}`,
              }}
            >
              ✓ {success}
            </div>
          )}

          {loading && (
            <div style={{ color: COLORS.darkGray, textAlign: "center", padding: "20px", fontSize: "12px" }}>
              Loading predictions...
            </div>
          )}

          {/* Arriving Vehicles */}
          {predictions.length > 0 && !selectedVehicle && (
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  color: COLORS.red,
                  fontSize: "12px",
                  fontWeight: "900",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                  letterSpacing: "1px",
                  borderBottom: `2px solid ${COLORS.red}`,
                  paddingBottom: "6px",
                }}
              >
                Next Arrivals
              </div>

              {predictions.slice(0, 5).map((pred) => (
                <button
                  key={pred.vehicle_id}
                  onClick={() => setSelectedVehicle(pred.vehicle_id)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    marginBottom: "6px",
                    background: COLORS.white,
                    border: `1px solid ${COLORS.mediumGray}`,
                    color: COLORS.darkGray,
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "700",
                    display: "flex",
                    justifyContent: "space-between",
                    transition: "all 0.1s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = COLORS.red;
                    e.currentTarget.style.color = COLORS.red;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = COLORS.mediumGray;
                    e.currentTarget.style.color = COLORS.darkGray;
                  }}
                >
                  <span>Vehicle {pred.vehicle_id}</span>
                  <span style={{ fontWeight: "900", color: COLORS.red }}>{pred.current_eta_display}</span>
                </button>
              ))}
            </div>
          )}

          {/* Prediction & Bet */}
          {selectedVehicle && (
            <div>
              <div
                style={{
                  color: COLORS.red,
                  fontSize: "12px",
                  fontWeight: "900",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                  letterSpacing: "1px",
                  borderBottom: `2px solid ${COLORS.red}`,
                  paddingBottom: "6px",
                }}
              >
                Make Your Prediction
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    color: COLORS.darkGray,
                    fontSize: "10px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Predicted Arrival (seconds)
                </label>
                <input
                  type="number"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  placeholder="30"
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: COLORS.white,
                    border: `1px solid ${COLORS.mediumGray}`,
                    color: COLORS.darkGray,
                    fontSize: "12px",
                    fontWeight: "700",
                    boxSizing: "border-box",
                    marginBottom: "12px",
                  }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    color: COLORS.darkGray,
                    fontSize: "10px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Bet Amount (SOL)
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
                    background: COLORS.white,
                    border: `1px solid ${COLORS.mediumGray}`,
                    color: COLORS.darkGray,
                    fontSize: "12px",
                    fontWeight: "700",
                    boxSizing: "border-box",
                    marginBottom: "12px",
                  }}
                />
              </div>

              <button
                onClick={handleBet}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: COLORS.red,
                  border: `2px solid ${COLORS.red}`,
                  color: COLORS.white,
                  fontSize: "13px",
                  fontWeight: "900",
                  textTransform: "uppercase",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "PLACING..." : "PLACE BET"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StopSidebarMiniMetro;
