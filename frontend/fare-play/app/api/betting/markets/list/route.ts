import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '../../../../../lib/supabase-admin';

// GET /api/betting/markets/list?status=FROZEN
// List markets by status (used by resolution worker)
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ markets: [] });
    }

    const status = request.nextUrl.searchParams.get('status');

    if (!status) {
      return NextResponse.json(
        { error: 'status parameter required' },
        { status: 400 }
      );
    }

    const { data: markets, error } = await supabaseAdmin
      .from('markets')
      .select('*')
      .eq('status', status)
      .order('freeze_time', { ascending: true });

    if (error) {
      console.error('Error fetching markets by status:', error);
      return NextResponse.json({ markets: [], error: error.message });
    }

    return NextResponse.json({ markets: markets || [] });
  } catch (error: any) {
    console.error('Error in markets list:', error);
    return NextResponse.json(
      { markets: [], error: error.message },
      { status: 500 }
    );
  }
}
