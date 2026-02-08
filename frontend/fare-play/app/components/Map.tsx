"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css';
import StopSidebar from "./StopSidebar";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "YOUR_MAPBOX_ACCESS_TOKEN";

const API_BASE = "http://localhost:5000";

// Streetcar routes to load stops for
const STREETCAR_ROUTES = ["501", "504", "510", "512"];

interface Stop {
    tag: string;
    title: string;
    lat: number;
    lon: number;
    routes: string[];
}

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

const Map = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const streetcarDataRef = useRef<any>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
    const [stops, setStops] = useState<Stop[]>([]);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number }>({ lat: 43.6455, lon: -79.3832 });

    // Initialize map
    useEffect(() => {
        if (map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: "mapbox://styles/mapbox/light-v10", // White/light map style
            center: [-79.3832, 43.6455],
            zoom: 13,
            maxBounds: [
                [-79.9646922, 43.4678844],
                [-79.0033885, 43.8830605]
            ]
        });

        map.current.on("load", () => {
            setMapLoaded(true);
            loadRouteLines();
        });

        // Track map center changes
        map.current.on("moveend", () => {
            if (map.current) {
                const center = map.current.getCenter();
                setMapCenter({ lat: center.lat, lon: center.lng });
            }
        });
    }, []);

    // Load TTC route lines from Toronto GIS
    const loadRouteLines = () => {
        if (!map.current) return;

        const routeEndpoints = [
            { url: "https://gis.toronto.ca/arcgis/rest/services/cot_geospatial7/FeatureServer/10/query?where=1=1&outFields=*&f=geojson", type: "bus", color: "#0088CE", width: 2.5 },
            { url: "https://gis.toronto.ca/arcgis/rest/services/cot_geospatial7/FeatureServer/11/query?where=1=1&outFields=*&f=geojson", type: "subway", color: "#DA2128", width: 2.5 },
            { url: "https://gis.toronto.ca/arcgis/rest/services/cot_geospatial7/FeatureServer/12/query?where=1=1&outFields=*&f=geojson", type: "streetcar", color: "#F8B22D", width: 2.5 }
        ];

        const mapInstance = map.current!;
        routeEndpoints.forEach(({ url, type, color, width }) => {
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    const sourceId = `ttc-${type}-routes`;
                    const layerId = `ttc-${type}-routes-layer`;

                    // Store streetcar data for highlighting
                    if (type === "streetcar") {
                        streetcarDataRef.current = data;
                    }

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

                        // Add highlight layer for streetcar routes
                        if (type === "streetcar") {
                            mapInstance.addLayer({
                                id: "ttc-streetcar-highlight",
                                type: "line",
                                source: sourceId,
                                layout: {
                                    "line-join": "round",
                                    "line-cap": "round"
                                },
                                paint: {
                                    "line-color": "#4ECDC4",
                                    "line-width": [
                                        "interpolate",
                                        ["linear"],
                                        ["zoom"],
                                        10, 3,
                                        15, 6
                                    ],
                                    "line-opacity": 1
                                },
                                filter: ["==", ["get", "ROUTE_NAME"], ""]
                            });
                        }
                    }
                })
                .catch(err => console.error(`Error loading ${type} routes:`, err));
        });
    };

    // Highlight selected route on the map
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        const mapInstance = map.current;
        if (!mapInstance.getLayer("ttc-streetcar-highlight")) return;

        if (selectedRoute) {
            // Try to match route number in the GeoJSON properties
            // Toronto GIS typically uses LINENAME or ROUTE_NAME
            mapInstance.setFilter("ttc-streetcar-highlight", [
                "any",
                ["==", ["get", "LINENAME"], selectedRoute],
                ["==", ["get", "ROUTE_NAME"], selectedRoute],
                ["in", selectedRoute, ["get", "LINENAME"]],
                ["in", selectedRoute, ["get", "ROUTE_NAME"]]
            ]);
            // Set the highlight color to match the route's badge color
            mapInstance.setPaintProperty("ttc-streetcar-highlight", "line-color", getRouteColor(selectedRoute));
        } else {
            // No route selected, hide highlight
            mapInstance.setFilter("ttc-streetcar-highlight", ["==", ["get", "ROUTE_NAME"], ""]);
        }
    }, [selectedRoute, mapLoaded]);

    // Load stops from backend for selected route
    const loadStopsForRoute = useCallback(async (routeTag: string) => {
        try {
            const response = await fetch(`${API_BASE}/route/${routeTag}/stops`);
            if (!response.ok) throw new Error("Failed to fetch stops");
            const data = await response.json();

            const newStops: Stop[] = data.stops.map((s: any) => ({
                tag: s.tag,
                title: s.title,
                lat: s.lat,
                lon: s.lon,
                routes: [routeTag],
            }));

            setStops(newStops);
            return newStops;
        } catch (err) {
            console.error("Failed to load stops:", err);
            return [];
        }
    }, []);

    // Update markers when stops change
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        if (stops.length === 0) return;

        // Add new markers for stops
        stops.forEach(stop => {
            const el = document.createElement('div');
            el.className = 'stop-marker';
            el.style.width = '14px';
            el.style.height = '14px';
            el.style.borderRadius = '50%';
            const SELECTED_COLOR = '#000000';

            el.style.backgroundColor =
                selectedStop?.tag === stop.tag ? SELECTED_COLOR : '#ffffff';

            el.style.border =
                '2px solid ' + (selectedStop?.tag === stop.tag ? SELECTED_COLOR : '#333');

            el.style.cursor = 'pointer';
            el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

            el.addEventListener('mouseenter', () => {
                el.style.backgroundColor = '#000000';
                el.style.borderColor = '#000000';
            });

            el.addEventListener('mouseleave', () => {
                if (selectedStop?.tag !== stop.tag) {
                    el.style.backgroundColor = '#ffffff';
                    el.style.borderColor = '#333';
                }
            });

            el.addEventListener('click', () => {
                setSelectedStop(stop);
                if (map.current) {
                    map.current.flyTo({
                        center: [stop.lon, stop.lat],
                        zoom: 15,
                        duration: 500
                    });
                }
            });

            const marker = new mapboxgl.Marker(el)
                .setLngLat([stop.lon, stop.lat])
                .addTo(map.current!);

            markersRef.current.push(marker);
        });

        // Fit bounds to show all stops after markers are added
        if (selectedRoute && !selectedStop) {
            const bounds = new mapboxgl.LngLatBounds();
            stops.forEach(s => bounds.extend([s.lon, s.lat]));
            map.current.fitBounds(bounds, { padding: 100, maxZoom: 14, duration: 1000 });
        }
    }, [stops, selectedStop, mapLoaded, selectedRoute]);

    // Handle stop selection from sidebar
    const handleStopSelect = useCallback(async (stop: Stop | null, routeTag: string | null) => {
        setSelectedStop(stop);
        setSelectedRoute(routeTag);

        if (routeTag && !stop) {
            // Route selected, load its stops
            await loadStopsForRoute(routeTag);
        } else if (routeTag && stop) {
            // Stop selected directly (from search), load route stops to show markers
            await loadStopsForRoute(routeTag);
        } else if (!routeTag) {
            // Back to routes, clear stops
            setStops([]);
        }

        if (stop && map.current) {
            map.current.flyTo({
                center: [stop.lon, stop.lat],
                zoom: 15,
                duration: 500
            });
        }
    }, [loadStopsForRoute]);

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    top: "70px",
                    left: 0,
                    width: "100vw",
                    height: "calc(100vh - 70px)",
                    zIndex: 0,
                }}
                ref={mapContainer}
            />

            <StopSidebar
                selectedStop={selectedStop}
                selectedRoute={selectedRoute}
                onStopSelect={handleStopSelect}
                mapCenter={mapCenter}
            />

            {/* Legend */}
            <div style={{
                position: "fixed",
                bottom: "24px",
                right: "24px",
                background: "#ffffff",
                borderRadius: "12px",
                padding: "16px 24px",
                color: "#1a1a1a",
                boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                border: "2px solid #e9ecef",
                zIndex: 5,
                fontSize: "13px",
                minWidth: "180px",
            }}>
                <div style={{ fontWeight: 600, marginBottom: "12px", color: "#1a1a1a" }}>Map Legend</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "24px", height: "3px", background: "#DA2128", borderRadius: "2px" }}></div>
                        <span>Subway</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "24px", height: "3px", background: "#F8B22D", borderRadius: "2px" }}></div>
                        <span>Streetcar</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "24px", height: "3px", background: "#0088CE", borderRadius: "2px" }}></div>
                        <span>Bus</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#fff", border: "2px solid #333" }}></div>
                        <span>Stops</span>
                    </div>
                </div>
                {!mapLoaded && (
                    <div style={{ marginTop: "10px", fontSize: "11px", color: "#6c757d" }}>
                        Loading map...
                    </div>
                )}
            </div>
        </>
    );
};

export default Map;
