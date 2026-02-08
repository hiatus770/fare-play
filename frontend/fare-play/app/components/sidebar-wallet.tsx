"use client";

import { useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { useVault } from "../../hooks/useVault";

export function SidebarWallet() {
  const {
    connectors,
    connect,
    disconnect,
    connected,
    isReady,
  } = useWalletConnection();

  const {
    walletAddress,
    vaultSol,
    vaultLamports,
    deposit,
    withdraw,
    isSending,
    txStatus,
    clearStatus,
  } = useVault();

  const [amount, setAmount] = useState("");
  const [showConnectors, setShowConnectors] = useState(false);

  // Not yet hydrated on client
  if (!isReady) {
    return (
      <div style={sectionStyle}>
        <div style={{ color: "#888", fontSize: "14px", textAlign: "center" as const }}>
          Loading wallet...
        </div>
      </div>
    );
  }

  // Disconnected state
  if (!connected) {
    return (
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "12px", color: "#fff" }}>
          Wallet
        </div>
        {!showConnectors ? (
          <button
            onClick={() => setShowConnectors(true)}
            style={primaryBtnStyle}
          >
            Connect Wallet
          </button>
        ) : (
          <div>
            <div style={{ fontSize: "14px", color: "#aaa", marginBottom: "8px" }}>
              Select a wallet:
            </div>
            {connectors.length === 0 ? (
              <div style={{ fontSize: "13px", color: "#888" }}>
                No wallets detected. Install Phantom or Solflare.
              </div>
            ) : (
              connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={async () => {
                    try {
                      await connect(connector.id);
                      setShowConnectors(false);
                    } catch (err) {
                      console.error("Connect failed:", err);
                    }
                  }}
                  style={{
                    ...connectorBtnStyle,
                    marginBottom: "6px",
                  }}
                >
                  {connector.name || connector.id}
                </button>
              ))
            )}
            <button
              onClick={() => setShowConnectors(false)}
              style={{
                ...connectorBtnStyle,
                color: "#888",
                borderColor: "transparent",
                marginTop: "4px",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // Connected state
  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : "";

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontWeight: 600, fontSize: "18px", color: "#fff" }}>
          Wallet
        </div>
        <button
          onClick={() => disconnect()}
          style={{
            background: "transparent",
            border: "1px solid #555",
            color: "#aaa",
            fontSize: "12px",
            padding: "4px 10px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Disconnect
        </button>
      </div>

      {/* Address */}
      <div style={{ fontSize: "13px", color: "#aaa", marginBottom: "12px", fontFamily: "monospace" }}>
        {truncatedAddress}
      </div>

      {/* Vault Balance */}
      <div style={{
        background: "#1a1a1a",
        borderRadius: "8px",
        padding: "12px",
        marginBottom: "12px",
        border: "1px solid #333",
      }}>
        <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
          Vault Balance
        </div>
        <div style={{ fontSize: "24px", fontWeight: 700, color: "#fff", marginTop: "4px" }}>
          {vaultSol.toFixed(4)}{" "}
          <span style={{ fontSize: "14px", fontWeight: 400, color: "#888" }}>SOL</span>
        </div>
      </div>

      {/* Deposit */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="SOL amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isSending}
          style={inputStyle}
        />
        <button
          onClick={async () => {
            await deposit(amount);
            setAmount("");
          }}
          disabled={
            isSending ||
            !amount ||
            parseFloat(amount) <= 0 ||
            vaultLamports > 0n
          }
          style={{
            ...primaryBtnStyle,
            padding: "10px 16px",
            fontSize: "14px",
            opacity:
              isSending || !amount || parseFloat(amount) <= 0 || vaultLamports > 0n
                ? 0.4
                : 1,
            cursor:
              isSending || !amount || parseFloat(amount) <= 0 || vaultLamports > 0n
                ? "not-allowed"
                : "pointer",
          }}
        >
          {isSending ? "..." : "Deposit"}
        </button>
      </div>

      {vaultLamports > 0n && (
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
          Withdraw first before depositing again.
        </div>
      )}

      {/* Withdraw */}
      <button
        onClick={withdraw}
        disabled={isSending || vaultLamports === 0n}
        style={{
          ...secondaryBtnStyle,
          opacity: isSending || vaultLamports === 0n ? 0.4 : 1,
          cursor: isSending || vaultLamports === 0n ? "not-allowed" : "pointer",
        }}
      >
        {isSending ? "Confirming..." : "Withdraw All"}
      </button>

      {/* Status */}
      {txStatus && (
        <div
          style={{
            marginTop: "10px",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #333",
            background: "#1a1a1a",
            fontSize: "13px",
            color: txStatus.startsWith("Error") ? "#ff6b6b" : "#8f8",
            cursor: "pointer",
          }}
          onClick={clearStatus}
          title="Click to dismiss"
        >
          {txStatus}
        </div>
      )}
    </div>
  );
}

// --- Inline styles ---

const sectionStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "24px",
  background: "#232323",
  borderRadius: "8px",
  padding: "16px",
  color: "#fff",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "none",
  background: "#fff",
  color: "#000",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "transparent",
  color: "#fff",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
};

const connectorBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: "14px",
  cursor: "pointer",
  textAlign: "left" as const,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#1a1a1a",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
};
