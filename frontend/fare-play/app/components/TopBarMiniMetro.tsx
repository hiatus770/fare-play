"use client";
import React, { useState } from "react";

interface TopBarProps {
  onAboutClick?: () => void;
}

const COLORS = {
  white: "#ffffff",
  black: "#000000",
  lightGray: "#f5f5f5",
  mediumGray: "#e0e0e0",
  darkGray: "#333333",
  red: "#e4572e",
};

const TopBar: React.FC<TopBarProps> = ({ onAboutClick }) => {
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  const handleConnectWallet = () => {
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
          background: COLORS.white,
          borderBottom: `1px solid ${COLORS.mediumGray}`,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          boxSizing: "border-box",
        }}
      >
        {/* Left: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              fontSize: "28px",
              fontWeight: "900",
              color: COLORS.red,
              letterSpacing: "2px",
              fontFamily: "'Arial', sans-serif",
            }}
          >
            FAREPLAY
          </div>
        </div>

        {/* Middle: Stats (if wallet connected) */}
        {walletConnected && (
          <div style={{ display: "flex", gap: "32px" }}>
            <div style={{ textAlign: "center", borderRight: `1px solid ${COLORS.mediumGray}`, paddingRight: "32px" }}>
              <div style={{ color: COLORS.darkGray, fontSize: "10px", fontWeight: "700", textTransform: "uppercase" }}>
                Balance
              </div>
              <div style={{ color: COLORS.red, fontSize: "16px", fontWeight: "900" }}>
                2.5 SOL
              </div>
            </div>
            <div style={{ textAlign: "center", borderRight: `1px solid ${COLORS.mediumGray}`, paddingRight: "32px" }}>
              <div style={{ color: COLORS.darkGray, fontSize: "10px", fontWeight: "700", textTransform: "uppercase" }}>
                Active Bets
              </div>
              <div style={{ color: COLORS.darkGray, fontSize: "16px", fontWeight: "900" }}>
                3
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: COLORS.darkGray, fontSize: "10px", fontWeight: "700", textTransform: "uppercase" }}>
                Winrate
              </div>
              <div style={{ color: COLORS.darkGray, fontSize: "16px", fontWeight: "900" }}>
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
              padding: "8px 14px",
              background: COLORS.white,
              border: `1px solid ${COLORS.mediumGray}`,
              color: COLORS.darkGray,
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "700",
              textTransform: "uppercase",
              transition: "all 0.1s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = COLORS.red;
              e.currentTarget.style.color = COLORS.red;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = COLORS.mediumGray;
              e.currentTarget.style.color = COLORS.darkGray;
            }}
          >
            Info
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
                padding: "8px 14px",
                background: walletConnected ? COLORS.white : COLORS.red,
                border: walletConnected ? `1px solid ${COLORS.red}` : `1px solid ${COLORS.red}`,
                color: walletConnected ? COLORS.red : COLORS.white,
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "700",
                textTransform: "uppercase",
                transition: "all 0.1s",
              }}
              onMouseOver={(e) => {
                if (!walletConnected) return;
                e.currentTarget.style.background = COLORS.red;
                e.currentTarget.style.color = COLORS.white;
              }}
              onMouseOut={(e) => {
                if (!walletConnected) return;
                e.currentTarget.style.background = COLORS.white;
                e.currentTarget.style.color = COLORS.red;
              }}
            >
              {walletConnected ? `◎ ${walletAddress}` : "◎ CONNECT"}
            </button>

            {/* Wallet Menu */}
            {showWalletMenu && walletConnected && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "4px",
                  background: COLORS.white,
                  border: `1px solid ${COLORS.mediumGray}`,
                  overflow: "hidden",
                  minWidth: "200px",
                  zIndex: 101,
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderBottom: `1px solid ${COLORS.mediumGray}`,
                  }}
                >
                  <div style={{ color: COLORS.darkGray, fontSize: "10px", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>
                    Wallet
                  </div>
                  <div
                    style={{
                      color: COLORS.red,
                      fontSize: "12px",
                      fontWeight: "700",
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
                      background: COLORS.red,
                      border: `1px solid ${COLORS.red}`,
                      color: COLORS.white,
                      cursor: "pointer",
                      fontSize: "11px",
                      fontWeight: "700",
                      textTransform: "uppercase",
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
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          onClick={() => setShowAbout(false)}
        >
          <div
            style={{
              background: COLORS.white,
              border: `1px solid ${COLORS.mediumGray}`,
              padding: "32px",
              maxWidth: "500px",
              color: COLORS.darkGray,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: "24px",
                fontWeight: "900",
                marginBottom: "16px",
                textTransform: "uppercase",
                color: COLORS.red,
              }}
            >
              FarePlay
            </div>

            <div style={{ fontSize: "14px", lineHeight: "1.8", marginBottom: "16px" }}>
              <p>
                <strong>Predict TTC arrivals. Win SOL.</strong>
              </p>

              <p style={{ marginTop: "16px" }}>
                <strong style={{ color: COLORS.red, textTransform: "uppercase" }}>How it works:</strong>
              </p>
              <ol style={{ marginLeft: "16px" }}>
                <li>Select a TTC route (streetcar or subway)</li>
                <li>Choose a stop to monitor</li>
                <li>See community predictions & vehicle stats</li>
                <li>Make your own prediction of arrival time</li>
                <li>Place a bet in SOL tokens</li>
                <li>Win if your prediction is closest!</li>
              </ol>

              <p style={{ marginTop: "16px" }}>
                <strong style={{ color: COLORS.red }}>Tech:</strong>
              </p>
              <ul style={{ marginLeft: "16px" }}>
                <li>Solana blockchain</li>
                <li>Real-time TTC API</li>
                <li>Live vehicle tracking</li>
              </ul>
            </div>

            <button
              onClick={() => setShowAbout(false)}
              style={{
                width: "100%",
                padding: "12px",
                background: COLORS.red,
                border: `1px solid ${COLORS.red}`,
                color: COLORS.white,
                fontSize: "13px",
                fontWeight: "700",
                textTransform: "uppercase",
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
