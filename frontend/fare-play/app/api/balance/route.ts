import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

// GET /api/balance?wallet=<address>
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('balances')
    .select('balance_lamports, updated_at')
    .eq('wallet', wallet)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    wallet,
    balance_lamports: data?.balance_lamports ?? 0,
    updated_at: data?.updated_at ?? null,
  });
}

// POST /api/balance — credit off-chain balance (deposit sync)
// Adds amount_lamports to existing balance (or creates row)
export async function POST(request: NextRequest) {
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
}

// DELETE /api/balance — zero out balance (withdraw sync)
export async function DELETE(request: NextRequest) {
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
}
