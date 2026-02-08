"use client";
import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css';
import { SidebarWallet } from "./sidebar-wallet";
import { MarketList } from "./market-list";
import { BetPanel } from "./bet-panel";
import { CreateMarketPanel } from "./create-market-panel";
import { useMarkets, type MarketData } from "../../hooks/useMarkets";
import { useOffChainBalance } from "../../hooks/useOffChainBalance";
import { useVault } from "../../hooks/useVault";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "YOUR_MAPBOX_ACCESS_TOKEN";

type SidebarTab = "markets" | "create" | "bets";

const Map = () => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [userLocation, setUserLocation] = useState(null);

    // Market state
    const [activeTab, setActiveTab] = useState<SidebarTab>("markets");
    const [selectedBet, setSelectedBet] = useState<{ market: MarketData; outcome: string } | null>(null);
    const { markets, resolvedMarkets, loading: marketsLoading, refetch: refetchMarkets } = useMarkets();
    const { walletAddress } = useVault();
    const { balance: offChainBalance, refetch: refetchBalance } = useOffChainBalance(walletAddress);

    // My bets: trades for this wallet
    const [myBets, setMyBets] = useState<any[]>([]);

    useEffect(() => {
        if (map.current) return;
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/dark-v10",
            center: [-79.3832, 43.6455],
            zoom: 14,
        });
        const unionStationBounds = [
            [-79.992158, 43.4678844],
            [-79.0033885, 43.8830605],
        ];
        map.current.setMaxBounds(unionStationBounds);
    }, []);

    // Auto-resolution polling (every 30s)
    useEffect(() => {
        const resolve = async () => {
            try {
                await fetch("/api/cron/resolve");
            } catch { /* silent */ }
        };
        resolve();
        const interval = setInterval(resolve, 30000);
        return () => clearInterval(interval);
    }, []);

    // Fetch my bets when wallet or tab changes
    useEffect(() => {
        if (activeTab !== "bets" || !walletAddress) return;
        const fetchMyBets = async () => {
            try {
                // Fetch all markets, then filter trades for this wallet
                const allMarkets = [...markets, ...resolvedMarkets];
                const bets: any[] = [];
                for (const m of allMarkets) {
                    const resp = await fetch(`/api/markets/${m.id}`);
                    const data = await resp.json();
                    const myTrades = (data.trades ?? []).filter(
                        (t: any) => t.wallet === walletAddress
                    );
                    for (const t of myTrades) {
                        bets.push({ ...t, market: data.market });
                    }
                }
                setMyBets(bets);
            } catch { /* silent */ }
        };
        fetchMyBets();
    }, [activeTab, walletAddress, markets.length, resolvedMarkets.length]);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const token = mapboxgl.accessToken;
        try {
            const resp = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(search)}.json?access_token=${token}`
            );
            const data = await resp.json();
            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center;
                map.current.flyTo({ center: [lng, lat], zoom: 14, essential: true });
            } else {
                setError("Location not found.");
            }
        } catch {
            setError("Search failed.");
        }
        setLoading(false);
        setShowSuggestions(false);
    };

    useEffect(() => {
        const token = mapboxgl.accessToken;
        if (search.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const fetchSuggestions = async () => {
            try {
                let proximity = "";
                if (userLocation) {
                    proximity = `&proximity=${userLocation.longitude},${userLocation.latitude}`;
                }
                const bbox = "&bbox=-80.0,43.3,-78.5,44.0";
                const resp = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(search)}.json?autocomplete=true${proximity}${bbox}&access_token=${token}`
                );
                const data = await resp.json();
                if (data.features) {
                    setSuggestions(data.features);
                    setShowSuggestions(true);
                }
            } catch {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };
        fetchSuggestions();
    }, [search]);

    const handleSuggestionClick = (feature) => {
        setSearch(feature.place_name);
        setShowSuggestions(false);
        map.current.flyTo({ center: feature.center, zoom: 14, essential: true });
    };

    const handleBet = (market: MarketData, outcome: string) => {
        setSelectedBet({ market, outcome });
        setActiveTab("markets");
    };

    const handleBetSuccess = () => {
        setSelectedBet(null);
        refetchMarkets();
        refetchBalance();
    };

    const LAMPORTS_PER_SOL = 1_000_000_000;

    const tabs: Array<{ key: SidebarTab; label: string }> = [
        { key: "markets", label: "Markets" },
        { key: "create", label: "Create" },
        { key: "bets", label: "My Bets" },
    ];

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    zIndex: 0,
                }}
                ref={mapContainer}
            />
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "500px",
                    height: "100vh",
                    background: "rgba(40, 40, 40, 0.92)",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "48px 32px 32px 32px",
                    paddingTop: "80px",
                    overflowY: "auto",
                    boxShadow: "2px 0 24px rgba(0,0,0,0.25)",
                }}
            >
                <div style={{ width: "100%" }} autoComplete="off">
                    <div style={{ position: "relative", width: "100%", marginBottom: "18px" }}>
                        <input
                            type="text"
                            placeholder="Search for a place..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "16px 48px 16px 16px",
                                borderRadius: "10px",
                                border: "1.5px solid #444",
                                background: "#222",
                                color: "#fff",
                                fontSize: "18px",
                                outline: "none",
                            }}
                            disabled={loading}
                            onFocus={() => setShowSuggestions(suggestions.length > 0)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        />
                        {search.length === 0 && (
                            <span style={{
                                position: "absolute",
                                right: "16px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                pointerEvents: "none",
                                color: "#aaa",
                                fontSize: "22px",
                            }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                                    <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </span>
                        )}
                    </div>
                    {showSuggestions && suggestions.length > 0 && (
                        <ul
                            style={{
                                width: "100%",
                                maxHeight: "300px",
                                background: "#222",
                                borderRadius: "10px",
                                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                                overflowY: "auto",
                                zIndex: 2,
                                margin: 0,
                                padding: "8px 0",
                                listStyle: "none",
                                position: "static",
                            }}
                        >
                            {suggestions.map((feature) => (
                                <li
                                    key={feature.id}
                                    style={{
                                        padding: "12px 24px",
                                        cursor: "pointer",
                                        color: "#fff",
                                        fontSize: "16px",
                                        borderBottom: "1px solid #333",
                                    }}
                                    onMouseDown={() => handleSuggestionClick(feature)}
                                >
                                    {feature.place_name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Tabbed Market Section */}
                <div style={{
                    width: "100%",
                    marginTop: "24px",
                    background: "#232323",
                    borderRadius: "8px",
                    padding: "16px",
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}>
                    {/* Tab Bar */}
                    <div style={{ display: "flex", gap: "4px", marginBottom: "14px" }}>
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => { setActiveTab(t.key); setSelectedBet(null); }}
                                style={{
                                    flex: 1,
                                    padding: "8px 0",
                                    borderRadius: "6px",
                                    border: "none",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    background: activeTab === t.key ? "#333" : "transparent",
                                    color: activeTab === t.key ? "#fff" : "#888",
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Off-chain balance bar */}
                    {walletAddress && (
                        <div style={{
                            fontSize: "12px",
                            color: "#888",
                            marginBottom: "12px",
                            padding: "6px 10px",
                            background: "#1a1a1a",
                            borderRadius: "6px",
                            border: "1px solid #333",
                        }}>
                            Betting Balance:{" "}
                            <span style={{ color: "#fff", fontWeight: 600 }}>
                                {(offChainBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL
                            </span>
                        </div>
                    )}

                    {/* Bet Panel (shown inline above market list) */}
                    {selectedBet && walletAddress && (
                        <BetPanel
                            market={selectedBet.market}
                            selectedOutcome={selectedBet.outcome}
                            walletAddress={walletAddress}
                            offChainBalance={offChainBalance}
                            onClose={() => setSelectedBet(null)}
                            onSuccess={handleBetSuccess}
                        />
                    )}

                    {/* Tab Content */}
                    {activeTab === "markets" && (
                        <MarketList
                            markets={markets}
                            resolvedMarkets={resolvedMarkets}
                            loading={marketsLoading}
                            onBet={walletAddress ? handleBet : undefined}
                        />
                    )}

                    {activeTab === "create" && (
                        <CreateMarketPanel onCreated={refetchMarkets} />
                    )}

                    {activeTab === "bets" && (
                        <div>
                            {!walletAddress ? (
                                <div style={{ color: "#888", fontSize: "14px", textAlign: "center", padding: "20px" }}>
                                    Connect wallet to see your bets
                                </div>
                            ) : myBets.length === 0 ? (
                                <div style={{ color: "#888", fontSize: "14px", textAlign: "center", padding: "20px" }}>
                                    No bets placed yet
                                </div>
                            ) : (
                                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                                    {myBets.map((bet) => (
                                        <div
                                            key={bet.id}
                                            style={{
                                                background: "#1e1e1e",
                                                borderRadius: "8px",
                                                padding: "12px",
                                                marginBottom: "8px",
                                                border: "1px solid #333",
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                                <span style={{ fontWeight: 600, fontSize: "14px", color: "#fff" }}>
                                                    Route {bet.market?.route_tag} &middot; Vehicle {bet.market?.vehicle_id}
                                                </span>
                                                <span style={{
                                                    fontSize: "11px",
                                                    padding: "2px 8px",
                                                    borderRadius: "4px",
                                                    fontWeight: 600,
                                                    background: bet.outcome === "EARLY" ? "#1a3a1a" : bet.outcome === "ON_TIME" ? "#3a3a1a" : "#3a1a1a",
                                                    color: bet.outcome === "EARLY" ? "#4ade80" : bet.outcome === "ON_TIME" ? "#facc15" : "#f87171",
                                                }}>
                                                    {bet.outcome}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: "12px", color: "#888" }}>
                                                {bet.shares.toFixed(2)} shares &middot; Cost: {(bet.cost_lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL
                                            </div>
                                            {bet.market?.status === "resolved" && (
                                                <div style={{
                                                    fontSize: "12px",
                                                    marginTop: "4px",
                                                    color: bet.market.resolved_outcome === bet.outcome ? "#4ade80" : "#f87171",
                                                    fontWeight: 600,
                                                }}>
                                                    {bet.market.resolved_outcome === bet.outcome
                                                        ? `Won! Payout: ${(bet.payout_lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`
                                                        : `Lost — Resolved: ${bet.market.resolved_outcome}`}
                                                </div>
                                            )}
                                            {bet.market?.status === "open" && (
                                                <div style={{ fontSize: "12px", marginTop: "4px", color: "#60a5fa" }}>
                                                    Pending...
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Wallet Section */}
                <SidebarWallet />
            </div>
            {error && <div style={{ color: "#ff6b6b", marginTop: "8px" }}>{error}</div>}
        </>
    );
};

export default Map;
