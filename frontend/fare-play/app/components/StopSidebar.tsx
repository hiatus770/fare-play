"use client";
import React, { useState, useEffect } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import { MarketList } from "./market-list";
import { BetPanel } from "./bet-panel";
import { CreateMarketPanel } from "./create-market-panel";
import type { MarketData } from "../../hooks/useMarkets";
import {
  getDepositInstructionDataEncoder,
  VAULT_PROGRAM_ADDRESS
} from "../generated/vault";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  type Address,
} from "@solana/kit";

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

type SidebarTab = "predictions" | "markets" | "mybets" | "winnings";

interface StopSidebarProps {
  selectedStop?: Stop | null;
  selectedRoute?: string | null;
  onStopSelect?: (stop: Stop | null, route: string | null) => void;
  mapCenter?: { lat: number; lon: number };
  // Market props from Map
  markets?: MarketData[];
  marketsLoading?: boolean;
  refetchMarkets?: () => void;
  walletAddress?: string;
  offChainBalance?: number;
  refetchBalance?: () => void;
}

const API_BASE = "http://localhost:5000";

// Popular streetcar routes to show
const STREETCAR_ROUTES = ["501", "504", "505", "506", "509", "510", "511", "512"];

// Routes to check for nearby stops
const NEARBY_ROUTES = ["501", "504", "505", "506", "509", "510", "511", "512"];

const LAMPORTS_PER_SOL = 1_000_000_000;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

