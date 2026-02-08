import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-admin';

// GET /api/betting/markets/resolved
// Get all resolved markets with winner information
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ markets: [] });
    }

    // Get all resolved markets with bets
    const { data: markets, error } = await supabaseAdmin
      .from('markets')
      .select(`
        *,
        bets (
          id,
          wallet_address,
          predicted_arrival_seconds,
          amount_lamports,
          error_seconds,
          accuracy_score,
          payout_lamports,
          payout_signature
        ),
        market_resolutions (
          actual_arrival_seconds,
          total_payout_lamports,
          winner_count,
          total_accuracy_score,
          resolved_at
        )
      `)
      .eq('status', 'RESOLVED')
      .order('resolved_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching resolved markets:', error);
      return NextResponse.json({ markets: [], error: error.message });
    }

    // Process markets to add winner info
    const processedMarkets = (markets || []).map(market => {
      const bets = market.bets || [];
      const resolution = market.market_resolutions?.[0];

      // Sort bets by payout (highest first)
      const sortedBets = [...bets].sort((a, b) =>
        Number(b.payout_lamports) - Number(a.payout_lamports)
      );

      // Get top 3 winners
      const topWinners = sortedBets.slice(0, 3).filter(b => b.payout_lamports > 0);

      // Calculate some stats
      const totalWagered = bets.reduce((sum, b) => sum + Number(b.amount_lamports), 0);
      const totalPaidOut = bets.reduce((sum, b) => sum + Number(b.payout_lamports), 0);

      return {
        ...market,
        resolution,
        bets: sortedBets,
        topWinners,
        stats: {
          totalBets: bets.length,
          totalWagered,
          totalPaidOut,
          winnersCount: bets.filter(b => b.payout_lamports > 0).length,
        },
      };
    });

    return NextResponse.json({
      markets: processedMarkets,
      total: processedMarkets.length,
    });

  } catch (error: any) {
    console.error('Error fetching resolved markets:', error);
    return NextResponse.json(
      { markets: [], error: error.message },
      { status: 500 }
    );
  }
}
