"use client";
import Map from "./components/Map";
import BusPredictionMarket from './components/bus-prediction-market';
import { VaultCard } from './components/vault-card';
import SolanaConnectionTest from "./components/solana-connection-test";
import AuthStatus from './components/auth-status';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-8">
            <AuthStatus />
            <SolanaConnectionTest />
            <Map></Map>
            <VaultCard />
          </div>
          <div className="lg:col-span-2">
            <BusPredictionMarket />
          </div>
        </div>
      </div>
    </main>
  );
}