import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import {
  calculatePrices,
  calculateSharesForCost,
  calculateBuyCost,
  type LMSRState,
  type Outcome,
} from '../../../../../lib/lmsr';

const VALID_OUTCOMES: Outcome[] = ['EARLY', 'ON_TIME', 'LATE'];

// POST /api/markets/[id]/buy — buy shares in a market
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { wallet_address, outcome, amount_lamports } = body;

  if (!wallet_address || !outcome || !amount_lamports) {
    return NextResponse.json(
      { error: 'wallet_address, outcome, and amount_lamports required' },
      { status: 400 }
    );
  }

  if (!VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json(
      { error: 'outcome must be EARLY, ON_TIME, or LATE' },
      { status: 400 }
    );
  }

  if (amount_lamports <= 0) {
    return NextResponse.json({ error: 'amount must be positive' }, { status: 400 });
  }

  // Fetch current market state
  const { data: market, error: marketError } = await supabaseAdmin
    .from('lmsr_markets')
    .select('*')
    .eq('id', id)
    .single();

  if (marketError || !market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  if (market.status !== 'open') {
    return NextResponse.json({ error: 'Market is not open' }, { status: 400 });
  }

  // Check if market has closed (past ETA)
  if (new Date(market.closes_at) < new Date()) {
    return NextResponse.json({ error: 'Market has closed' }, { status: 400 });
  }

  const state: LMSRState = {
    q_early: market.q_early,
    q_ontime: market.q_ontime,
    q_late: market.q_late,
    b: market.b,
  };

  // Calculate shares for the given cost
  const shares = calculateSharesForCost(state, outcome as Outcome, amount_lamports);
  if (shares <= 0) {
    return NextResponse.json({ error: 'Amount too small' }, { status: 400 });
  }

  // Verify exact cost
  const exactCost = Math.ceil(calculateBuyCost(state, outcome as Outcome, shares));

  // Call atomic buy_shares RPC
  const { data: tradeId, error: rpcError } = await supabaseAdmin.rpc('buy_shares', {
    p_market_id: id,
    p_wallet: wallet_address,
    p_outcome: outcome,
    p_shares: shares,
    p_cost_lamports: exactCost,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  // Fetch updated market for new prices
  const { data: updated } = await supabaseAdmin
    .from('lmsr_markets')
    .select('q_early, q_ontime, q_late, b')
    .eq('id', id)
    .single();

  const newPrices = updated
    ? calculatePrices({
        q_early: updated.q_early,
        q_ontime: updated.q_ontime,
        q_late: updated.q_late,
        b: updated.b,
      })
    : null;

  return NextResponse.json({
    trade_id: tradeId,
    shares,
    cost_lamports: exactCost,
    outcome,
    new_prices: newPrices,
  });
}
