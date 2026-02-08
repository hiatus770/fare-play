import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-admin';

const TTC_BACKEND_URL = process.env.TTC_BACKEND_URL || 'http://localhost:5000';

// POST /api/betting/markets/auto-resolve
// Automatically resolve a market by fetching TTC data and distributing payouts
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

    // Get market
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

    if (market.status !== 'FROZEN') {
      return NextResponse.json(
        { error: `Market must be FROZEN (current: ${market.status})` },
        { status: 400 }
      );
    }

    // Check TTC backend for actual arrival
    console.log(`🔍 Checking TTC for actual arrival: route=${market.route}, stop=${market.stop_tag}, vehicle=${market.vehicle_id}`);

    const ttcUrl = `${TTC_BACKEND_URL}/compare/${market.route}/${market.stop_tag}/${market.vehicle_id}`;
    const ttcResp = await fetch(ttcUrl, { cache: 'no-store' });

    if (!ttcResp.ok) {
      return NextResponse.json(
        { error: 'TTC data not available yet', marketId, status: market.status },
        { status: 404 }
      );
    }

    const ttcData = await ttcResp.json();

    // Check if we have verified arrival data
    if (!ttcData.frozen_prediction?.actual_arrival) {
      return NextResponse.json(
        { error: 'Actual arrival not recorded yet', marketId },
        { status: 404 }
      );
    }

    const actualArrivalSeconds = ttcData.frozen_prediction.actual_arrival;
    console.log(`✅ TTC confirmed arrival: ${actualArrivalSeconds}s (error: ${ttcData.error_seconds}s)`);

    // Call resolve endpoint to distribute payouts
    const resolveUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/betting/markets/resolve`;
    const resolveResp = await fetch(resolveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId,
        actualArrivalSeconds,
      }),
    });

    if (!resolveResp.ok) {
      const error = await resolveResp.json();
      throw new Error(`Resolution failed: ${error.error}`);
    }

    const resolveData = await resolveResp.json();

    console.log(`🎉 Market ${marketId} resolved:`, {
      winners: resolveData.summary?.winnerCount,
      totalPayout: resolveData.summary?.totalPayout,
    });

    // TODO: Admin needs to sign and send the distribution transaction
    // For now, we return the instruction for manual execution

    return NextResponse.json({
      success: true,
      marketId,
      actualArrivalSeconds,
      ttcError: ttcData.error_seconds,
      resolution: resolveData,
      note: 'Admin must sign and send the distribution transaction',
    });

  } catch (error: any) {
    console.error('❌ Auto-resolve failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-resolve market' },
      { status: 500 }
    );
  }
}
