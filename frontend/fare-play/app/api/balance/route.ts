import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '../../../lib/supabase-admin';

// GET /api/balance?wallet=<address>
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    if (!wallet) {
      return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
    }

    // Return zero balance if Supabase not configured
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        wallet,
        balance_lamports: 0,
        updated_at: null,
        note: 'Supabase not configured'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('balances')
      .select('balance_lamports, updated_at')
      .eq('wallet', wallet)
      .maybeSingle();

    if (error) {
      console.error('Balance query error:', error);
      return NextResponse.json({
        wallet,
        balance_lamports: 0,
        updated_at: null,
      });
    }

    return NextResponse.json({
      wallet,
      balance_lamports: data?.balance_lamports ?? 0,
      updated_at: data?.updated_at ?? null,
    });
  } catch (error: any) {
    console.error('Balance API error:', error);
    return NextResponse.json({ error: error.message, balance_lamports: 0 }, { status: 500 });
  }
}

// POST /api/balance — credit off-chain balance (deposit sync)
// Adds amount_lamports to existing balance (or creates row)
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { wallet_address, amount_lamports } = body;

    if (!wallet_address || amount_lamports === undefined) {
      return NextResponse.json(
        { error: 'wallet_address and amount_lamports required' },
        { status: 400 }
      );
    }

    if (amount_lamports <= 0) {
      return NextResponse.json({ error: 'amount must be positive' }, { status: 400 });
    }

  // Check if wallet exists
  const { data: existing } = await supabaseAdmin
    .from('balances')
    .select('balance_lamports')
    .eq('wallet', wallet_address)
    .maybeSingle();

  if (existing) {
    const newBalance = existing.balance_lamports + amount_lamports;
    const { error: updateError } = await supabaseAdmin
      .from('balances')
      .update({ balance_lamports: newBalance, updated_at: new Date().toISOString() })
      .eq('wallet', wallet_address);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ wallet: wallet_address, balance_lamports: newBalance });
  } else {
    const { error: insertError } = await supabaseAdmin
      .from('balances')
      .insert({ wallet: wallet_address, balance_lamports: amount_lamports });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ wallet: wallet_address, balance_lamports: amount_lamports });
  }
  } catch (error: any) {
    console.error('Balance POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/balance — zero out balance (withdraw sync)
export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { wallet_address } = body;

    if (!wallet_address) {
      return NextResponse.json({ error: 'wallet_address required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('balances')
      .update({ balance_lamports: 0, updated_at: new Date().toISOString() })
      .eq('wallet', wallet_address);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ wallet: wallet_address, balance_lamports: 0 });
  } catch (error: any) {
    console.error('Balance DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