const StopSidebar: React.FC<StopSidebarProps> = ({
  selectedStop: externalStop,
  selectedRoute: externalRoute,
  onStopSelect,
  mapCenter,
  markets = [],
  marketsLoading = false,
  refetchMarkets,
  walletAddress: externalWalletAddress,
  offChainBalance = 0,
  refetchBalance,
}) => {
  // Wallet hooks
  const { wallet, connected } = useWalletConnection();
  const { send, isSending } = useSendTransaction();
  const walletAddress = wallet?.account.address || externalWalletAddress;

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
  // Market tab state
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("predictions");
  const [selectedBet, setSelectedBet] = useState<{ market: MarketData; outcome: string } | null>(null);
  const [myBets, setMyBets] = useState<any[]>([]);
  const [resolvedMarkets, setResolvedMarkets] = useState<any[]>([]);
  const [nearbyStops, setNearbyStops] = useState<(Stop & { distance: number; routeTag: string })[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentMarket, setCurrentMarket] = useState<any>(null);
  const [marketLoading, setMarketLoading] = useState(false);

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

    if (!connected || !walletAddress) {
      setError("Please connect your wallet first");
      return;
    }

    const predictedArrivalSeconds = parseInt(selectedTime);
    const amountLamports = Math.floor(parseFloat(betAmount) * LAMPORTS_PER_SOL);

    if (amountLamports <= 0) {
      setError("Bet amount must be greater than 0");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("📊 Creating/finding market...");

      // 1. Get TTC prediction for this vehicle
      const ttcPrediction = predictions.find(p => p.vehicle_id === selectedVehicle);
      if (!ttcPrediction) {
        setError("Could not find prediction for selected vehicle");
        return;
      }

      // 2. Create or get existing market
      const marketRes = await fetch('/api/betting/markets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: selectedRoute?.tag,
          stopTag: selectedStop.tag,
          vehicleId: selectedVehicle,
          predictedArrivalSeconds: ttcPrediction.current_eta_seconds,
        })
      });

      if (!marketRes.ok) {
        const errorData = await marketRes.json();
        throw new Error(errorData.error || 'Failed to create market');
      }

      const { marketId, marketVaultAddress, freezeTime } = await marketRes.json();
      console.log("✓ Market ready:", marketId);

      // Check if market is frozen
      const freezeDate = new Date(freezeTime);
      if (new Date() >= freezeDate) {
        setError("This market has frozen, betting is closed");
        return;
      }

      // 3. Build bet transaction
      console.log("📝 Building bet transaction...");
      const betRes = await fetch('/api/betting/bets/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          marketId,
          predictedArrivalSeconds,
          amountLamports,
        })
      });

      if (!betRes.ok) {
        const errorData = await betRes.json();
        throw new Error(errorData.error || 'Failed to create bet transaction');
      }

      const { instruction, userId } = await betRes.json();
      console.log("✓ Transaction built");

      // 4. Derive user vault PDA
      console.log("🔐 Deriving vault address...");
      const [userVaultPda] = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new Uint8Array([118, 97, 117, 108, 116])), // "vault"
          getAddressEncoder().encode(walletAddress as Address),
        ],
      });
      console.log("✓ User vault PDA:", userVaultPda);

      // 5. Create deposit instruction
      console.log("💰 Creating deposit instruction...");
      const depositInstruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress as Address, role: 3 }, // WritableSigner
          { address: userVaultPda, role: 1 }, // Writable
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 }, // Readonly
        ],
        data: getDepositInstructionDataEncoder().encode({
          amount: BigInt(amountLamports),
        }),
      };

      // 6. Sign and send BOTH instructions in one transaction
      console.log("✍️ Requesting signature for deposit + bet...");
      console.log("Instructions:", [
        { type: "deposit", accounts: depositInstruction.accounts.length },
        { type: "place_bet", accounts: instruction.accounts.length }
      ]);

      let signature: string;
      try {
        signature = await send({
          instructions: [
            depositInstruction, // First: deposit funds into vault
            {                    // Second: place the bet
              programAddress: instruction.programAddress,
              accounts: instruction.accounts,
              data: new Uint8Array(instruction.data),
            }
          ],
        });
        console.log("✓ Transaction signed:", signature);
      } catch (txError: any) {
        console.error("❌ Transaction failed:", {
          message: txError.message,
          transactionPlanResult: txError.transactionPlanResult,
          cause: txError.cause,
          fullError: txError,
        });
        throw txError;
      }

      // 7. Confirm bet in database
      console.log("💾 Confirming bet...");
      const confirmRes = await fetch('/api/betting/bets/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId,
          userId,
          walletAddress,
          predictedArrivalSeconds,
          amountLamports,
          signature,
        })
      });

      if (!confirmRes.ok) {
        const errorData = await confirmRes.json();
        throw new Error(errorData.error || 'Failed to confirm bet');
      }

      const { betId } = await confirmRes.json();
      console.log("✅ Bet confirmed:", betId);

      setSuccess(`✅ Bet placed! ${betAmount} SOL on ${predictedArrivalSeconds}s arrival (deposited + bet in 1 tx)`);
      setBetAmount("");
      setSelectedTime("");

      // Refresh balance if available
      if (refetchBalance) {
        refetchBalance();
      }

      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      console.error("❌ Bet failed:", err);
      setError(`Failed to place bet: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // LMSR market betting handlers
  const handleMarketBet = (market: MarketData, outcome: string) => {
    setSelectedBet({ market, outcome });
  };

  const handleBetSuccess = () => {
    setSelectedBet(null);
    refetchMarkets?.();
    refetchBalance?.();
  };

  // Fetch market info for selected vehicle
  useEffect(() => {
    if (!selectedVehicle || !selectedRoute || !selectedStop) {
      setCurrentMarket(null);
      return;
    }

    const fetchMarketInfo = async () => {
      setMarketLoading(true);
      try {
        // Try to get existing market for this vehicle
        const ttcPrediction = predictions.find(p => p.vehicle_id === selectedVehicle);
        if (!ttcPrediction) return;

        const res = await fetch('/api/betting/markets/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            route: selectedRoute.tag,
            stopTag: selectedStop.tag,
            vehicleId: selectedVehicle,
            predictedArrivalSeconds: ttcPrediction.current_eta_seconds,
          })
        });

        if (res.ok) {
          const marketData = await res.json();

          // Fetch market details to get bet count and pool
          const detailsRes = await fetch(`/api/betting/markets/${marketData.marketId}`);
          if (detailsRes.ok) {
            const details = await detailsRes.json();
            setCurrentMarket({
              ...marketData,
              ...details.market,
              stats: details.stats,
            });
          } else {
            setCurrentMarket(marketData);
          }
        }
      } catch (err) {
        console.error('Error fetching market info:', err);
      } finally {
        setMarketLoading(false);
      }
    };

    fetchMarketInfo();
    // Refresh every 10 seconds
    const interval = setInterval(fetchMarketInfo, 10000);
    return () => clearInterval(interval);
  }, [selectedVehicle, selectedRoute, selectedStop, predictions]);

  // Fetch all bets when tab switches
  useEffect(() => {
    if (sidebarTab !== "mybets") return;
    const fetchAllBets = async () => {
      try {
        console.log('🔍 Fetching ALL bets from all users');
        // Fetch all bets from new betting API
        const resp = await fetch(`/api/betting/bets/all`);
        if (!resp.ok) {
          console.error('Failed to fetch bets:', resp.statusText);
          setMyBets([]);
          return;
        }
        const data = await resp.json();
        console.log('✅ Fetched all bets:', data);
        console.log('📊 Total bets:', data.bets?.length || 0);
        setMyBets(data.bets || []);
      } catch (error) {
        console.error('Error fetching bets:', error);
        setMyBets([]);
      }
    };
    fetchAllBets();
  }, [sidebarTab]);

  // Fetch resolved markets when winnings tab is selected
  useEffect(() => {
    if (sidebarTab !== "winnings") return;
    const fetchResolvedMarkets = async () => {
      try {
        console.log('🏆 Fetching resolved markets with winnings');
        const resp = await fetch(`/api/betting/markets/resolved`);
        if (!resp.ok) {
          console.error('Failed to fetch resolved markets:', resp.statusText);
          setResolvedMarkets([]);
          return;
        }
        const data = await resp.json();
        console.log('✅ Fetched resolved markets:', data);
        setResolvedMarkets(data.markets || []);
      } catch (error) {
        console.error('Error fetching resolved markets:', error);
        setResolvedMarkets([]);
      }
    };
    fetchResolvedMarkets();
  }, [sidebarTab]);

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
            color: "#0088CE",
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
          {selectedStop ? "Back to stops" : "Back to routes"}
        </button>
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
                  Route {stop.routeTag} • {(stop.distance * 1000).toFixed(0)}m away
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
          <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "16px", color: "#1a1a1a" }}>Streetcar Routes</div>
          {routes.length === 0 ? (
            <div style={{ color: "#6c757d", fontSize: "14px", padding: "12px 0" }}>
              Loading routes...
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {routes.map((route, idx) => (
                <li
                  key={route.tag}
                  onClick={() => handleRouteSelect(route)}
                  style={{
                    padding: "14px",
                    marginBottom: idx < routes.length - 1 ? "8px" : "0",
                    background: "#ffffff",
                    border: "1.5px solid #e9ecef",
                    borderRadius: "10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    transition: "all 0.15s",
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
                    <div style={{ fontSize: "13px", color: "#6c757d" }}>Streetcar</div>
                  </div>
                </li>
              ))}
            </ul>
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

            <input
              type="text"
              placeholder="Search stops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "#ffffff",
                border: "1.5px solid #dee2e6",
                borderRadius: "8px",
                color: "#1a1a1a",
                fontSize: "14px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
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
                    <div style={{ fontSize: "15px", fontWeight: "500" }}>{stop.title}</div>
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

          {/* Market Info Display */}
          {selectedVehicle && currentMarket && (
            <div style={{
              background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
              border: "2px solid #dee2e6",
            }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px", color: "#495057" }}>
                📊 Market Info
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#6c757d", marginBottom: "4px", textTransform: "uppercase" }}>
                    Total Pool
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#1a1a1a" }}>
                    {currentMarket.stats?.totalPool
                      ? (Number(currentMarket.stats.totalPool) / LAMPORTS_PER_SOL).toFixed(4)
                      : "0.0000"} SOL
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", color: "#6c757d", marginBottom: "4px", textTransform: "uppercase" }}>
                    Bets Placed
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#1a1a1a" }}>
                    {currentMarket.stats?.totalBets || 0}
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "11px", color: "#6c757d", marginBottom: "4px", textTransform: "uppercase" }}>
                    {currentMarket.stats?.isFrozen ? "Market Frozen" : "Freezes In"}
                  </div>
                  <div style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: currentMarket.stats?.isFrozen
                      ? "#DA2128"
                      : currentMarket.stats?.secondsUntilFreeze < 60
                        ? "#F8B22D"
                        : "#0088CE"
                  }}>
                    {currentMarket.stats?.isFrozen
                      ? "Betting Closed"
                      : currentMarket.stats?.secondsUntilFreeze
                        ? `${Math.floor(currentMarket.stats.secondsUntilFreeze / 60)}m ${currentMarket.stats.secondsUntilFreeze % 60}s`
                        : "Loading..."}
                  </div>
                </div>
              </div>

              {currentMarket.stats?.predictionDistribution && (
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #dee2e6" }}>
                  <div style={{ fontSize: "11px", color: "#6c757d", marginBottom: "6px", textTransform: "uppercase" }}>
                    Prediction Range
                  </div>
                  <div style={{ fontSize: "13px", color: "#495057" }}>
                    {currentMarket.stats.minPrediction}s - {currentMarket.stats.maxPrediction}s
                    {currentMarket.stats.avgPrediction && (
                      <span style={{ color: "#6c757d" }}>
                        {" "}(avg: {Math.round(currentMarket.stats.avgPrediction)}s)
                      </span>
                    )}
                  </div>
                </div>
              )}
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
                disabled={loading || isSending || !connected || currentMarket?.stats?.isFrozen}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: loading || isSending || !connected || currentMarket?.stats?.isFrozen
                    ? "#6c757d"
                    : `linear-gradient(135deg, ${selectedRoute?.color || "#DA2128"} 0%, ${selectedRoute?.color || "#DA2128"} 100%)`,
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
                {!connected
                  ? "Connect Wallet First"
                  : currentMarket?.stats?.isFrozen
                    ? "Market Frozen"
                    : loading || isSending
                      ? "Placing Bet..."
                      : `Place Bet (${betAmount || "0"} SOL)`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Markets Section ─── */}
      <div style={{
        width: "100%",
        marginTop: "24px",
        background: "#f8f9fa",
        borderRadius: "12px",
        padding: "20px",
        border: "2px solid #e9ecef",
      }}>
        {/* Tab Bar */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "14px" }}>
          {([
            { key: "predictions" as SidebarTab, label: "Predictions" },
            { key: "markets" as SidebarTab, label: "Markets" },
            { key: "mybets" as SidebarTab, label: "All Bets" },
            { key: "winnings" as SidebarTab, label: "🏆 Winners" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setSidebarTab(t.key); setSelectedBet(null); }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: "8px",
                border: "1.5px solid " + (sidebarTab === t.key ? "#0088CE" : "#dee2e6"),
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                background: sidebarTab === t.key ? "#e8f4fd" : "#ffffff",
                color: sidebarTab === t.key ? "#0088CE" : "#6c757d",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Off-chain balance bar */}
        {walletAddress && (
          <div style={{
            fontSize: "13px",
            color: "#6c757d",
            marginBottom: "12px",
            padding: "8px 12px",
            background: "#ffffff",
            borderRadius: "8px",
            border: "1.5px solid #e9ecef",
          }}>
            Betting Balance:{" "}
            <span style={{ color: "#1a1a1a", fontWeight: 600 }}>
              {(offChainBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL
            </span>
          </div>
        )}

        {/* Bet Panel (shown inline) */}
        {selectedBet && walletAddress && (
          <div style={{
            background: "#ffffff",
            borderRadius: "10px",
            padding: "16px",
            marginBottom: "12px",
            border: "1.5px solid #e9ecef",
          }}>
            <BetPanel
              market={selectedBet.market}
              selectedOutcome={selectedBet.outcome}
              walletAddress={walletAddress}
              offChainBalance={offChainBalance}
              onClose={() => setSelectedBet(null)}
              onSuccess={handleBetSuccess}
            />
          </div>
        )}

        {/* Tab Content: Predictions (create market from live vehicles) */}
        {sidebarTab === "predictions" && (
          <CreateMarketPanel onCreated={() => refetchMarkets?.()} />
        )}

        {/* Tab Content: Markets */}
        {sidebarTab === "markets" && (
          <MarketList
            markets={markets}
            resolvedMarkets={resolvedMarkets}
            loading={marketsLoading}
            onBet={walletAddress ? handleMarketBet : undefined}
          />
        )}

        {/* Tab Content: All Bets */}
        {sidebarTab === "mybets" && (
          <div>
            {(() => {
              console.log('🎯 Rendering All Bets tab:', { walletAddress, totalBets: myBets.length, myBets });
              return null;
            })()}
            {myBets.length === 0 ? (
              <div style={{ color: "#6c757d", fontSize: "14px", textAlign: "center", padding: "20px" }}>
                No bets placed yet by anyone
              </div>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {myBets.map((bet) => {
                  const isMyBet = bet.wallet_address === walletAddress;
                  const betWallet = bet.wallet_address || '';
                  return (
                  <div
                    key={bet.id}
                    style={{
                      background: isMyBet ? "#f0f9ff" : "#ffffff",
                      borderRadius: "10px",
                      padding: "14px",
                      marginBottom: "8px",
                      border: isMyBet ? "2px solid #0088CE" : "1.5px solid #e9ecef",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "#1a1a1a" }}>
                        Bet ID: {bet.id.slice(0, 8)}...
                      </span>
                      <span style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontWeight: 600,
                        background: "#e3f2fd",
                        color: "#1976d2",
                      }}>
                        Market: {bet.market_id.slice(0, 8)}...
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#6c757d", marginBottom: "4px" }}>
                      Predicted: {bet.predicted_arrival_seconds}s &middot; Bet: {(bet.amount_lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL
                    </div>
                    <div style={{ fontSize: "13px", color: "#6c757d", marginBottom: "4px" }}>
                      Tx: {bet.placement_signature?.slice(0, 8)}...
                    </div>
                    {bet.error_seconds !== null && bet.error_seconds !== undefined && (
                      <div style={{ fontSize: "13px", color: "#6c757d", marginBottom: "4px" }}>
                        Error: {bet.error_seconds}s &middot; Score: {bet.accuracy_score?.toFixed(4) || 'N/A'}
                      </div>
                    )}
                    {bet.payout_lamports > 0 && (
                      <div style={{
                        fontSize: "13px",
                        marginTop: "6px",
                        color: "#2e7d32",
                        fontWeight: 600,
                      }}>
                        🎉 Won ${(bet.payout_lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL!
                      </div>
                    )}
                    <div style={{ fontSize: "11px", color: "#999", marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{new Date(bet.created_at).toLocaleString()}</span>
                      <span style={{
                        fontFamily: "monospace",
                        background: isMyBet ? "#0088CE" : "#f5f5f5",
                        color: isMyBet ? "#fff" : "#666",
                        padding: "2px 6px",
                        borderRadius: "4px"
                      }}>
                        {betWallet.slice(0, 4)}...{betWallet.slice(-4)}
                        {isMyBet && " (You)"}
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Winners/Resolved Markets */}
        {sidebarTab === "winnings" && (
          <div>
            {resolvedMarkets.length === 0 ? (
              <div style={{ color: "#6c757d", fontSize: "14px", textAlign: "center", padding: "20px" }}>
                No resolved markets yet
              </div>
            ) : (
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {resolvedMarkets.map((market) => (
                  <div
                    key={market.id}
                    style={{
                      background: "#ffffff",
                      borderRadius: "10px",
                      padding: "16px",
                      marginBottom: "12px",
                      border: "2px solid #e9ecef",
                    }}
                  >
                    {/* Market Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 700, fontSize: "15px", color: "#1a1a1a" }}>
                        Route {market.route} · Stop {market.stop_tag}
                      </span>
                      <span style={{
                        fontSize: "11px",
                        padding: "3px 10px",
                        borderRadius: "6px",
                        fontWeight: 600,
                        background: "#e8f5e9",
                        color: "#2e7d32",
                      }}>
                        ✅ RESOLVED
                      </span>
                    </div>

                    {/* Resolution Info */}
                    {market.resolution && (
                      <div style={{ fontSize: "13px", color: "#666", marginBottom: "10px", background: "#f8f9fa", padding: "8px", borderRadius: "6px" }}>
                        <div><strong>Actual Arrival:</strong> {market.resolution.actual_arrival_seconds}s</div>
                        <div><strong>Resolved:</strong> {new Date(market.resolution.resolved_at).toLocaleString()}</div>
                        <div><strong>Winners:</strong> {market.resolution.winner_count} / {market.stats?.totalBets || 0} bets</div>
                      </div>
                    )}

                    {/* Top Winners (Podium) */}
                    {market.topWinners && market.topWinners.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#1a1a1a" }}>
                          🏆 Top Winners:
                        </div>
                        {market.topWinners.map((winner: any, index: number) => {
                          const isMyWin = winner.wallet_address === walletAddress;
                          const profit = Number(winner.payout_lamports) - Number(winner.amount_lamports);
                          const profitPercent = ((profit / Number(winner.amount_lamports)) * 100).toFixed(1);

                          return (
                            <div
                              key={winner.id}
                              style={{
                                background: isMyWin ? "#f0f9ff" : "#fafafa",
                                border: isMyWin ? "2px solid #0088CE" : "1px solid #e9ecef",
                                borderRadius: "8px",
                                padding: "10px",
                                marginBottom: "6px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "16px" }}>
                                    {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                                  </span>
                                  <span style={{
                                    fontFamily: "monospace",
                                    fontSize: "12px",
                                    background: isMyWin ? "#0088CE" : "#e0e0e0",
                                    color: isMyWin ? "#fff" : "#666",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                  }}>
                                    {winner.wallet_address.slice(0, 6)}...{winner.wallet_address.slice(-4)}
                                    {isMyWin && " (You!)"}
                                  </span>
                                </div>
                                <div style={{ fontSize: "12px", color: "#666" }}>
                                  Predicted: {winner.predicted_arrival_seconds}s · Error: {winner.error_seconds}s
                                </div>
                                <div style={{ fontSize: "12px", color: "#666" }}>
                                  Accuracy: {winner.accuracy_score?.toFixed(4)}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "15px", fontWeight: 700, color: "#2e7d32" }}>
                                  {(winner.payout_lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                </div>
                                <div style={{
                                  fontSize: "11px",
                                  color: profit > 0 ? "#2e7d32" : "#c62828",
                                  fontWeight: 600,
                                }}>
                                  {profit > 0 ? "+" : ""}{profitPercent}% profit
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Market Stats */}
                    <div style={{
                      marginTop: "12px",
                      paddingTop: "10px",
                      borderTop: "1px solid #e9ecef",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      fontSize: "11px",
                      color: "#666",
                    }}>
                      <div>Total Pool: {(market.stats?.totalWagered / LAMPORTS_PER_SOL).toFixed(4)} SOL</div>
                      <div>Distributed: {(market.stats?.totalPaidOut / LAMPORTS_PER_SOL).toFixed(4)} SOL</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default StopSidebar;
