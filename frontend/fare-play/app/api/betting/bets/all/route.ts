import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-admin';

// GET /api/betting/bets/all
// Get all bets from all users (for debugging/display)
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ bets: [] });
    }

    // Get all bets (same query as getBetsForMarket but without filter)
    const { data: bets, error } = await supabaseAdmin
      .from('bets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    console.log('📊 Query result:', {
      error: error?.message,
      betCount: bets?.length,
      firstBet: bets?.[0]
    });

    if (error) {
      console.error('❌ Error fetching all bets:', error);
      return NextResponse.json({ bets: [], error: error.message }, { status: 500 });
    }

    console.log(`✅ Successfully fetched ${bets?.length || 0} bets from database`);

    return NextResponse.json({
      bets: bets || [],
      total: bets?.length || 0
    });

  } catch (error: any) {
    console.error('Error fetching all bets:', error);
    return NextResponse.json(
      { bets: [], error: error.message },
      { status: 500 }
    );
  }
}
