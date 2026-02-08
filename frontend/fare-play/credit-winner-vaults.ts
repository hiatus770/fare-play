#!/usr/bin/env tsx
/**
 * Credit winners' vault balances after market resolution
 * Run: tsx credit-winner-vaults.ts <marketId>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function creditWinners(marketId: string) {
  console.log(`\n💰 Crediting winners for market: ${marketId}`);
  console.log('='.repeat(60));

  // Get all winning bets
  const { data: bets, error: betsError } = await supabase
    .from('bets')
    .select('wallet_address, payout_lamports')
    .eq('market_id', marketId)
    .gt('payout_lamports', 0);

  if (betsError) {
    console.error('❌ Error fetching bets:', betsError);
    return;
  }

  if (!bets || bets.length === 0) {
    console.log('ℹ️  No winners found for this market');
    return;
  }

  console.log(`\n📊 Found ${bets.length} winner(s):\n`);

  // Credit each winner
  for (const bet of bets) {
    const { wallet_address, payout_lamports } = bet;
    const payoutSol = Number(payout_lamports) / 1e9;

    console.log(`   Wallet: ${wallet_address}`);
    console.log(`   Payout: ${payoutSol} SOL (${payout_lamports} lamports)`);

    // Upsert balance
    const { error: balanceError } = await supabase.rpc('increment_balance', {
      p_wallet: wallet_address,
      p_amount: payout_lamports,
    });

    if (balanceError) {
      // If RPC doesn't exist, use manual upsert
      const { data: currentBalance } = await supabase
        .from('balances')
        .select('balance_lamports')
        .eq('wallet', wallet_address)
        .single();

      const newBalance = (currentBalance?.balance_lamports || 0) + payout_lamports;

      const { error: upsertError } = await supabase
        .from('balances')
        .upsert({
          wallet: wallet_address,
          balance_lamports: newBalance,
          updated_at: new Date().toISOString(),
        });

      if (upsertError) {
        console.log(`   ❌ Failed to credit: ${upsertError.message}`);
      } else {
        console.log(`   ✅ Credited! New balance: ${newBalance / 1e9} SOL`);
      }
    } else {
      console.log(`   ✅ Credited!`);
    }
    console.log();
  }

  console.log('✅ Done crediting winners!');
}

// Get market ID from command line
const marketId = process.argv[2] || '71f6ce4d-6f81-40c8-a262-e1a2e32d1d50';

creditWinners(marketId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });
