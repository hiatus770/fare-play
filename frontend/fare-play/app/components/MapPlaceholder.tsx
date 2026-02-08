"use client";
import React from "react";

const MapPlaceholder = () => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "450px",
        right: 0,
        bottom: 0,
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "20px",
        color: "#fff",
        zIndex: 1,
      }}
    >
      <div
        style={{
          fontSize: "48px",
          opacity: 0.3,
        }}
      >
        🗺️
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ margin: "0 0 10px 0", fontSize: "24px", fontWeight: "700" }}>
          Map Coming Soon
        </h2>
        <p style={{ margin: "0", color: "#aaa", fontSize: "14px" }}>
          Real-time TTC transit visualization in progress
        </p>
      </div>
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "20px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(79, 204, 196, 0.1)",
            border: "1px solid #4ECDC4",
            borderRadius: "4px",
            fontSize: "12px",
            color: "#4ECDC4",
          }}
        >
          ✓ API Ready
        </div>
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(79, 204, 196, 0.1)",
            border: "1px solid #4ECDC4",
            borderRadius: "4px",
            fontSize: "12px",
            color: "#4ECDC4",
          }}
        >
          ✓ Route Data Available
        </div>
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(255, 107, 107, 0.1)",
            border: "1px solid #FF6B6B",
            borderRadius: "4px",
            fontSize: "12px",
            color: "#FF6B6B",
          }}
        >
          ⏳ Map In Development
        </div>
      </div>
    </div>
  );
};

export default MapPlaceholder;
