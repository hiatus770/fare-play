import { NextRequest, NextResponse } from 'next/server';
import { getMarketsToFreeze, freezeMarket } from '@/lib/supabase/queries';

// POST /api/betting/markets/freeze
// Freezes all markets that have reached their freeze time
// Called by cron job or manually
export async function POST(request: NextRequest) {
  try {
    // Get all markets that should be frozen
    const marketsToFreeze = await getMarketsToFreeze();

    if (marketsToFreeze.length === 0) {
      return NextResponse.json({
        success: true,
        frozenCount: 0,
        message: 'No markets to freeze',
      });
    }

    // Freeze each market
    const results = await Promise.allSettled(
      marketsToFreeze.map(async (market) => {
        await freezeMarket(market.id);
        return {
          marketId: market.id,
          route: market.route,
          stopTag: market.stop_tag,
          vehicleId: market.vehicle_id,
        };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    return NextResponse.json({
      success: true,
      frozenCount: successful.length,
      failedCount: failed.length,
      frozenMarkets: successful.map(r => (r as PromiseFulfilledResult<any>).value),
      errors: failed.map(r => (r as PromiseRejectedResult).reason?.message),
    });

  } catch (error: any) {
    console.error('Error freezing markets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to freeze markets' },
      { status: 500 }
    );
  }
}

// GET /api/betting/markets/freeze
// Returns markets that need to be frozen
export async function GET() {
  try {
    const marketsToFreeze = await getMarketsToFreeze();

    return NextResponse.json({
      count: marketsToFreeze.length,
      markets: marketsToFreeze.map(m => ({
        id: m.id,
        route: m.route,
        stopTag: m.stop_tag,
        vehicleId: m.vehicle_id,
        freezeTime: m.freeze_time,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching markets to freeze:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}
