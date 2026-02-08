"use client";
import React, { useState } from "react";

const TopNav = () => {
  const [walletConnected, setWalletConnected] = useState(false);

  const handleMapClick = () => {
    // Scroll to top or reset map view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProfileClick = () => {
    // TODO: Navigate to profile page or open profile modal
    alert("Profile functionality coming soon!");
  };

  const handleWalletClick = () => {
    // TODO: Connect Solana wallet
    if (!walletConnected) {
      setWalletConnected(true);
      alert("Wallet connection coming soon! Will integrate Solana wallet.");
    } else {
      alert("Wallet already connected");
    }
  };

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "70px",
        background: "#ffffff",
        borderBottom: "2px solid #e0e0e0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        zIndex: 100,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Left: Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            background: "linear-gradient(135deg, #DA2128 0%, #E74C3C 100%)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "700",
            color: "#fff",
            fontSize: "18px",
          }}
        >
          FP
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: "700",
            color: "#1a1a1a",
            letterSpacing: "-0.5px",
          }}
        >
          Fare Play
        </h1>
      </div>

      {/* Right: Menu Items */}
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        {/* Map Section */}
        <button
          onClick={handleMapClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            background: "#f5f5f5",
            border: "1.5px solid #e0e0e0",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "500",
            color: "#333",
            transition: "all 0.15s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#e8e8e8";
            e.currentTarget.style.borderColor = "#0088CE";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#f5f5f5";
            e.currentTarget.style.borderColor = "#e0e0e0";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0088CE" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          Map
        </button>

        {/* User Info */}
        <button
          onClick={handleProfileClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            background: "#f5f5f5",
            border: "1.5px solid #e0e0e0",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "500",
            color: "#333",
            transition: "all 0.15s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#e8e8e8";
            e.currentTarget.style.borderColor = "#F8B22D";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#f5f5f5";
            e.currentTarget.style.borderColor = "#e0e0e0";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F8B22D" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Profile
        </button>

        {/* Wallet Section */}
        <button
          onClick={handleWalletClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 20px",
            background: walletConnected
              ? "linear-gradient(135deg, #0088CE 0%, #006BA6 100%)"
              : "linear-gradient(135deg, #DA2128 0%, #E74C3C 100%)",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "600",
            color: "#fff",
            boxShadow: walletConnected
              ? "0 2px 8px rgba(0, 136, 206, 0.25)"
              : "0 2px 8px rgba(218, 33, 40, 0.25)",
            transition: "all 0.15s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = walletConnected
              ? "0 4px 12px rgba(0, 136, 206, 0.35)"
              : "0 4px 12px rgba(218, 33, 40, 0.35)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = walletConnected
              ? "0 2px 8px rgba(0, 136, 206, 0.25)"
              : "0 2px 8px rgba(218, 33, 40, 0.25)";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          {walletConnected ? "Wallet Connected" : "Connect Wallet"}
        </button>
      </div>
    </nav>
  );
};

export default TopNav;
