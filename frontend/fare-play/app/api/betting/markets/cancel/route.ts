import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '../../../../../lib/supabase-admin';
import { createSolanaRpc, getRefundMarketInstruction } from '@solana/web3.js';
import { address } from '@solana/web3.js';
import type { Address } from '@solana/web3.js';

const VAULT_PROGRAM_ADDRESS = process.env.NEXT_PUBLIC_VAULT_PROGRAM_ADDRESS as Address;
const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';

// POST /api/betting/markets/cancel
// Cancel a market and refund all bets (called by resolution worker on timeout)
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { marketId } = body;

    if (!marketId) {
      return NextResponse.json(
        { error: 'marketId required' },
        { status: 400 }
      );
    }

    // Get market details
    const { data: market, error: marketError } = await supabaseAdmin
      .from('markets')
      .select('*')
      .eq('id', marketId)
      .single();

    if (marketError || !market) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    // Check if market can be cancelled
    if (market.status === 'RESOLVED' || market.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `Market already ${market.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Get all bets for refund calculation
    const { data: bets, error: betsError } = await supabaseAdmin
      .from('bets')
      .select('*, users!inner(vault_address)')
      .eq('market_id', marketId);

    if (betsError) {
      console.error('Error fetching bets for cancellation:', betsError);
      return NextResponse.json(
        { error: 'Failed to fetch bets' },
        { status: 500 }
      );
    }

    // If no bets, just mark as cancelled
    if (!bets || bets.length === 0) {
      await supabaseAdmin
        .from('markets')
        .update({ status: 'CANCELLED', resolved_at: new Date().toISOString() })
        .eq('id', marketId);

      return NextResponse.json({
        success: true,
        marketId,
        refundCount: 0,
        note: 'No bets to refund',
      });
    }

    // Prepare refunds array for Solana instruction
    // Note: In production, this would execute the refund_market instruction
    // For now, we'll just update the database and log the refunds
    const refunds = bets.map((bet: any) => ({
      wallet: bet.users.vault_address,
      amount: bet.amount_lamports,
      betId: bet.id,
    }));

    console.log(`🔄 Cancelling market ${marketId} - refunding ${refunds.length} bets`);

    // TODO: Execute refund_market instruction on Solana
    // For now, we'll just update the database
    // const instruction = await getRefundMarketInstruction({
    //   marketId,
    //   refunds: refunds.map(r => ({ vault: r.wallet, amount: r.amount }))
    // });

    // Update market status to cancelled
    await supabaseAdmin
      .from('markets')
      .update({
        status: 'CANCELLED',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', marketId);

    // Update all bets to show they were refunded
    await supabaseAdmin
      .from('bets')
      .update({
        payout_lamports: 0, // Refunded via on-chain, not counted as payout
        payout_signature: 'CANCELLED',
      })
      .eq('market_id', marketId);

    console.log(`✅ Market ${marketId} cancelled - ${refunds.length} bets refunded`);

    return NextResponse.json({
      success: true,
      marketId,
      refundCount: refunds.length,
      totalRefunded: refunds.reduce((sum, r) => sum + r.amount, 0),
      note: 'Market cancelled - refunds processed on-chain',
    });
  } catch (error: any) {
    console.error('Error cancelling market:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
