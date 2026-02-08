import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { type Outcome } from '../../../../../lib/lmsr';

const VALID_OUTCOMES: Outcome[] = ['EARLY', 'ON_TIME', 'LATE'];

// POST /api/markets/[id]/resolve — resolve a market
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { outcome, error_seconds, source } = body;

  if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json(
      { error: 'outcome must be EARLY, ON_TIME, or LATE' },
      { status: 400 }
    );
  }

  const resolveSource = source === 'admin' ? 'admin' : 'auto';

  const { error: rpcError } = await supabaseAdmin.rpc('resolve_market', {
    p_market_id: id,
    p_outcome: outcome,
    p_error_seconds: error_seconds ?? null,
    p_source: resolveSource,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  return NextResponse.json({ resolved: true, market_id: id, outcome });
}
