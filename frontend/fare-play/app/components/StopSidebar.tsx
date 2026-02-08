"use client";
import React, { useState, useEffect } from "react";

interface RouteOption {
  tag: string;
  name: string;
  color: string;
  type?: string;
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

// Subway route tags
const SUBWAY_ROUTES = ["1", "2", "3", "4", "5", "6"];

// Routes to check for nearby stops
const NEARBY_ROUTES = ["501", "504", "505", "506", "509", "510", "511", "512"];

const StopSidebar: React.FC<StopSidebarProps> = ({
  selectedStop: externalStop,
  selectedRoute: externalRoute,
  onStopSelect,
  mapCenter
}) => {
  const [nearbySearch, setNearbySearch] = useState("");
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [routeSearch, setRouteSearch] = useState("");
  const [routeTypeFilter, setRouteTypeFilter] = useState<string>("all");

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
      .slice(0, 4);

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

      // Map all routes, add type and color
      const allRoutes = data.routes.map((r: any) => ({
        tag: r.tag,
        name: r.name,
        type: r.type || inferRouteType(r), // fallback if type missing
        color: getRouteColor(r.tag, r.type || inferRouteType(r)),
      }));
      setRoutes(allRoutes);
    } catch (err) {
      console.error("Failed to load routes:", err);
      setRoutes([]);
    }
  };

  // Helper to infer route type from tag/name if not provided
  function inferRouteType(route: any) {
    const name = (route.name || "").toLowerCase();
    const tag = String(route.tag || "");

    if (SUBWAY_ROUTES.includes(tag) || name.includes("subway") || name.includes("line")) return "subway";
    if (STREETCAR_ROUTES.includes(tag) || name.includes("streetcar")) return "streetcar";
    return "bus";
  }

  // Update getRouteColor to support all types
  function getRouteColor(tag: string, type?: string): string {
    // TTC legend color scheme
    if (type === "subway") return "#DA2128";      // Red
    if (type === "streetcar") return "#F8B22D";   // Yellow/Orange
    if (type === "bus") return "#0088CE";         // Blue
    // fallback by tag
    const colors: Record<string, string> = {
      "501": "#F8B22D",
      "504": "#F8B22D",
      "505": "#F8B22D",
      "506": "#F8B22D",
      "509": "#F8B22D",
      "510": "#F8B22D",
      "511": "#F8B22D",
      "512": "#F8B22D",
    };
    return colors[tag] || "#0088CE";
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
    setError("");
    try {
      const response = await fetch(`${API_BASE}/stop/${route}/${stop}`);

      if (response.status === 404) {
        // No predictions available for this stop
        const data = await response.json();
        setPredictions([]);
        setFrozenPredictions([]);
        setStopName(data.stop_name || selectedStop?.title || "");
        setRouteName(data.route_name || selectedRoute?.name || "");
        setError("");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch predictions");
      }

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
      setError("Failed to connect to backend. Make sure it's running on port 5000.");
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
    // Always go back to the main sidebar (route list)
    setSelectedStop(null);
    setSelectedRoute(null);
    setStops([]);
    setPredictions([]);
    setFrozenPredictions([]);
    setSelectedVehicle(null);
    onStopSelect?.(null, null);
  };

  const filteredStops = stops.filter(stop =>
    stop.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stop.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const routeTypeOptions = [
    { label: "All", value: "all" },
    { label: "Subway", value: "subway" },
    { label: "Streetcar", value: "streetcar" },
    { label: "Bus", value: "bus" },
  ];

  const filteredRoutes = routes.filter(route => {
    const matchesType = routeTypeFilter === "all" || route.type === routeTypeFilter;
    const searchLower = routeSearch.trim().toLowerCase();
    const matchesSearch =
      route.name.toLowerCase().includes(searchLower) ||
      route.tag.toLowerCase().includes(searchLower);
    return matchesType && matchesSearch;
  });

  return (
    <div
      style={{
        position: "fixed",
        top: "70px",
        left: 0,
        width: "500px",
        height: "calc(100vh - 70px)",
        background: "#ffffff",
        overflowY: "auto",
        zIndex: 10,
        padding: "32px",
        boxSizing: "border-box",
        boxShadow: "4px 0 16px rgba(0,0,0,0.08)",
        borderRight: "2px solid #e0e0e0",
      }}
    >
      {/* Back Button */}
      {(selectedRoute || selectedStop) && (
        <button
          onClick={handleBack}
          style={{
            padding: "8px 0",
            background: "none",
            border: "none",
            color: "#000",
            cursor: "pointer",
            fontSize: "14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: "500",
          }}
        >
          <span style={{ fontSize: "14px" }}>←</span>
          {"Back"}
        </button>
      )}

      {/* Search Bar - only show on main view */}
      {!selectedRoute && (
        <div style={{ position: "relative", marginBottom: "24px" }}>
          <input
            type="text"
            placeholder="Search by stop name or number..."
            value={nearbySearch}
            onChange={(e) => setNearbySearch(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 48px 14px 16px",
              background: "#ffffff",
              border: "2px solid #e9ecef",
              borderRadius: "12px",
              color: "#1a1a1a",
              fontSize: "15px",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="7" stroke="#9ca3af" strokeWidth="2" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
          </svg>

          {/* Search Dropdown */}
          {nearbySearch.trim().length >= 2 && (() => {
            const searchLower = nearbySearch.toLowerCase();
            const allStops: (Stop & { routeTag: string; distance: number })[] = [];
            for (const [routeTag, stopsArr] of Object.entries(routeStopsCache)) {
              for (const stop of stopsArr) {
                if (
                  stop.title.toLowerCase().includes(searchLower) ||
                  stop.tag.toLowerCase().includes(searchLower)
                ) {
                  const distance = mapCenter ? getDistance(mapCenter.lat, mapCenter.lon, stop.lat, stop.lon) : 0;
                  allStops.push({
                    tag: stop.tag,
                    title: stop.title,
                    lat: stop.lat,
                    lon: stop.lon,
                    routes: [routeTag],
                    routeTag,
                    distance,
                  });
                }
              }
            }
            const seen = new Set<string>();
            const uniqueStops = allStops
              .sort((a, b) => a.distance - b.distance)
              .filter(stop => {
                if (seen.has(stop.tag)) return false;
                seen.add(stop.tag);
                return true;
              }).slice(0, 3);

            if (uniqueStops.length === 0) return null;

            return (
              <ul style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "4px",
                background: "#ffffff",
                border: "2px solid #e9ecef",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                listStyle: "none",
                padding: "8px",
                zIndex: 100,
              }}>
                {uniqueStops.map((stop, idx) => (
                  <li
                    key={`search-${stop.routeTag}-${stop.tag}`}
                    onClick={() => {
                      handleNearbyStopSelect(stop);
                      setNearbySearch("");
                    }}
                    style={{
                      padding: "12px",
                      marginBottom: idx < uniqueStops.length - 1 ? "4px" : "0",
                      background: "#f8f9fa",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#e9ecef";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#f8f9fa";
                    }}
                  >
                    <div style={{ fontSize: "14px", fontWeight: "500", color: "#1a1a1a" }}>
                      {stop.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6c757d", marginTop: "2px" }}>
                      Stop #{stop.tag} • Route {stop.routeTag} • {(stop.distance * 1000).toFixed(0)}m away
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      )}

      {/* Nearby Stops Section */}
      {!selectedRoute && nearbyStops.length > 0 && (
        <div style={{
          width: "100%",
          marginBottom: "24px",
          background: "#f8f9fa",
          borderRadius: "12px",
          padding: "20px",
          border: "2px solid #e9ecef",
        }}>
          <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "16px", color: "#1a1a1a" }}>Nearby Stops</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {nearbyStops.map((stop, idx) => (
              <li
                key={`${stop.routeTag}-${stop.tag}`}
                onClick={() => handleNearbyStopSelect(stop)}
                style={{
                  padding: "14px",
                  marginBottom: idx < nearbyStops.length - 1 ? "8px" : "0",
                  background: "#ffffff",
                  border: "1.5px solid #e9ecef",
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = getRouteColor(stop.routeTag);
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e9ecef";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: "500", marginBottom: "4px", color: "#1a1a1a" }}>
                  {stop.title}
                </div>
                <div style={{ fontSize: "13px", color: "#6c757d" }}>
                  Stop #{stop.tag} • Route {stop.routeTag} • {(stop.distance * 1000).toFixed(0)}m away
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadingNearby && !selectedRoute && nearbyStops.length === 0 && (
        <div style={{
          width: "100%",
          marginBottom: "24px",
          background: "#f8f9fa",
          borderRadius: "12px",
          padding: "20px",
          color: "#6c757d",
          textAlign: "center",
          border: "2px solid #e9ecef",
        }}>
          Loading nearby stops...
        </div>
      )}

      {/* Routes Section */}
      {!selectedRoute && (
        <div style={{
          width: "100%",
          marginBottom: "24px",
          background: "#f8f9fa",
          borderRadius: "12px",
          padding: "20px",
          border: "2px solid #e9ecef",
        }}>
          <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "16px", color: "#1a1a1a" }}>Routes</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                placeholder="Name or number..."
                value={routeSearch}
                onChange={e => setRouteSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0 44px 0 18px",
                  height: "48px",
                  lineHeight: "48px",
                  background: "#fff",
                  border: "2px solid #e3e6ea",
                  borderRadius: "12px",
                  color: "#232323",
                  fontSize: "0.9rem",
                  fontWeight: 400,
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
              <span style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#b0b4b9",
                fontSize: "1.1rem",
                pointerEvents: "none"
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              </span>
            </div>
            <select
              value={routeTypeFilter}
              onChange={e => setRouteTypeFilter(e.target.value)}
              style={{
                padding: "0 10px",
                height: "48px",
                lineHeight: "48px",
                border: "2px solid #e3e6ea",
                borderRadius: "10px",
                background: "#fff",
                color: "#232323",
                fontSize: "0.9rem",
                fontWeight: 500,
                outline: "none"
              }}
            >
              {routeTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {routes.length === 0 ? (
            <div style={{ color: "#6c757d", fontSize: "14px", padding: "12px 0" }}>
              Loading routes...
            </div>
          ) : (
            <div style={{ maxHeight: "320px", overflowY: "auto" }}>
              {filteredRoutes.length === 0 ? (
                <div style={{ color: "#6c757d", fontSize: "14px", padding: "12px 0" }}>
                  No routes found.
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filteredRoutes.map((route, idx) => (
                    <li
                      key={route.tag}
                      onClick={() => handleRouteSelect(route)}
                      style={{
                        padding: "14px",
                        marginBottom: idx < filteredRoutes.length - 1 ? "8px" : "0",
                        background: "#ffffff",
                        border: selectedRoute && selectedRoute.tag === route.tag ? `2px solid ${route.color}` : "1.5px solid #e9ecef",
                        borderRadius: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        transition: "all 0.15s",
                        boxShadow: selectedRoute && selectedRoute.tag === route.tag ? "0 2px 8px rgba(0,0,0,0.08)" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = route.color;
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e9ecef";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
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
                          flexShrink: 0,
                          color: "#fff",
                        }}
                      >
                        {route.tag}
                      </div>
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: "500", color: "#1a1a1a" }}>{route.name}</div>
                        <div style={{ fontSize: "13px", color: "#6c757d" }}>{route.type ? route.type.charAt(0).toUpperCase() + route.type.slice(1) : "Route"}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Stop */}
      {selectedRoute && !selectedStop && (
        <div>
          <div style={{
            background: "#f8f9fa",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "16px",
            border: "2px solid #e9ecef",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
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
                  color: "#fff",
                }}
              >
                {selectedRoute.tag}
              </div>
              <div>
                <div style={{ color: "#1a1a1a", fontWeight: "600", fontSize: "16px" }}>{selectedRoute.name}</div>
                <div style={{ color: "#6c757d", fontSize: "13px" }}>{stops.length} stops</div>
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Name or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 44px 12px 14px",
                  background: "#ffffff",
                  border: "1.5px solid #dee2e6",
                  borderRadius: "8px",
                  color: "#1a1a1a",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <circle cx="11" cy="11" r="7" stroke="#9ca3af" strokeWidth="2" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div style={{
            background: "#f8f9fa",
            borderRadius: "12px",
            padding: "20px",
            maxHeight: "calc(100vh - 380px)",
            overflowY: "auto",
            border: "2px solid #e9ecef",
          }}>
            {loadingStops ? (
              <div style={{ color: "#6c757d", fontSize: "14px", padding: "12px 0", textAlign: "center" }}>
                Loading stops...
              </div>
            ) : filteredStops.length === 0 ? (
              <div style={{ color: "#6c757d", fontSize: "14px", padding: "12px 0", textAlign: "center" }}>
                No stops found
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {filteredStops.map((stop, idx) => (
                  <li
                    key={stop.tag}
                    onClick={() => handleStopSelect(stop)}
                    style={{
                      padding: "14px",
                      marginBottom: idx < filteredStops.length - 1 ? "8px" : "0",
                      background: "#ffffff",
                      border: "1.5px solid #e9ecef",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      color: "#1a1a1a",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = selectedRoute.color;
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e9ecef";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{ fontSize: "15px", fontWeight: "500", marginBottom: "4px" }}>{stop.title}</div>
                    <div style={{ fontSize: "13px", color: "#6c757d" }}>
                      Stop #{stop.tag} • Route {selectedRoute.tag} • {mapCenter ? (getDistance(mapCenter.lat, mapCenter.lon, stop.lat, stop.lon) * 1000).toFixed(0) : "—"}m away
                    </div>
                  </li>
                ))}
              </ul>
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
              background: "#f8f9fa",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "16px",
              border: "2px solid #e9ecef",
            }}
          >
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
                  color: "#fff",
                }}
              >
                {selectedRoute.tag}
              </div>
              <div>
                <div style={{ color: "#1a1a1a", fontSize: "16px", fontWeight: "600" }}>
                  {stopName || selectedStop.title}
                </div>
                <div style={{ color: "#6c757d", fontSize: "13px" }}>
                  {routeName || selectedRoute.name}
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div style={{
              background: "#f8f9fa",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "16px",
              border: "2px solid #e9ecef",
            }}>
              <div style={{ color: "#6c757d", textAlign: "center", fontSize: "14px" }}>
                Loading predictions...
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                background: "#fff5f5",
                color: "#DA2128",
                padding: "16px",
                borderRadius: "12px",
                marginBottom: "16px",
                fontSize: "14px",
                border: "2px solid #ffdddd",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: "#f0f9ff",
                color: "#0088CE",
                padding: "16px",
                borderRadius: "12px",
                marginBottom: "16px",
                fontSize: "14px",
                fontWeight: "500",
                border: "2px solid #cfe8ff",
              }}
            >
              {success}
            </div>
          )}

          {/* Current Vehicles */}
          {!loading && predictions.length > 0 && (
            <div style={{
              background: "#f8f9fa",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "16px",
              border: "2px solid #e9ecef",
            }}>
              <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "16px", color: "#1a1a1a" }}>Arriving Vehicles</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {predictions.map((pred, idx) => (
                  <li
                    key={pred.vehicle_id}
                    onClick={() => handleVehicleSelect(pred.vehicle_id)}
                    style={{
                      padding: "14px",
                      marginBottom: idx < predictions.length - 1 ? "8px" : "0",
                      background: selectedVehicle === pred.vehicle_id ? "#ffffff" : "#ffffff",
                      border: selectedVehicle === pred.vehicle_id ? `2px solid ${selectedRoute?.color}` : "1.5px solid #e9ecef",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedVehicle !== pred.vehicle_id) {
                        e.currentTarget.style.borderColor = "#ced4da";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedVehicle !== pred.vehicle_id) {
                        e.currentTarget.style.borderColor = "#e9ecef";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: "500", color: "#1a1a1a" }}>Vehicle {pred.vehicle_id}</div>
                        <div style={{ fontSize: "13px", color: "#6c757d", marginTop: "2px" }}>
                          {pred.direction}
                        </div>
                      </div>
                      <div style={{
                        color: selectedRoute?.color || "#0088CE",
                        fontWeight: "700",
                        fontSize: "18px",
                        whiteSpace: "nowrap",
                        marginLeft: "16px",
                        minWidth: "72px",
                        textAlign: "right",
                      }}>
                        {pred.current_eta_display}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && predictions.length === 0 && !error && (
            <div style={{
              background: "#f8f9fa",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "16px",
              border: "2px solid #e9ecef",
            }}>
              <div style={{ color: "#6c757d", textAlign: "center", fontSize: "14px" }}>
                No vehicles currently approaching
              </div>
            </div>
          )}

          {/* Frozen Predictions History & Betting */}
          {selectedVehicle && (
            <div style={{
              background: "#f8f9fa",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "16px",
              border: "2px solid #e9ecef",
            }}>
              {frozenPredictions.filter((fp) => fp.vehicle_id === selectedVehicle).length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "16px", color: "#1a1a1a" }}>Prediction History</div>

                  {frozenPredictions
                    .filter((fp) => fp.vehicle_id === selectedVehicle)
                    .slice(0, 3)
                    .map((fp, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "16px",
                          marginBottom: idx < 2 && frozenPredictions.filter(f => f.vehicle_id === selectedVehicle).length > idx + 1 ? "12px" : "0",
                          background: "#ffffff",
                          borderRadius: "10px",
                          border: "1.5px solid #e9ecef",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                          <div>
                            <div style={{ color: "#6c757d", fontSize: "12px", marginBottom: "4px" }}>Predicted</div>
                            <div style={{ color: "#1a1a1a", fontSize: "16px", fontWeight: "600" }}>
                              {fp.frozen_prediction_display}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: "#6c757d", fontSize: "12px", marginBottom: "4px" }}>Actual</div>
                            <div
                              style={{
                                color: fp.status === "EARLY" ? "#0088CE" : "#DA2128",
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
                            color: fp.status === "EARLY" ? "#0088CE" : "#DA2128",
                            fontSize: "13px",
                            fontWeight: "500",
                          }}
                        >
                          {fp.status === "EARLY"
                            ? `${Math.abs(parseInt(fp.error_display))}s early`
                            : fp.status === "LATE"
                              ? `${Math.abs(parseInt(fp.error_display))}s late`
                              : "On time"}
                        </div>
                      </div>
                    ))}
                </>
              )}

              {/* Prediction Input - Always show when vehicle selected */}
              <div style={{ marginTop: frozenPredictions.filter((fp) => fp.vehicle_id === selectedVehicle).length > 0 ? "16px" : "0" }}>
                <label
                  style={{
                    color: "#6c757d",
                    fontSize: "13px",
                    fontWeight: "500",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Your Prediction (seconds)
                </label>
                <input
                  type="number"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  placeholder="e.g., 120"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "#ffffff",
                    border: "1.5px solid #dee2e6",
                    borderRadius: "10px",
                    color: "#1a1a1a",
                    fontSize: "15px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          )}

          {/* Bet Amount */}
          {selectedVehicle && selectedTime && (
            <div style={{
              background: "#f8f9fa",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "16px",
              border: "2px solid #e9ecef",
            }}>
              <label
                style={{
                  color: "#6c757d",
                  fontSize: "13px",
                  fontWeight: "500",
                  display: "block",
                  marginBottom: "8px",
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
                  padding: "12px 14px",
                  background: "#ffffff",
                  border: "1.5px solid #dee2e6",
                  borderRadius: "10px",
                  color: "#1a1a1a",
                  fontSize: "15px",
                  boxSizing: "border-box",
                  marginBottom: "12px",
                  outline: "none",
                }}
              />

              <button
                onClick={handleBet}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: `linear-gradient(135deg, ${selectedRoute?.color || "#DA2128"} 0%, ${selectedRoute?.color || "#DA2128"} 100%)`,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  boxShadow: "0 2px 8px rgba(218, 33, 40, 0.25)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(218, 33, 40, 0.35)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(218, 33, 40, 0.25)";
                }}
              >
                {loading ? "Placing bet..." : "Place Bet"}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default StopSidebar;
