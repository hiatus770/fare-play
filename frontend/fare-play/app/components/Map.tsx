"use client";
import React, { useRef, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css';

// TODO: Replace with your own Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "YOUR_MAPBOX_ACCESS_TOKEN";

const Map = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [stopsData, setStopsData] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [selectedStop, setSelectedStop] = useState(null);
    const [betTime, setBetTime] = useState("");
    const [betAmount, setBetAmount] = useState("");
    const [placingBet, setPlacingBet] = useState(false);
        const [lobbyCount, setLobbyCount] = useState(0);
    // Placeholder for bus number logic
    const getBusNumber = (stop) => {
        // TODO: Implement actual bus number lookup
        return "(Bus # placeholder)";
    };

    // Fetch lobby count when a stop is selected
    useEffect(() => {
        if (!selectedStop) return;
        // TODO: Replace with actual backend call
        // Simulate fetch with random number for now
        setLobbyCount(Math.floor(Math.random() * 10) + 1);
    }, [selectedStop]);

    useEffect(() => {
        if (map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: "mapbox://styles/mapbox/dark-v10",
            center: [-79.3832, 43.6455],
            zoom: 11,
            // Restrict map bounds to Toronto/GTA polygon
            maxBounds: [
                [-79.9646922, 43.4678844], // southwest (bottom left)
                [-79.0033885, 43.8830605]  // northeast (top right)
            ]
        });

        map.current.on("load", () => {
            setMapLoaded(true);
            
            // Load TTC Routes from separate layers (Bus=10, Subway=11, Streetcar=12)
            const routeEndpoints = [
                { url: "https://gis.toronto.ca/arcgis/rest/services/cot_geospatial7/FeatureServer/10/query?where=1=1&outFields=*&f=geojson", type: "bus", color: "#0088CE", width: 1.5 },
                { url: "https://gis.toronto.ca/arcgis/rest/services/cot_geospatial7/FeatureServer/11/query?where=1=1&outFields=*&f=geojson", type: "subway", color: "#DA2128", width: 4 },
                { url: "https://gis.toronto.ca/arcgis/rest/services/cot_geospatial7/FeatureServer/12/query?where=1=1&outFields=*&f=geojson", type: "streetcar", color: "#F8B22D", width: 2.5 }
            ];

            const mapInstance = map.current!;
            routeEndpoints.forEach(({ url, type, color, width }) => {
                fetch(url)
                    .then(res => res.json())
                    .then(data => {
                        console.log(`${type} routes loaded:`, data.features?.length, "routes");

                        const sourceId = `ttc-${type}-routes`;
                        const layerId = `ttc-${type}-routes-layer`;

                        if (!mapInstance.getSource(sourceId)) {
                            mapInstance.addSource(sourceId, {
                                type: "geojson",
                                data: data
                            });

                            mapInstance.addLayer({
                                id: layerId,
                                type: "line",
                                source: sourceId,
                                layout: {
                                    "line-join": "round",
                                    "line-cap": "round"
                                },
                                paint: {
                                    "line-color": color,
                                    "line-width": [
                                        "interpolate",
                                        ["linear"],
                                        ["zoom"],
                                        10, width * 0.5,
                                        15, width
                                    ],
                                    "line-opacity": 0.9
                                }
                            });

                            // Add click handler for routes
                            mapInstance.on("click", layerId, (e) => {
                                if (!e.features?.[0]) return;
                                const properties = e.features[0].properties || {};
                                const routeTypeName = type.charAt(0).toUpperCase() + type.slice(1);

                                new mapboxgl.Popup()
                                    .setLngLat(e.lngLat)
                                    .setHTML(`
                                        <div style="color: #000; padding: 4px;">
                                            <strong>${properties.RTE_LABEL || properties.ROUTE_NAME || properties.RTE || "Route"}</strong><br/>
                                            Type: ${routeTypeName}<br/>
                                            ${properties.RTE_DESC || properties.ROUTE_DESC || ""}
                                        </div>
                                    `)
                                    .addTo(mapInstance);
                            });

                            // Change cursor on hover
                            mapInstance.on("mouseenter", layerId, () => {
                                mapInstance.getCanvas().style.cursor = "pointer";
                            });
                            mapInstance.on("mouseleave", layerId, () => {
                                mapInstance.getCanvas().style.cursor = "";
                            });
                        }
                    })
                    .catch(err => {
                        console.error(`Error loading ${type} routes:`, err);
                    });
            });

            // Then add TTC Stops (circles) - these will appear on top
            fetch("https://gis.toronto.ca/arcgis/rest/services/cot_geospatial7/FeatureServer/1/query?where=1=1&outFields=*&f=geojson")
                .then(res => res.json())
                .then(data => {
                    console.log("Stops data loaded:", data.features?.length, "stops");
                    setStopsData(data.features || []);
                    if (!mapInstance.getSource("ttc-stops")) {
                        mapInstance.addSource("ttc-stops", {
                            type: "geojson",
                            data: data
                        });
                        mapInstance.addLayer({
                            id: "ttc-stops-layer",
                            type: "circle",
                            source: "ttc-stops",
                            paint: {
                                "circle-radius": [
                                    "interpolate",
                                    ["linear"],
                                    ["zoom"],
                                    10, 2,
                                    15, 5
                                ],
                                "circle-color": "#ffffff",
                                "circle-opacity": 0.9,
                                "circle-stroke-width": 1,
                                "circle-stroke-color": "#000000"
                            }
                        });
                        // Add click handler for stops
                        mapInstance.on("click", "ttc-stops-layer", (e) => {
                            if (!e.features?.[0]) return;
                            const properties = e.features[0].properties || {};
                            setSelectedStop({
                                stopId: properties.STOP_ID || "N/A",
                                lngLat: e.lngLat
                            });
                        });
                        // Change cursor on hover
                        mapInstance.on("mouseenter", "ttc-stops-layer", () => {
                            mapInstance.getCanvas().style.cursor = "pointer";
                        });
                        mapInstance.on("mouseleave", "ttc-stops-layer", () => {
                            mapInstance.getCanvas().style.cursor = "";
                        });
                    }
                })
                .catch(err => {
                    console.error("Error loading stops:", err);
                });
        });
    }, []);

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

    // Fetch suggestions as user types
    useEffect(() => {
        if (search.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        // Filter stops by name or stop number
        const filtered = stopsData.filter(feature => {
            const props = feature.properties || {};
            const name = (props.STOP_NAME || "").toLowerCase();
            const id = (props.STOP_ID || "").toString();
            const code = (props.STOP_CODE || "").toString();
            const searchLower = search.toLowerCase();
            return (
                name.includes(searchLower) ||
                id.includes(searchLower) ||
                code.includes(searchLower)
            );
        });
        setSuggestions(filtered.slice(0, 20)); // limit to 20 suggestions
        setShowSuggestions(filtered.length > 0);
    }, [search, stopsData]);

    const handleSuggestionClick = (feature) => {
        const coords = feature.geometry.coordinates;
        setSearch(feature.properties.STOP_NAME || feature.properties.STOP_ID || "");
        setShowSuggestions(false);
        map.current.flyTo({ center: coords, zoom: 15, essential: true });
    };

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

            {/* Custom Modal Popup for Stop */}
            {selectedStop && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        background: "rgba(0,0,0,0.45)",
                        zIndex: 100,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onClick={() => setSelectedStop(null)}
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: "18px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                            padding: "48px 64px",
                            fontSize: "32px",
                            color: "#222",
                            minWidth: "420px",
                            minHeight: "220px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ fontWeight: 700, fontSize: "36px", marginBottom: "16px" }}>Stop Number</div>
                        <div style={{ fontSize: "48px", color: "#DA2128", fontWeight: 800 }}>{selectedStop.stopId}</div>
                        <div style={{ fontSize: "18px", margin: "8px 0 16px 0", color: "#222" }}>
                            <span style={{ fontWeight: 600 }}>Lobby Count:</span> {lobbyCount} currently betting
                        </div>
                        <div style={{ fontSize: "22px", margin: "16px 0 8px 0", color: "#0088CE" }}>
                            Bus Number: <span style={{ fontWeight: 700 }}>{getBusNumber(selectedStop)}</span>
                        </div>
                        <div style={{ margin: "16px 0 8px 0", width: "100%", textAlign: "left" }}>
                            <label style={{ fontSize: "18px", fontWeight: 600 }}>Choose Time:</label><br />
                            <input
                                type="time"
                                value={betTime}
                                onChange={e => setBetTime(e.target.value)}
                                style={{
                                    fontSize: "20px",
                                    padding: "8px 16px",
                                    borderRadius: "8px",
                                    border: "1.5px solid #DA2128",
                                    marginTop: "6px",
                                    marginBottom: "12px",
                                    width: "180px"
                                }}
                            />
                        </div>
                        <div style={{ margin: "8px 0 16px 0", width: "100%", textAlign: "left" }}>
                            <label style={{ fontSize: "18px", fontWeight: 600 }}>Bet Amount (SOL):</label><br />
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={betAmount}
                                onChange={e => setBetAmount(e.target.value)}
                                style={{
                                    fontSize: "20px",
                                    padding: "8px 16px",
                                    borderRadius: "8px",
                                    border: "1.5px solid #DA2128",
                                    marginTop: "6px",
                                    width: "180px"
                                }}
                            />
                        </div>
                        <button
                            style={{
                                marginTop: "12px",
                                padding: "14px 36px",
                                fontSize: "22px",
                                borderRadius: "10px",
                                background: placingBet ? "#aaa" : "#DA2128",
                                color: "#fff",
                                border: "none",
                                cursor: placingBet ? "not-allowed" : "pointer",
                                fontWeight: 700,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                transition: "background 0.2s",
                            }}
                            disabled={placingBet || !betAmount || !betTime}
                            onClick={() => {
                                setPlacingBet(true);
                                // TODO: Solana bet logic here
                                setTimeout(() => {
                                    setPlacingBet(false);
                                    setSelectedStop(null);
                                }, 1200);
                            }}
                        >Place Bet (Solana)</button>
                        <button
                            style={{
                                marginTop: "18px",
                                padding: "10px 28px",
                                fontSize: "16px",
                                borderRadius: "8px",
                                background: "#222",
                                color: "#fff",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 600,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            }}
                            onClick={() => setSelectedStop(null)}
                        >Close</button>
                    </div>
                </div>
            )}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "500px",
                    height: "100vh",
                    background: "rgba(40, 40, 40, 0.92)", // dark gray overlay
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "48px 32px 32px 32px",
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
                                {/* Simple magnifying glass SVG icon */}
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
                                {suggestions.map((feature) => {
                                    const props = feature.properties || {};
                                    return (
                                        <li
                                            key={feature.properties.STOP_ID || feature.properties.STOP_CODE}
                                            style={{
                                                padding: "12px 24px",
                                                cursor: "pointer",
                                                color: "#fff",
                                                fontSize: "16px",
                                                borderBottom: "1px solid #333",
                                            }}
                                            onMouseDown={() => handleSuggestionClick(feature)}
                                        >
                                            {props.STOP_NAME} <span style={{ color: '#aaa', fontSize: '14px', marginLeft: '8px' }}>#{props.STOP_ID}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                </div>

                {/* Legend for route types */}
                <div style={{
                    width: "100%",
                    marginTop: "24px",
                    background: "#232323",
                    borderRadius: "8px",
                    padding: "16px",
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}>
                    <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "12px" }}>Legend</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ width: "40px", height: "3px", background: "#DA2128" }}></div>
                            <span>Subway</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ width: "40px", height: "2.5px", background: "#F8B22D" }}></div>
                            <span>Streetcar</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ width: "40px", height: "2px", background: "#0088CE" }}></div>
                            <span>Bus</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ffffff", border: "1px solid #000" }}></div>
                            <span>Stops</span>
                        </div>
                    </div>
                    <div style={{ marginTop: "12px", fontSize: "13px", color: "#aaa", fontStyle: "italic" }}>
                        {mapLoaded ? "✓ Map loaded - zoom in to see routes" : "Loading map..."}
                    </div>
                </div>

                {/* Nearby Stops Section */}
                <div style={{
                    width: "100%",
                    marginTop: "24px",
                    background: "#232323",
                    borderRadius: "8px",
                    padding: "16px",
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}>
                    <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "12px" }}>Nearby Stops</div>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        <li style={{ padding: "8px 0", borderBottom: "1px solid #333" }}>Stop 1 (placeholder)</li>
                        <li style={{ padding: "8px 0", borderBottom: "1px solid #333" }}>Stop 2 (placeholder)</li>
                        <li style={{ padding: "8px 0", borderBottom: "1px solid #333" }}>Stop 3 (placeholder)</li>
                        <li style={{ padding: "8px 0", borderBottom: "1px solid #333" }}>Stop 4 (placeholder)</li>
                        <li style={{ padding: "8px 0" }}>Stop 5 (placeholder)</li>
                    </ul>
                </div>
                
                {error && (
                    <div style={{ 
                        color: "#ff6b6b", 
                        marginTop: "12px",
                        padding: "12px",
                        background: "rgba(255, 107, 107, 0.1)",
                        borderRadius: "6px",
                        fontSize: "14px"
                    }}>
                        {error}
                    </div>
                )}
            </div>
        </>
    );
};

export default Map;