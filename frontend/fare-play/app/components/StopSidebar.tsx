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
  lat: number;
  lon: number;
  routes: string[];
}

interface Prediction {
  vehicle_id: string;
  current_eta_display: string;
  current_eta_seconds: number;
  direction: string;
}

interface FrozenPrediction {
  vehicle_id: string;
  frozen_at: string;
  frozen_prediction_display: string;
  actual_elapsed_display: string;
  error_display: string;
  status: string;
}

interface StopSidebarProps {
  selectedStop?: Stop | null;
  selectedRoute?: string | null;
  onStopSelect?: (stop: Stop | null, route: string | null) => void;
  mapCenter?: { lat: number; lon: number };
}

const API_BASE = "http://localhost:5000";

// Popular streetcar routes to show
const STREETCAR_ROUTES = ["501", "504", "505", "506", "509", "510", "511", "512"];

// Routes to check for nearby stops
const NEARBY_ROUTES = ["501", "504", "505", "506", "509", "510", "511", "512"];

const StopSidebar: React.FC<StopSidebarProps> = ({
  selectedStop: externalStop,
  selectedRoute: externalRoute,
  onStopSelect,
  mapCenter
}) => {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [frozenPredictions, setFrozenPredictions] = useState<FrozenPrediction[]>([]);
  const [stopName, setStopName] = useState("");
  const [routeName, setRouteName] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [betAmount, setBetAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStops, setLoadingStops] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyStops, setNearbyStops] = useState<(Stop & { distance: number; routeTag: string })[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cache for route stops to avoid re-fetching
  const [routeStopsCache, setRouteStopsCache] = useState<Record<string, any[]>>({});

  // Load routes on mount
  useEffect(() => {
    loadRoutes();
    loadAllRouteStops();
  }, []);

  // Reload nearby stops when map center changes
  useEffect(() => {
    if (mapCenter && Object.keys(routeStopsCache).length > 0) {
      updateNearbyStops();
    }
  }, [mapCenter, routeStopsCache]);

  // Calculate distance between two coordinates (in km)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const dlat = Math.abs(lat1 - lat2);
    const dlon = Math.abs(lon1 - lon2);
    return Math.sqrt(dlat * dlat + dlon * dlon) * 111; // Approximate km
  };

  // Load all route stops once and cache them
  const loadAllRouteStops = async () => {
    setLoadingNearby(true);
    const cache: Record<string, any[]> = {};

    for (const routeTag of NEARBY_ROUTES) {
      try {
        const response = await fetch(`${API_BASE}/route/${routeTag}/stops`);
        if (!response.ok) continue;
        const data = await response.json();
        cache[routeTag] = data.stops || [];
      } catch (err) {
        console.error(`Failed to load stops for route ${routeTag}:`, err);
      }
    }

    setRouteStopsCache(cache);
    setLoadingNearby(false);
  };

  // Update nearby stops based on current map center
  const updateNearbyStops = () => {
    if (!mapCenter) return;

    const allStopsWithDistance: (Stop & { distance: number; routeTag: string })[] = [];

    // Calculate distance for ALL stops
    for (const [routeTag, stops] of Object.entries(routeStopsCache)) {
      for (const stop of stops) {
        const distance = getDistance(mapCenter.lat, mapCenter.lon, stop.lat, stop.lon);
        allStopsWithDistance.push({
          tag: stop.tag,
          title: stop.title,
          lat: stop.lat,
          lon: stop.lon,
          routes: [routeTag],
          distance,
          routeTag,
        });
      }
    }

    // Sort by distance and deduplicate, always get 8 closest
    const seen = new Set<string>();
    const uniqueStops = allStopsWithDistance
      .sort((a, b) => a.distance - b.distance)
      .filter(stop => {
        if (seen.has(stop.tag)) return false;
        seen.add(stop.tag);
        return true;
      })
      .slice(0, 8);

    setNearbyStops(uniqueStops);
  };

  // Handle external stop selection (from map click)
  useEffect(() => {
    if (externalStop && externalRoute) {
      const matchedRoute = routes.find(r => r.tag === externalRoute);
      if (matchedRoute) {
        setSelectedRoute(matchedRoute);
        setSelectedStop(externalStop);
      }
    }
  }, [externalStop, externalRoute, routes]);

  // Fetch predictions when stop is selected
  useEffect(() => {
    if (selectedStop && selectedRoute) {
      fetchPredictions(selectedRoute.tag, selectedStop.tag);
    }
  }, [selectedStop, selectedRoute]);

  const loadRoutes = async () => {
    try {
      const response = await fetch(`${API_BASE}/routes`);
      if (!response.ok) throw new Error("Failed to fetch routes");
      const data = await response.json();

      // Filter to streetcar routes and add colors
      const streetcarRoutes = data.routes
        .filter((r: any) => STREETCAR_ROUTES.includes(r.tag))
        .map((r: any) => ({
          tag: r.tag,
          name: r.name,
          color: getRouteColor(r.tag),
        }));

      setRoutes(streetcarRoutes);
    } catch (err) {
      console.error("Failed to load routes:", err);
      // Fallback routes
      setRoutes([
        { tag: "501", name: "501-Queen", color: "#FF6B6B" },
        { tag: "504", name: "504-King", color: "#4ECDC4" },
        { tag: "510", name: "510-Spadina", color: "#F8B22D" },
      ]);
    }
  };

  const getRouteColor = (tag: string): string => {
    const colors: Record<string, string> = {
      "501": "#FF6B6B",
      "503": "#9B59B6",
      "504": "#4ECDC4",
      "505": "#3498DB",
      "506": "#E74C3C",
      "509": "#2ECC71",
      "510": "#F8B22D",
      "511": "#1ABC9C",
      "512": "#E67E22",
    };
    return colors[tag] || "#4ECDC4";
  };

  const loadStops = async (routeTag: string) => {
    setLoadingStops(true);
    try {
      const response = await fetch(`${API_BASE}/route/${routeTag}/stops`);
      if (!response.ok) throw new Error("Failed to fetch stops");
      const data = await response.json();

      setStops(data.stops.map((s: any) => ({
        tag: s.tag,
        title: s.title,
        lat: s.lat,
        lon: s.lon,
        routes: [routeTag],
      })));
    } catch (err) {
      console.error("Failed to load stops:", err);
      setStops([]);
    } finally {
      setLoadingStops(false);
    }
  };

  const fetchPredictions = async (route: string, stop: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/stop/${route}/${stop}`);
      if (!response.ok) throw new Error("Failed to fetch predictions");

      const data = await response.json();
      // Sort predictions by ETA (soonest first)
      const sortedPredictions = (data.current_predictions || []).sort(
        (a: Prediction, b: Prediction) => a.current_eta_seconds - b.current_eta_seconds
      );
      setPredictions(sortedPredictions);
      setFrozenPredictions(data.frozen_predictions_history || []);
      setStopName(data.stop_name || "");
      setRouteName(data.route_name || "");
      setError("");
    } catch (err) {
      setError("Failed to load predictions. Make sure the backend is running.");
      setPredictions([]);
      setFrozenPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRouteSelect = (route: RouteOption) => {
    setSelectedRoute(route);
    setSelectedStop(null);
    setPredictions([]);
    setFrozenPredictions([]);
    setSelectedVehicle(null);
    loadStops(route.tag);
    onStopSelect?.(null, route.tag);
  };

  const handleStopSelect = (stop: Stop) => {
    setSelectedStop(stop);
    setSelectedVehicle(null);
    onStopSelect?.(stop, selectedRoute?.tag || null);
  };

  const handleNearbyStopSelect = (stop: Stop & { routeTag: string }) => {
    const route = routes.find(r => r.tag === stop.routeTag) || {
      tag: stop.routeTag,
      name: `Route ${stop.routeTag}`,
      color: getRouteColor(stop.routeTag),
    };
    setSelectedRoute(route);
    setSelectedStop(stop);
    setSelectedVehicle(null);
    onStopSelect?.(stop, stop.routeTag);
  };

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
    setSelectedTime("");
  };

  const handleBet = async () => {
    if (!selectedVehicle || !selectedTime || !betAmount || !selectedStop) {
      setError("Please select vehicle, time, and enter bet amount");
      return;
    }

    setLoading(true);
    try {
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

  const handleBack = () => {
    if (selectedStop) {
      setSelectedStop(null);
      setPredictions([]);
      setFrozenPredictions([]);
      setSelectedVehicle(null);
      onStopSelect?.(null, selectedRoute?.tag || null);
    } else if (selectedRoute) {
      setSelectedRoute(null);
      setStops([]);
      onStopSelect?.(null, null);
    }
  };

  const filteredStops = stops.filter(stop =>
    stop.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "400px",
        height: "100vh",
        background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)",
        overflowY: "auto",
        zIndex: 10,
        padding: "24px",
        boxSizing: "border-box",
        boxShadow: "4px 0 24px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            color: "#fff",
            fontSize: "28px",
            fontWeight: "700",
            margin: "0 0 8px 0",
            letterSpacing: "-0.5px",
          }}
        >
          FarePlay
        </h1>
        <p style={{ color: "#666", fontSize: "13px", margin: "0" }}>
          Predict TTC arrivals
        </p>
      </div>

      {/* Back Button */}
      {(selectedRoute || selectedStop) && (
        <button
          onClick={handleBack}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "8px",
            color: "#888",
            cursor: "pointer",
            fontSize: "13px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "16px" }}>←</span>
          {selectedStop ? "Back to stops" : "Back to routes"}
        </button>
      )}

      {/* Nearby Stops Section */}
      {!selectedRoute && nearbyStops.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ color: "#FF6B6B", fontSize: "11px", fontWeight: "600", marginBottom: "12px", letterSpacing: "1px" }}>
            NEARBY STOPS
          </div>
          <div style={{ fontSize: "11px", color: "#555", marginBottom: "12px" }}>
            Based on map view
          </div>
          {nearbyStops.map((stop) => (
            <button
              key={`${stop.routeTag}-${stop.tag}`}
              onClick={() => handleNearbyStopSelect(stop)}
              style={{
                width: "100%",
                padding: "12px 14px",
                marginBottom: "6px",
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "10px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "13px",
                textAlign: "left",
                transition: "border-color 0.15s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "#FF6B6B";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "#2a2a2a";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "500" }}>{stop.title}</div>
                  <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
                    Route {stop.routeTag} · {(stop.distance * 1000).toFixed(0)}m away
                  </div>
                </div>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    backgroundColor: getRouteColor(stop.routeTag),
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "10px",
                  }}
                >
                  {stop.routeTag}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {loadingNearby && !selectedRoute && (
        <div style={{ color: "#666", fontSize: "13px", padding: "12px", textAlign: "center", marginBottom: "20px" }}>
          Loading nearby stops...
        </div>
      )}

      {/* Step 1: Select Route */}
      {!selectedRoute && (
        <div>
          <div style={{ color: "#4ECDC4", fontSize: "11px", fontWeight: "600", marginBottom: "12px", letterSpacing: "1px" }}>
            OR SELECT ROUTE
          </div>
          {routes.length === 0 ? (
            <div style={{ color: "#666", fontSize: "13px", padding: "20px", textAlign: "center" }}>
              Loading routes...
            </div>
          ) : (
            routes.map((route) => (
              <button
                key={route.tag}
                onClick={() => handleRouteSelect(route)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  marginBottom: "8px",
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "10px",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.15s",
                  textAlign: "left",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = route.color;
                  e.currentTarget.style.background = "#222";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "#2a2a2a";
                  e.currentTarget.style.background = "#1a1a1a";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      backgroundColor: route.color,
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                      fontSize: "12px",
                    }}
                  >
                    {route.tag}
                  </div>
                  <div>
                    <div style={{ fontWeight: "600" }}>{route.name}</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>Streetcar</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Step 2: Select Stop */}
      {selectedRoute && !selectedStop && (
        <div>
          <div style={{
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "10px",
            padding: "14px",
            marginBottom: "16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  backgroundColor: selectedRoute.color,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "700",
                  fontSize: "12px",
                }}
              >
                {selectedRoute.tag}
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: "600" }}>{selectedRoute.name}</div>
                <div style={{ color: "#666", fontSize: "12px" }}>{stops.length} stops</div>
              </div>
            </div>
          </div>

          <div style={{ color: "#4ECDC4", fontSize: "11px", fontWeight: "600", marginBottom: "12px", letterSpacing: "1px" }}>
            SELECT STOP
          </div>

          <input
            type="text"
            placeholder="Search stops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              color: "#fff",
              marginBottom: "12px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />

          <div
            style={{
              maxHeight: "calc(100vh - 340px)",
              overflowY: "auto",
            }}
          >
            {loadingStops ? (
              <div style={{ color: "#666", fontSize: "13px", padding: "20px", textAlign: "center" }}>
                Loading stops...
              </div>
            ) : filteredStops.length === 0 ? (
              <div style={{ color: "#666", fontSize: "13px", padding: "20px", textAlign: "center" }}>
                No stops found
              </div>
            ) : (
              filteredStops.map((stop) => (
                <button
                  key={stop.tag}
                  onClick={() => handleStopSelect(stop)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    marginBottom: "6px",
                    background: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    borderRadius: "8px",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "13px",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "#4ECDC4";
                    e.currentTarget.style.background = "#222";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "#2a2a2a";
                    e.currentTarget.style.background = "#1a1a1a";
                  }}
                >
                  <div style={{ fontWeight: "500" }}>{stop.title}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Step 3: Predictions */}
      {selectedRoute && selectedStop && (
        <div>
          {/* Selected Stop Info */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(78, 205, 196, 0.15) 0%, rgba(78, 205, 196, 0.05) 100%)",
              border: "1px solid rgba(78, 205, 196, 0.3)",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  backgroundColor: selectedRoute.color,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "700",
                  fontSize: "12px",
                }}
              >
                {selectedRoute.tag}
              </div>
              <div>
                <div style={{ color: "#fff", fontSize: "15px", fontWeight: "600" }}>
                  {stopName || selectedStop.title}
                </div>
                <div style={{ color: "#4ECDC4", fontSize: "12px" }}>
                  {routeName || selectedRoute.name}
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div style={{ color: "#666", textAlign: "center", padding: "24px" }}>
              Loading predictions...
            </div>
          )}

          {error && (
            <div
              style={{
                background: "rgba(255, 107, 107, 0.1)",
                border: "1px solid rgba(255, 107, 107, 0.3)",
                color: "#FF6B6B",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: "rgba(78, 205, 196, 0.1)",
                border: "1px solid rgba(78, 205, 196, 0.3)",
                color: "#4ECDC4",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              {success}
            </div>
          )}

          {/* Current Vehicles */}
          {!loading && predictions.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ color: "#4ECDC4", fontSize: "11px", fontWeight: "600", marginBottom: "12px", letterSpacing: "1px" }}>
                ARRIVING VEHICLES
              </div>

              {predictions.map((pred) => (
                <button
                  key={pred.vehicle_id}
                  onClick={() => handleVehicleSelect(pred.vehicle_id)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    marginBottom: "8px",
                    background: selectedVehicle === pred.vehicle_id
                      ? "rgba(78, 205, 196, 0.15)"
                      : "#1a1a1a",
                    border: selectedVehicle === pred.vehicle_id
                      ? "1px solid rgba(78, 205, 196, 0.5)"
                      : "1px solid #2a2a2a",
                    borderRadius: "10px",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "14px",
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "600" }}>Vehicle {pred.vehicle_id}</div>
                      <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                        {pred.direction}
                      </div>
                    </div>
                    <div style={{
                      color: "#4ECDC4",
                      fontWeight: "700",
                      fontSize: "18px",
                    }}>
                      {pred.current_eta_display}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && predictions.length === 0 && !error && (
            <div style={{ color: "#666", textAlign: "center", padding: "24px", fontSize: "13px" }}>
              No vehicles currently approaching this stop
            </div>
          )}

          {/* Frozen Predictions History */}
          {selectedVehicle && frozenPredictions.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ color: "#FF6B6B", fontSize: "11px", fontWeight: "600", marginBottom: "12px", letterSpacing: "1px" }}>
                PREDICTION ACCURACY HISTORY
              </div>

              {frozenPredictions
                .filter((fp) => fp.vehicle_id === selectedVehicle)
                .slice(0, 3)
                .map((fp, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#1a1a1a",
                      border: "1px solid #2a2a2a",
                      borderRadius: "10px",
                      padding: "14px",
                      marginBottom: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                      <div>
                        <div style={{ color: "#666", fontSize: "10px", letterSpacing: "0.5px" }}>PREDICTED</div>
                        <div style={{ color: "#fff", fontSize: "16px", fontWeight: "600" }}>
                          {fp.frozen_prediction_display}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#666", fontSize: "10px", letterSpacing: "0.5px" }}>ACTUAL</div>
                        <div
                          style={{
                            color: fp.status === "EARLY" ? "#4ECDC4" : "#FF6B6B",
                            fontSize: "16px",
                            fontWeight: "600",
                          }}
                        >
                          {fp.actual_elapsed_display}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        background: fp.status === "EARLY"
                          ? "rgba(78, 205, 196, 0.1)"
                          : "rgba(255, 107, 107, 0.1)",
                        borderRadius: "6px",
                        padding: "8px 10px",
                        color: fp.status === "EARLY" ? "#4ECDC4" : "#FF6B6B",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      {fp.status === "EARLY"
                        ? `Arrived ${Math.abs(parseInt(fp.error_display))}s early`
                        : fp.status === "LATE"
                        ? `Arrived ${Math.abs(parseInt(fp.error_display))}s late`
                        : "On time"}
                    </div>
                  </div>
                ))}

              {/* Prediction Input */}
              <div style={{ marginTop: "16px" }}>
                <label
                  style={{
                    color: "#666",
                    fontSize: "11px",
                    fontWeight: "600",
                    display: "block",
                    marginBottom: "8px",
                    letterSpacing: "0.5px",
                  }}
                >
                  YOUR PREDICTION (seconds until arrival)
                </label>
                <input
                  type="number"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  placeholder="e.g., 120"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "#0d0d0d",
                    border: "1px solid #2a2a2a",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          )}

          {/* Bet Amount */}
          {selectedVehicle && selectedTime && (
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  color: "#666",
                  fontSize: "11px",
                  fontWeight: "600",
                  display: "block",
                  marginBottom: "8px",
                  letterSpacing: "0.5px",
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
                  padding: "12px 14px",
                  background: "#0d0d0d",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  marginBottom: "12px",
                }}
              />

              <button
                onClick={handleBet}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "linear-gradient(135deg, #4ECDC4 0%, #44B8B0 100%)",
                  color: "#000",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  letterSpacing: "0.5px",
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
          marginTop: "auto",
          paddingTop: "20px",
          borderTop: "1px solid #1a1a1a",
        }}
      >
        <div
          style={{
            background: "#0d0d0d",
            borderRadius: "10px",
            padding: "14px",
            color: "#555",
            fontSize: "11px",
            lineHeight: "1.6",
          }}
        >
          <strong style={{ color: "#666" }}>How it works:</strong>
          <div style={{ marginTop: "8px" }}>
            1. Select a streetcar route<br />
            2. Pick a stop to monitor<br />
            3. View live predictions and accuracy<br />
            4. Make your prediction and bet
          </div>
        </div>
      </div>
    </div>
  );
};

export default StopSidebar;
