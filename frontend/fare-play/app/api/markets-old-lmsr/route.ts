import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '../../../lib/supabase-admin';
import { calculatePrices, type LMSRState } from '../../../lib/lmsr';

// GET /api/markets — list open markets with computed LMSR prices
export async function GET(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning empty markets array');
      return NextResponse.json({ markets: [] });
    }

    const status = request.nextUrl.searchParams.get('status') || 'open';

    const { data: markets, error } = await supabaseAdmin
      .from('lmsr_markets')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('LMSR markets table not found, returning empty array:', error.message);
      // Return empty array if table doesn't exist yet
      return NextResponse.json({ markets: [] });
    }

    const marketsWithPrices = (markets ?? []).map((m) => {
      const state: LMSRState = {
        q_early: m.q_early,
        q_ontime: m.q_ontime,
        q_late: m.q_late,
        b: m.b,
      };
      const prices = calculatePrices(state);
      return { ...m, prices };
    });

    return NextResponse.json({ markets: marketsWithPrices });
  } catch (error: any) {
    console.error('Error fetching LMSR markets:', error);
    // Always return valid JSON
    return NextResponse.json({ markets: [], error: error.message });
  }
}

// POST /api/markets — create a new market
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { route_tag, stop_tag, vehicle_id, direction, predicted_eta_seconds } = body;

  if (!route_tag || !stop_tag || !vehicle_id || !predicted_eta_seconds) {
    return NextResponse.json(
      { error: 'route_tag, stop_tag, vehicle_id, and predicted_eta_seconds required' },
      { status: 400 }
    );
  }

  // Market closes when the vehicle is predicted to arrive
  const closesAt = new Date(Date.now() + predicted_eta_seconds * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('lmsr_markets')
    .insert({
      route_tag,
      stop_tag,
      vehicle_id,
      direction: direction || null,
      predicted_eta_seconds,
      closes_at: closesAt,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const state: LMSRState = {
    q_early: data.q_early,
    q_ontime: data.q_ontime,
    q_late: data.q_late,
    b: data.b,
  };

  return NextResponse.json({
    market: { ...data, prices: calculatePrices(state) },
  });
}
