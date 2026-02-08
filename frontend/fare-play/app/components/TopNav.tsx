"use client";
import React, { useState } from "react";
import { WalletConnectButton } from './WalletConnectButton';
import { VaultCard } from './vault-card';

const TopNav = () => {
  const [showVaultModal, setShowVaultModal] = useState(false);

  const handleMapClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProfileClick = () => {
    alert("Profile functionality coming soon!");
  };

  const handleVaultClick = () => {
    setShowVaultModal(true);
  };

  return (
    <>
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

          {/* Vault Section */}
          <button
            onClick={handleVaultClick}
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
              e.currentTarget.style.borderColor = "#10b981";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#f5f5f5";
              e.currentTarget.style.borderColor = "#e0e0e0";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Vault
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

          {/* Wallet Connection */}
          <WalletConnectButton
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition font-medium shadow-lg"
          />
        </div>
      </nav>

      {/* Vault Modal */}
      {showVaultModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowVaultModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>Your Vault</h2>
              <button
                onClick={() => setShowVaultModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#999",
                }}
              >
                ×
              </button>
            </div>
            <VaultCard />
          </div>
        </div>
      )}
    </>
  );
};

export default TopNav;