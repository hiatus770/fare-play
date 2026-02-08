import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-admin';
import { classifyOutcome } from '../../../../lib/lmsr';

const CANCEL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// GET /api/cron/resolve — auto-resolve expired markets using TTC data
export async function GET() {
  try {
    // Return early if Supabase not configured
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ processed: 0, results: [], note: 'Supabase not configured' });
    }

    // Fetch open markets past their closes_at time
    const { data: markets, error } = await supabaseAdmin
      .from('lmsr_markets')
      .select('*')
      .eq('status', 'open')
      .lt('closes_at', new Date().toISOString());

    if (error) {
      console.error('Error fetching markets for resolution:', error);
      return NextResponse.json({ processed: 0, results: [], error: error.message });
    }

  const results: Array<{ market_id: string; action: string; outcome?: string }> = [];

  for (const market of markets ?? []) {
    const ageMs = Date.now() - new Date(market.closes_at).getTime();

    // Cancel if too old (30 min past close)
    if (ageMs > CANCEL_TIMEOUT_MS) {
      await supabaseAdmin
        .from('lmsr_markets')
        .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
        .eq('id', market.id);
      results.push({ market_id: market.id, action: 'cancelled' });
      continue;
    }

    // Query TTC backend for verified arrival data
    try {
      const resp = await fetch(
        `http://localhost:5000/compare/${market.route_tag}/${market.stop_tag}/${market.vehicle_id}`,
        { cache: 'no-store' }
      );

      if (!resp.ok) {
        results.push({ market_id: market.id, action: 'retry_next_cycle' });
        continue;
      }

      const data = await resp.json();

      // Look for error_seconds in the comparison data
      if (data.error_seconds !== undefined && data.error_seconds !== null) {
        const errorSeconds = data.error_seconds;
        const outcome = classifyOutcome(errorSeconds);

        // Resolve via RPC
        const { error: rpcError } = await supabaseAdmin.rpc('resolve_market', {
          p_market_id: market.id,
          p_outcome: outcome,
          p_error_seconds: errorSeconds,
          p_source: 'auto',
        });

        if (rpcError) {
          results.push({ market_id: market.id, action: 'rpc_error' });
        } else {
          results.push({ market_id: market.id, action: 'resolved', outcome });
        }
      } else {
        // No arrival data yet
        results.push({ market_id: market.id, action: 'retry_next_cycle' });
      }
    } catch {
      results.push({ market_id: market.id, action: 'backend_unreachable' });
    }
  }

  return NextResponse.json({ processed: results.length, results });
  } catch (error: any) {
    console.error('Error in market resolution:', error);
    return NextResponse.json({ processed: 0, results: [], error: error.message }, { status: 500 });
  }
}
