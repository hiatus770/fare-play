// Database types for FarePlay Prediction Market

export type MarketStatus = 'ACTIVE' | 'FROZEN' | 'RESOLVED' | 'CANCELLED';

export interface User {
  id: string;
  wallet_address: string;
  vault_address: string;
  total_bets_placed: number;
  total_markets_won: number;
  lifetime_wagered_lamports: bigint;
  lifetime_winnings_lamports: bigint;
  created_at: string;
  updated_at: string;
}

export interface Market {
  id: string;
  market_vault_address: string;
  route: string;
  stop_tag: string;
  vehicle_id: string;
  created_at: string;
  freeze_time: string;
  predicted_arrival_seconds: number;
  actual_arrival_seconds: number | null;
  status: MarketStatus;
  total_pool_lamports: bigint;
  bet_count: number;
  resolved_at: string | null;
  resolution_signature: string | null;
}

export interface Bet {
  id: string;
  market_id: string;
  user_id: string;
  wallet_address: string;
  predicted_arrival_seconds: number;
  amount_lamports: bigint;
  placement_signature: string;
  error_seconds: number | null;
  accuracy_score: number | null;
  payout_lamports: bigint;
  payout_signature: string | null;
  created_at: string;
}

export interface MarketResolution {
  id: string;
  market_id: string;
  actual_arrival_seconds: number;
  total_payout_lamports: bigint;
  winner_count: number;
  total_accuracy_score: number;
  resolved_at: string;
  resolution_signature: string;
}

export interface ActiveMarketWithStats extends Market {
  current_bet_count: number;
  current_pool_lamports: bigint;
  min_prediction: number | null;
  max_prediction: number | null;
  avg_prediction: number | null;
}

export interface UserLeaderboard {
  wallet_address: string;
  total_bets_placed: number;
  total_markets_won: number;
  lifetime_wagered_lamports: bigint;
  lifetime_winnings_lamports: bigint;
  win_percentage: number;
  roi_percentage: number;
}
