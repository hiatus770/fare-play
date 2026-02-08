import { NextRequest, NextResponse } from 'next/server';
import { getUserByWallet, getBetsForUser } from '@/lib/supabase/queries';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/betting/bets/user/[wallet]
// Get all bets for a specific user wallet address
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const walletAddress = wallet;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await getUserByWallet(walletAddress);

    if (!user) {
      return NextResponse.json({
        user: null,
        activeBets: [],
        pendingResolutions: [],
        history: [],
      });
    }

    // Get all bets with market details
    const { data: bets, error } = await supabaseAdmin
      .from('bets')
      .select(`
        *,
        market:markets (
          id,
          route,
          stop_tag,
          vehicle_id,
          freeze_time,
          predicted_arrival_seconds,
          actual_arrival_seconds,
          status,
          total_pool_lamports,
          bet_count,
          resolved_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Categorize bets
    const activeBets = (bets || []).filter(b => b.market.status === 'ACTIVE');
    const pendingResolutions = (bets || []).filter(b => b.market.status === 'FROZEN');
    const history = (bets || []).filter(b => b.market.status === 'RESOLVED' || b.market.status === 'CANCELLED');

    return NextResponse.json({
      user,
      activeBets,
      pendingResolutions,
      history,
    });

  } catch (error: any) {
    console.error('Error fetching user bets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user bets' },
      { status: 500 }
    );
  }
}
