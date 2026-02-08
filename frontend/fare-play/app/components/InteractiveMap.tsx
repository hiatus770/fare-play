"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "YOUR_MAPBOX_ACCESS_TOKEN";

interface RouteConfig {
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

interface InteractiveMapProps {
  selectedRoute?: string | null;
  selectedStop?: {
    tag: string;
    title: string;
    route: string;
  } | null;
  selectedVehicle?: string | null;
  onStopSelect?: (stop: {
    tag: string;
    title: string;
    route: string;
  }) => void;
  onVehicleSelect?: (vehicleId: string) => void;
}

const API_BASE = "http://localhost:5000";

// Generate a color for a route based on its tag (deterministic)
const generateRouteColor = (tag: string): string => {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
    "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B", "#ABEBC6",
    "#85C1E2", "#F8B88B", "#D7BDE2", "#A9DFBF", "#F1948A",
  ];
  // Use tag to deterministically pick a color
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const ROUTES_CONFIG_EMPTY: RouteConfig[] = [];

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  selectedRoute,
  selectedStop,
  selectedVehicle,
  onStopSelect,
  onVehicleSelect,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState("");
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [vehicleMarkers, setVehicleMarkers] = useState<Map<string, any>>(
    new Map()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Stop[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const vehicleUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousCoordinatesRef = useRef<Map<string, [number, number]>>(
    new Map()
  );
  const stopMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const uniqueStopsRef = useRef<Map<string, Stop>>(new Map());

  // Initialize map with white background and custom styling
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-79.3832, 43.6455], // Union Station, Toronto
        zoom: 13,
        maxBounds: [
          [-79.9646922, 43.4678844],
          [-79.0033885, 43.8830605],
        ],
      });

      map.current.on("load", () => {
        loadTTCRoutes();
      });
    } catch (err) {
      console.error("Error initializing map:", err);
      setError("Failed to initialize map");
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Load TTC routes and stops
  const loadTTCRoutes = useCallback(async () => {
    if (!map.current) return;

    try {
      // Fetch all available routes from backend
      const routesResponse = await fetch(`${API_BASE}/routes`);
      if (!routesResponse.ok) {
        throw new Error("Failed to fetch routes");
      }
      const routesData = await routesResponse.json();

      // Build route config with generated colors
      const allRoutes: RouteConfig[] = routesData.routes.map((r: any) => ({
        tag: r.tag,
        name: r.name,
        color: generateRouteColor(r.tag),
      }));

      // Filter to only streetcars/subways (remove buses)
      const filteredRoutes = allRoutes.filter((r) => {
        const name = r.name.toLowerCase();
        return !name.includes('bus') && !name.includes('express');
      });

      setRoutes(filteredRoutes);

      for (const route of filteredRoutes) {
        const response = await fetch(
          `${API_BASE}/route/${route.tag}/geometry`
        );
        if (!response.ok) {
          console.warn(`Failed to fetch route ${route.tag}`);
          continue;
        }

        const geojson = await response.json();

        // Add source for this route
        const sourceId = `route-${route.tag}-source`;
        if (!map.current.getSource(sourceId)) {
          map.current.addSource(sourceId, {
            type: "geojson",
            data: geojson,
          });
        }

        // Add route line layer (subtle background lines)
        const lineLayerId = `route-${route.tag}-line`;
        if (!map.current.getLayer(lineLayerId)) {
          map.current.addLayer({
            id: lineLayerId,
            type: "line",
            source: sourceId,
            filter: ["==", ["get", "type"], "route"],
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": route.color,
              "line-width": 1.5,
              "line-opacity": 0.3,
            },
          });
        }

        // Extract and aggregate stops from route geometry
        const stops = geojson.features?.filter(
          (f: any) => f.properties?.type === "stop"
        ) || [];

        stops.forEach((stop: any) => {
          const stopTag = stop.properties?.tag;
          if (!stopTag) return;

          // Store unique stop (avoiding duplicates)
          if (!uniqueStopsRef.current.has(stopTag)) {
            uniqueStopsRef.current.set(stopTag, {
              tag: stopTag,
              title: stop.properties?.title || "Unknown Stop",
              lat: stop.geometry?.coordinates[1] || 0,
              lon: stop.geometry?.coordinates[0] || 0,
              routes: [route.tag],
            });
          } else {
            // Add this route to the existing stop if not already present
            const existingStop = uniqueStopsRef.current.get(stopTag)!;
            if (!existingStop.routes.includes(route.tag)) {
              existingStop.routes.push(route.tag);
            }
          }
        });
      }

      // Create a unified stops source with all unique stops
      const allStopsGeoJSON: GeoJSON.FeatureCollection<
        GeoJSON.Point,
        { tag: string; title: string; routes: string }
      > = {
        type: "FeatureCollection",
        features: Array.from(uniqueStopsRef.current.values()).map((stop) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [stop.lon, stop.lat],
          },
          properties: {
            tag: stop.tag,
            title: stop.title,
            routes: stop.routes.join(","),
          },
        })),
      };

      // Add unified stops source
      if (!map.current.getSource("unified-stops-source")) {
        map.current.addSource("unified-stops-source", {
          type: "geojson",
          data: allStopsGeoJSON as any,
        });
      }

      // Add unified stops layer (larger, more prominent)
      if (!map.current.getLayer("unified-stops-layer")) {
        map.current.addLayer({
          id: "unified-stops-layer",
          type: "circle",
          source: "unified-stops-source",
          paint: {
            "circle-radius": 8,
            "circle-color": "#EF4444",
            "circle-opacity": 0.9,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });

        // Add click and hover handlers for stops
        if (map.current) {
          map.current.on("click", "unified-stops-layer", (e: any) => {
            const feature = e.features[0];
            const routesArray = feature.properties.routes.split(",");
            const stopData = {
              tag: feature.properties.tag,
              title: feature.properties.title,
              route: routesArray[0], // Use the first route as default
            };

            // Call the callback to update sidebar
            if (onStopSelect) {
              onStopSelect(stopData);
            }

            // Fly to stop
            if (map.current && feature.geometry.coordinates) {
              map.current.flyTo({
                center: feature.geometry.coordinates,
                zoom: 15,
                essential: true,
              });
            }
          });

          map.current.on("mouseenter", "unified-stops-layer", () => {
            if (map.current) {
              map.current.getCanvas().style.cursor = "pointer";
              map.current.setPaintProperty(
                "unified-stops-layer",
                "circle-radius",
                10
              );
            }
          });

          map.current.on("mouseleave", "unified-stops-layer", () => {
            if (map.current) {
              map.current.getCanvas().style.cursor = "";
              map.current.setPaintProperty(
                "unified-stops-layer",
                "circle-radius",
                8
              );
            }
          });
        }
      }
    } catch (err) {
      console.error("Error loading TTC routes:", err);
      setError("Failed to load transit routes");
    }
  }, [onStopSelect]);

  // Search for stops by query
  const searchStops = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/stops/search?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        console.warn("Failed to search stops");
        return;
      }

      const results = await response.json();
      setSearchResults(results || []);
      setShowSearchResults(true);
    } catch (err) {
      console.error("Error searching stops:", err);
    }
  }, []);

  // Handle search query input with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchStops(searchQuery);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchStops]);

  // Get nearby stops using geolocation
  const handleGeolocation = useCallback(async () => {
    setIsLoadingLocation(true);

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `${API_BASE}/stops/nearby?lat=${latitude}&lon=${longitude}&radius=1`
          );

          if (!response.ok) {
            console.warn("Failed to fetch nearby stops");
            setIsLoadingLocation(false);
            return;
          }

          const nearbyStops = await response.json();
          setSearchResults(nearbyStops || []);
          setShowSearchResults(true);
          setIsLoadingLocation(false);

          // Fly to user's location
          if (map.current) {
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 14,
              essential: true,
            });
          }
        } catch (err) {
          console.error("Error fetching nearby stops:", err);
          setError("Failed to load nearby stops");
          setIsLoadingLocation(false);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError("Unable to access your location");
        setIsLoadingLocation(false);
      }
    );
  }, []);

  // Fetch and update vehicle positions
  const updateVehiclePositions = useCallback(async () => {
    if (!map.current || !selectedRoute) return;

    try {
      const response = await fetch(`${API_BASE}/route/${selectedRoute}/geometry`);
      if (!response.ok) return;

      const geojson = await response.json();

      // Find vehicle features in the GeoJSON
      const vehicles = geojson.features?.filter(
        (f: any) => f.properties?.type === "vehicle"
      ) || [];

      setVehicleMarkers((prevMarkers) => {
        const newMarkers = new Map(prevMarkers);

        vehicles.forEach((vehicle: any) => {
          const vehicleId = vehicle.properties?.vehicle_id;
          if (!vehicleId) return;

          const coordinates = vehicle.geometry?.coordinates as [number, number];
          if (!coordinates) return;

          if (!newMarkers.has(vehicleId)) {
            // Create new marker
            const el = document.createElement("div");
            el.className = "vehicle-marker";
            el.style.width = "24px";
            el.style.height = "24px";
            el.style.borderRadius = "50%";
            el.style.background = selectedRoute === "501" ? "#FF6B6B" : "#4ECDC4";
            el.style.border = "2px solid #fff";
            el.style.cursor = "pointer";
            el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)";
            el.style.display = "flex";
            el.style.alignItems = "center";
            el.style.justifyContent = "center";
            el.style.fontSize = "12px";
            el.style.color = "#fff";
            el.style.fontWeight = "bold";
            el.textContent = vehicleId.slice(-2);

            const marker = new mapboxgl.Marker({ element: el }).setLngLat(
              coordinates
            );
            marker.addTo(map.current!);

            el.addEventListener("click", () => {
              if (onVehicleSelect) {
                onVehicleSelect(vehicleId);
              }
            });

            newMarkers.set(vehicleId, {
              marker,
              el,
              coordinates,
            });
          } else {
            // Update existing marker position
            const markerData = newMarkers.get(vehicleId);
            if (markerData) {
              markerData.marker.setLngLat(coordinates);
              markerData.coordinates = coordinates;
            }
          }
        });

        // Remove markers for vehicles that no longer exist
        for (const [vehicleId, markerData] of newMarkers) {
          if (!vehicles.some((v: any) => v.properties?.vehicle_id === vehicleId)) {
            markerData.marker.remove();
            newMarkers.delete(vehicleId);
          }
        }

        return newMarkers;
      });
    } catch (err) {
      console.error("Error updating vehicle positions:", err);
    }
  }, [selectedRoute, onVehicleSelect]);

  // Set up vehicle position updates
  useEffect(() => {
    if (!selectedRoute) {
      // Clear vehicle markers when no route selected
      vehicleMarkers.forEach((markerData) => markerData.marker.remove());
      setVehicleMarkers(new Map());
      return;
    }

    // Initial update
    updateVehiclePositions();

    // Set up interval for regular updates (every 5 seconds)
    vehicleUpdateIntervalRef.current = setInterval(() => {
      updateVehiclePositions();
    }, 5000);

    return () => {
      if (vehicleUpdateIntervalRef.current) {
        clearInterval(vehicleUpdateIntervalRef.current);
      }
    };
  }, [selectedRoute, updateVehiclePositions]);

  // Update highlight on selected vehicle change
  useEffect(() => {
    vehicleMarkers.forEach((markerData, vehicleId) => {
      if (selectedVehicle === vehicleId) {
        markerData.el.style.boxShadow =
          "0 0 12px rgba(79, 204, 196, 1), 0 2px 8px rgba(0,0,0,0.4)";
        markerData.el.style.width = "28px";
        markerData.el.style.height = "28px";
      } else {
        markerData.el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)";
        markerData.el.style.width = "24px";
        markerData.el.style.height = "24px";
      }
    });
  }, [selectedVehicle, vehicleMarkers]);

  const selectSearchResult = useCallback(
    (stop: Stop) => {
      const stopData = {
        tag: stop.tag,
        title: stop.title,
        route: stop.routes[0], // Use the first route as default
      };

      if (onStopSelect) {
        onStopSelect(stopData);
      }

      // Fly to the selected stop
      if (map.current) {
        map.current.flyTo({
          center: [stop.lon, stop.lat],
          zoom: 15,
          essential: true,
        });
      }

      setShowSearchResults(false);
      setSearchQuery("");
    },
    [onStopSelect]
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 60, // Below TopBar
        left: "380px", // Right of StopSidebar
        right: 0,
        bottom: 0,
        zIndex: 1,
      }}
      ref={mapContainer}
    >
      {error && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            background: "#EF4444",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "6px",
            zIndex: 10,
            maxWidth: "300px",
          }}
        >
          {error}
        </div>
      )}

      {/* Stop Search Bar */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <input
            type="text"
            placeholder="Search stops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "10px 16px",
              borderRadius: "6px",
              border: "1px solid #ddd",
              fontSize: "14px",
              width: "240px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              backgroundColor: "#fff",
            }}
          />

          <button
            onClick={handleGeolocation}
            disabled={isLoadingLocation}
            title="Find nearby stops"
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid #ddd",
              background: "#fff",
              cursor: isLoadingLocation ? "not-allowed" : "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: isLoadingLocation ? 0.6 : 1,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            {isLoadingLocation ? "..." : "📍"}
          </button>
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div
            style={{
              background: "#fff",
              borderRadius: "6px",
              border: "1px solid #ddd",
              maxHeight: "300px",
              overflowY: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 11,
            }}
          >
            {searchResults.map((stop) => (
              <div
                key={stop.tag}
                onClick={() => selectSearchResult(stop)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #eee",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "#fff";
                }}
              >
                <div style={{ fontWeight: "600", fontSize: "13px" }}>
                  {stop.title}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#666",
                    marginTop: "2px",
                  }}
                >
                  Routes: {stop.routes.join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "16px",
          minWidth: "220px",
          zIndex: 5,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            color: "#EF4444",
            fontSize: "12px",
            fontWeight: "600",
            marginBottom: "12px",
            textTransform: "uppercase",
          }}
        >
          Routes
        </div>
        {routes.map((route) => (
          <div
            key={route.tag}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
              color: "#333",
              fontSize: "13px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                backgroundColor: route.color,
                borderRadius: "2px",
              }}
            />
            <div>
              <div style={{ fontWeight: "600" }}>Route {route.tag}</div>
              <div style={{ fontSize: "11px", color: "#888" }}>
                {route.name}
              </div>
            </div>
          </div>
        ))}

        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #eee",
            color: "#666",
            fontSize: "11px",
            lineHeight: "1.5",
          }}
        >
          Click stops to view predictions
        </div>
      </div>

      {/* Selected Stop Info */}
      {selectedStop && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "12px 16px",
            color: "#333",
            fontSize: "13px",
            maxWidth: "250px",
            zIndex: 5,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              color: "#EF4444",
              fontSize: "11px",
              fontWeight: "600",
              marginBottom: "4px",
              textTransform: "uppercase",
            }}
          >
            Selected Stop
          </div>
          <div style={{ fontWeight: "600", marginBottom: "8px" }}>
            {selectedStop.title}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
            }}
          >
            Stop ID: {selectedStop.tag}
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;
