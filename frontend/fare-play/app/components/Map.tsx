"use client";
import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css';

// TODO: Replace with your own Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "YOUR_MAPBOX_ACCESS_TOKEN";

const Map = () => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [userLocation, setUserLocation] = useState(null);

    useEffect(() => {
        if (map.current) return; // initialize map only once
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/dark-v10",
            center: [-79.3832, 43.6455], // Union Station, Toronto
            zoom: 14,
        });

        // Custom bounding box for Union Station area
        // [west, south], [east, north]
        const unionStationBounds = [
            [-79.992158, 43.4678844], // bottom left
            [-79.0033885, 43.8830605], // top right
        ];
        map.current.setMaxBounds(unionStationBounds);

        // Remove geolocation flyTo: map always starts at Union Station
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
                // Toronto/GTA bounding box: [west, south, east, north]
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
            </div>
            {error && <div style={{ color: "#ff6b6b", marginTop: "8px" }}>{error}</div>}
        </>
    );
};

export default Map;
