import { NextRequest, NextResponse } from 'next/server';
import { getMarketById, getBetsForMarket } from '@/lib/supabase/queries';

// GET /api/betting/markets/[id]
// Get market details with all bets and statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const marketId = id;

    if (!marketId) {
      return NextResponse.json(
        { error: 'Market ID is required' },
        { status: 400 }
      );
    }

    // Get market
    const market = await getMarketById(marketId);

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    // Get all bets for this market
    const bets = await getBetsForMarket(marketId);

    // Calculate statistics
    const totalBets = bets.length;
    const totalPool = bets.reduce((sum, bet) => sum + BigInt(bet.amount_lamports), BigInt(0));

    const predictions = bets.map(b => b.predicted_arrival_seconds);
    const minPrediction = predictions.length > 0 ? Math.min(...predictions) : null;
    const maxPrediction = predictions.length > 0 ? Math.max(...predictions) : null;
    const avgPrediction = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p, 0) / predictions.length
      : null;

    // Calculate prediction distribution (histogram)
    const predictionDistribution = predictions.reduce((acc, pred) => {
      // Round to nearest 10 seconds for grouping
      const bucket = Math.floor(pred / 10) * 10;
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Calculate time until freeze
    const now = new Date();
    const freezeTime = new Date(market.freeze_time);
    const secondsUntilFreeze = Math.max(0, Math.floor((freezeTime.getTime() - now.getTime()) / 1000));

    return NextResponse.json({
      market,
      bets: bets.map(bet => ({
        ...bet,
        // Don't reveal other users' wallet addresses for privacy
        wallet_address: bet.wallet_address.slice(0, 4) + '...' + bet.wallet_address.slice(-4),
      })),
      stats: {
        totalBets,
        totalPool: totalPool.toString(),
        minPrediction,
        maxPrediction,
        avgPrediction,
        predictionDistribution,
        secondsUntilFreeze,
        isFrozen: market.status !== 'ACTIVE',
        isResolved: market.status === 'RESOLVED',
        isCancelled: market.status === 'CANCELLED',
      },
    });

  } catch (error: any) {
    console.error('Error fetching market:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch market' },
      { status: 500 }
    );
  }
}
