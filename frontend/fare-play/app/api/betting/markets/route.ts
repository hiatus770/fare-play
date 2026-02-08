import { NextRequest, NextResponse } from 'next/server';
import { getActiveMarkets } from '@/lib/supabase/queries';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/betting/markets
// List markets by status
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'active';

    let markets;

    if (status === 'active') {
      // Get active markets with stats
      markets = await getActiveMarkets();
    } else {
      // Get markets by specific status
      const statusMap: Record<string, string> = {
        active: 'ACTIVE',
        frozen: 'FROZEN',
        resolved: 'RESOLVED',
        cancelled: 'CANCELLED',
      };

      const dbStatus = statusMap[status.toLowerCase()] || 'ACTIVE';

      const { data, error } = await supabaseAdmin
        .from('markets')
        .select(`
          *,
          bets:bets(count)
        `)
        .eq('status', dbStatus)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      markets = data || [];
    }

    return NextResponse.json({
      markets: markets.map(m => ({
        ...m,
        total_pool_lamports: m.total_pool_lamports?.toString(),
      })),
      count: markets.length,
    });

  } catch (error: any) {
    console.error('Error fetching markets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}
