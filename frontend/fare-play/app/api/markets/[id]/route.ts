import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { calculatePrices, type LMSRState } from '../../../../lib/lmsr';

// GET /api/markets/[id] — market details + prices + trades + volume
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: market, error } = await supabaseAdmin
    .from('lmsr_markets')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  const { data: trades } = await supabaseAdmin
    .from('market_trades')
    .select('*')
    .eq('market_id', id)
    .order('created_at', { ascending: false });

  const state: LMSRState = {
    q_early: market.q_early,
    q_ontime: market.q_ontime,
    q_late: market.q_late,
    b: market.b,
  };

  return NextResponse.json({
    market: {
      ...market,
      prices: calculatePrices(state),
    },
    trades: trades ?? [],
  });
}
