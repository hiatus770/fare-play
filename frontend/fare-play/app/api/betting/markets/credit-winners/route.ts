import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// POST /api/betting/markets/credit-winners
// Credits winners' vault balances after resolution
export async function POST(request: NextRequest) {
  try {
    const { marketId } = await request.json();

    if (!marketId) {
      return NextResponse.json({ error: 'marketId required' }, { status: 400 });
    }

    // Get all winning bets
    const { data: bets, error: betsError } = await supabaseAdmin
      .from('bets')
      .select('wallet_address, payout_lamports')
      .eq('market_id', marketId)
      .gt('payout_lamports', 0);

    if (betsError) throw betsError;

    if (!bets || bets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No winners to credit',
        credited: 0,
      });
    }

    const credited = [];

    // Credit each winner
    for (const bet of bets) {
      const { wallet_address, payout_lamports } = bet;

      // Get current balance
      const { data: currentBalance } = await supabaseAdmin
        .from('balances')
        .select('balance_lamports')
        .eq('wallet', wallet_address)
        .single();

      const newBalance = BigInt(currentBalance?.balance_lamports || 0) + BigInt(payout_lamports);

      // Upsert balance
      const { error: upsertError } = await supabaseAdmin
        .from('balances')
        .upsert({
          wallet: wallet_address,
          balance_lamports: newBalance.toString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'wallet'
        });

      if (upsertError) {
        console.error('Error crediting wallet:', wallet_address, upsertError);
        continue;
      }

      credited.push({
        wallet: wallet_address,
        payout: payout_lamports.toString(),
        newBalance: newBalance.toString(),
      });
    }

    return NextResponse.json({
      success: true,
      credited: credited.length,
      winners: credited,
    });

  } catch (error: any) {
    console.error('Error crediting winners:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to credit winners' },
      { status: 500 }
    );
  }
}
