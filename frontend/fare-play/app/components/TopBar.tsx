"use client";
import React, { useState } from "react";

interface TopBarProps {
  onAboutClick?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onAboutClick }) => {
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  const handleConnectWallet = () => {
    // TODO: Integrate with @solana/wallet-adapter-react
    console.log("Connecting Solana wallet...");
    // Simulate connection for now
    setWalletConnected(true);
    setWalletAddress("jEqW...4p6U");
  };

  const handleDisconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress(null);
    setShowWalletMenu(false);
  };

  return (
    <>
      {/* Top Bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "60px",
          background: "linear-gradient(90deg, #1a1a1a 0%, #2d2d2d 100%)",
          borderBottom: "1px solid #333",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          boxSizing: "border-box",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {/* Left: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#fff",
            }}
          >
            🎰
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: "16px", fontWeight: "700", margin: "0" }}>
              FarePlay
            </div>
            <div style={{ color: "#4ECDC4", fontSize: "10px", fontWeight: "600", margin: "0" }}>
              TTC Prediction Game
            </div>
          </div>
        </div>

        {/* Middle: Stats (if wallet connected) */}
        {walletConnected && (
          <div style={{ display: "flex", gap: "24px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#aaa", fontSize: "10px", fontWeight: "600" }}>
                BALANCE
              </div>
              <div style={{ color: "#4ECDC4", fontSize: "14px", fontWeight: "700" }}>
                2.5 SOL
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#aaa", fontSize: "10px", fontWeight: "600" }}>
                ACTIVE BETS
              </div>
              <div style={{ color: "#FF6B6B", fontSize: "14px", fontWeight: "700" }}>
                3
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#aaa", fontSize: "10px", fontWeight: "600" }}>
                WINRATE
              </div>
              <div style={{ color: "#fff", fontSize: "14px", fontWeight: "700" }}>
                62%
              </div>
            </div>
          </div>
        )}

        {/* Right: About & Wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* About Button */}
          <button
            onClick={() => setShowAbout(true)}
            style={{
              padding: "8px 12px",
              background: "transparent",
              border: "1px solid #333",
              borderRadius: "6px",
              color: "#aaa",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#4ECDC4";
              e.currentTarget.style.color = "#4ECDC4";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#333";
              e.currentTarget.style.color = "#aaa";
            }}
          >
            ℹ️ About
          </button>

          {/* Wallet Button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() =>
                walletConnected
                  ? setShowWalletMenu(!showWalletMenu)
                  : handleConnectWallet()
              }
              style={{
                padding: "8px 12px",
                background: walletConnected
                  ? "rgba(79, 204, 196, 0.15)"
                  : "transparent",
                border: walletConnected
                  ? "1px solid #4ECDC4"
                  : "1px solid #333",
                borderRadius: "6px",
                color: walletConnected ? "#4ECDC4" : "#aaa",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                if (!walletConnected) {
                  e.currentTarget.style.borderColor = "#4ECDC4";
                  e.currentTarget.style.color = "#4ECDC4";
                }
              }}
              onMouseOut={(e) => {
                if (!walletConnected) {
                  e.currentTarget.style.borderColor = "#333";
                  e.currentTarget.style.color = "#aaa";
                }
              }}
            >
              {walletConnected ? `💳 ${walletAddress}` : "🔗 Connect Wallet"}
            </button>

            {/* Wallet Menu */}
            {showWalletMenu && walletConnected && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "8px",
                  background: "#232323",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  overflow: "hidden",
                  minWidth: "200px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  zIndex: 101,
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderBottom: "1px solid #333",
                  }}
                >
                  <div style={{ color: "#aaa", fontSize: "10px", fontWeight: "600", marginBottom: "4px" }}>
                    WALLET
                  </div>
                  <div
                    style={{
                      color: "#4ECDC4",
                      fontSize: "12px",
                      fontWeight: "600",
                      wordBreak: "break-all",
                    }}
                  >
                    {walletAddress}
                  </div>
                </div>

                <div style={{ padding: "8px 12px" }}>
                  <button
                    onClick={handleDisconnectWallet}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "#ff6b6b",
                      border: "none",
                      borderRadius: "4px",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* About Modal */}
      {showAbout && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setShowAbout(false)}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "500px",
              color: "#fff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: "24px",
                fontWeight: "700",
                marginBottom: "12px",
              }}
            >
              🎰 About FarePlay
            </div>

            <div style={{ color: "#aaa", fontSize: "14px", lineHeight: "1.6", marginBottom: "16px" }}>
              <p>
                FarePlay is a prediction game where you bet on Toronto Transit Commission (TTC) streetcar and
                subway arrival times.
              </p>

              <p>
                <strong style={{ color: "#4ECDC4" }}>How it works:</strong>
              </p>
              <ol>
                <li>Select a TTC route (streetcar or subway)</li>
                <li>Choose a stop to monitor</li>
                <li>
                  See what predictions were made 5 minutes ago
                </li>
                <li>Make your own prediction of actual arrival time</li>
                <li>Place a bet in SOL tokens</li>
                <li>Win rewards when your prediction is closest!</li>
              </ol>

              <p>
                <strong style={{ color: "#4ECDC4" }}>Technology:</strong>
              </p>
              <ul>
                <li>Built on Solana blockchain</li>
                <li>Real-time TTC API integration</li>
                <li>Historical prediction tracking</li>
                <li>Smart contracts for transparent betting</li>
              </ul>
            </div>

            <button
              onClick={() => setShowAbout(false)}
              style={{
                width: "100%",
                padding: "12px",
                background: "#4ECDC4",
                color: "#000",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
