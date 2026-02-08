// Supabase query helper functions for FarePlay

import { createClient } from '@supabase/supabase-js';
import type { Market, Bet, User, ActiveMarketWithStats, UserLeaderboard } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// User queries
export async function getOrCreateUser(walletAddress: string, vaultAddress: string): Promise<User> {
  const { data, error } = await supabase.rpc('get_or_create_user', {
    p_wallet_address: walletAddress,
    p_vault_address: vaultAddress,
  });

  if (error) throw error;

  // Fetch the full user record
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data)
    .single();

  if (fetchError) throw fetchError;
  return user;
}

export async function getUserByWallet(walletAddress: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data;
}

export async function getUserStats(walletAddress: string) {
  const { data, error } = await supabase
    .from('user_leaderboard')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Market queries
export async function createMarket(params: {
  route: string;
  stopTag: string;
  vehicleId: string;
  marketVaultAddress: string;
  freezeTime: Date;
  predictedArrivalSeconds: number;
}): Promise<Market> {
  const { data, error } = await supabase
    .from('markets')
    .insert({
      route: params.route,
      stop_tag: params.stopTag,
      vehicle_id: params.vehicleId,
      market_vault_address: params.marketVaultAddress,
      freeze_time: params.freezeTime.toISOString(),
      predicted_arrival_seconds: params.predictedArrivalSeconds,
      status: 'ACTIVE',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMarketById(marketId: string): Promise<Market | null> {
  const { data, error } = await supabase
    .from('markets')
    .select('*')
    .eq('id', marketId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getActiveMarkets(): Promise<ActiveMarketWithStats[]> {
  const { data, error } = await supabase
    .from('active_markets_with_stats')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getMarketsForVehicle(
  route: string,
  stopTag: string,
  vehicleId: string
): Promise<Market[]> {
  const { data, error } = await supabase
    .from('markets')
    .select('*')
    .eq('route', route)
    .eq('stop_tag', stopTag)
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getMarketsToFreeze(): Promise<Market[]> {
  const { data, error } = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'ACTIVE')
    .lte('freeze_time', new Date().toISOString());

  if (error) throw error;
  return data || [];
}

export async function freezeMarket(marketId: string): Promise<void> {
  const { error } = await supabase
    .from('markets')
    .update({ status: 'FROZEN' })
    .eq('id', marketId);

  if (error) throw error;
}

export async function getFrozenMarketsAwaitingResolution(): Promise<Market[]> {
  const { data, error } = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'FROZEN')
    .is('actual_arrival_seconds', null)
    .order('freeze_time', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function resolveMarket(params: {
  marketId: string;
  actualArrivalSeconds: number;
  resolutionSignature: string;
}): Promise<void> {
  const { error } = await supabase
    .from('markets')
    .update({
      status: 'RESOLVED',
      actual_arrival_seconds: params.actualArrivalSeconds,
      resolved_at: new Date().toISOString(),
      resolution_signature: params.resolutionSignature,
    })
    .eq('id', params.marketId);

  if (error) throw error;
}

export async function cancelMarket(marketId: string): Promise<void> {
  const { error } = await supabase
    .from('markets')
    .update({ status: 'CANCELLED' })
    .eq('id', marketId);

  if (error) throw error;
}

// Bet queries
export async function createBet(params: {
  marketId: string;
  userId: string;
  walletAddress: string;
  predictedArrivalSeconds: number;
  amountLamports: bigint;
  placementSignature: string;
}): Promise<Bet> {
  const { data, error } = await supabase
    .from('bets')
    .insert({
      market_id: params.marketId,
      user_id: params.userId,
      wallet_address: params.walletAddress,
      predicted_arrival_seconds: params.predictedArrivalSeconds,
      amount_lamports: params.amountLamports.toString(),
      placement_signature: params.placementSignature,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBetsForMarket(marketId: string): Promise<Bet[]> {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('market_id', marketId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getBetsForUser(userId: string): Promise<Bet[]> {
  const { data, error } = await supabase
    .from('bets')
    .select(`
      *,
      markets:market_id (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateBetPayout(params: {
  betId: string;
  errorSeconds: number;
  accuracyScore: number;
  payoutLamports: bigint;
  payoutSignature: string;
}): Promise<void> {
  const { error } = await supabase
    .from('bets')
    .update({
      error_seconds: params.errorSeconds,
      accuracy_score: params.accuracyScore,
      payout_lamports: params.payoutLamports.toString(),
      payout_signature: params.payoutSignature,
    })
    .eq('id', params.betId);

  if (error) throw error;
}

// Market resolution queries
export async function createMarketResolution(params: {
  marketId: string;
  actualArrivalSeconds: number;
  totalPayoutLamports: bigint;
  winnerCount: number;
  totalAccuracyScore: number;
  resolutionSignature: string;
}) {
  const { data, error } = await supabase
    .from('market_resolutions')
    .insert({
      market_id: params.marketId,
      actual_arrival_seconds: params.actualArrivalSeconds,
      total_payout_lamports: params.totalPayoutLamports.toString(),
      winner_count: params.winnerCount,
      total_accuracy_score: params.totalAccuracyScore,
      resolution_signature: params.resolutionSignature,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Leaderboard queries
export async function getLeaderboard(limit: number = 100): Promise<UserLeaderboard[]> {
  const { data, error } = await supabase
    .from('user_leaderboard')
    .select('*')
    .order('lifetime_winnings_lamports', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
