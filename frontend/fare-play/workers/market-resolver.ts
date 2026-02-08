/**
 * Market Resolution Worker
 *
 * Background process that:
 * 1. Freezes markets 5 minutes before predicted arrival
 * 2. Checks TTC backend for verified arrivals
 * 3. Triggers automatic market resolution
 * 4. Cancels markets if bus never arrives (30+ min timeout)
 *
 * Run with: node workers/market-resolver.js
 * Or deploy as a cron job (Vercel Cron, AWS Lambda, etc.)
 */

const RESOLUTION_CHECK_INTERVAL = 30000; // 30 seconds
const FREEZE_CHECK_INTERVAL = 10000; // 10 seconds
const MARKET_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TTC_BACKEND_URL = process.env.TTC_BACKEND_URL || 'http://localhost:5000';

interface Market {
  id: string;
  route: string;
  stop_tag: string;
  vehicle_id: string;
  freeze_time: string;
  status: 'ACTIVE' | 'FROZEN' | 'RESOLVED' | 'CANCELLED';
  created_at: string;
}

/**
 * Freeze markets that have reached their freeze time
 */
async function freezeMarkets() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/betting/markets/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('Failed to freeze markets:', response.statusText);
      return;
    }

    const result = await response.json();
    if (result.frozenMarkets && result.frozenMarkets.length > 0) {
      console.log(`✅ Frozen ${result.frozenMarkets.length} markets:`, result.frozenMarkets);
    }
  } catch (error) {
    console.error('Error freezing markets:', error);
  }
}

/**
 * Check if TTC backend has verified arrival data for a market
 */
async function checkTTCArrival(market: Market): Promise<number | null> {
  try {
    const url = `${TTC_BACKEND_URL}/compare/${market.route}/${market.stop_tag}/${market.vehicle_id}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      console.log(`⏳ TTC data not ready for market ${market.id} (vehicle ${market.vehicle_id})`);
      return null;
    }

    const data = await response.json();

    // Check if we have verified arrival data
    if (data.error_seconds !== undefined && data.error_seconds !== null) {
      console.log(`✅ TTC verified arrival for market ${market.id}: error=${data.error_seconds}s`);
      return data.error_seconds;
    }

    // If we have frozen prediction but no actual arrival yet
    if (data.frozen_prediction && !data.frozen_prediction.actual_arrival) {
      console.log(`⏳ Waiting for actual arrival for market ${market.id}`);
      return null;
    }

    return null;
  } catch (error) {
    console.error(`❌ Error checking TTC backend for market ${market.id}:`, error);
    return null;
  }
}

/**
 * Resolve a market using verified TTC arrival data
 */
async function resolveMarket(marketId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/betting/markets/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Failed to resolve market ${marketId}:`, error);
      return;
    }

    const result = await response.json();
    console.log(`✅ Resolved market ${marketId}:`, {
      winners: result.winners?.length || 0,
      totalPayout: result.totalPayout,
      signature: result.signature,
    });
  } catch (error) {
    console.error(`❌ Error resolving market ${marketId}:`, error);
  }
}

/**
 * Cancel a market that has timed out (bus never arrived)
 */
async function cancelMarket(marketId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/betting/markets/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Failed to cancel market ${marketId}:`, error);
      return;
    }

    const result = await response.json();
    console.log(`🚫 Cancelled market ${marketId} (timeout):`, result);
  } catch (error) {
    console.error(`❌ Error cancelling market ${marketId}:`, error);
  }
}

/**
 * Get all frozen markets awaiting resolution
 */
async function getFrozenMarkets(): Promise<Market[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/betting/markets?status=FROZEN`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.markets || [];
  } catch (error) {
    console.error('Error fetching frozen markets:', error);
    return [];
  }
}

/**
 * Main resolution loop - checks frozen markets for arrivals
 */
async function processResolutions() {
  console.log('🔍 Checking for markets to resolve...');

  const markets = await getFrozenMarkets();

  if (markets.length === 0) {
    console.log('📭 No frozen markets awaiting resolution');
    return;
  }

  console.log(`📊 Found ${markets.length} frozen markets`);

  for (const market of markets) {
    const timeSinceFreeze = Date.now() - new Date(market.freeze_time).getTime();

    // Cancel if too much time has passed (30+ minutes)
    if (timeSinceFreeze > MARKET_TIMEOUT_MS) {
      console.log(`⏰ Market ${market.id} timed out (${Math.floor(timeSinceFreeze / 60000)} min)`);
      await cancelMarket(market.id);
      continue;
    }

    // Check TTC backend for verified arrival
    const errorSeconds = await checkTTCArrival(market);

    if (errorSeconds !== null) {
      // We have verified data - resolve the market
      await resolveMarket(market.id);
    } else {
      // No data yet - will check again next cycle
      console.log(`⏳ Market ${market.id} waiting for TTC data (${Math.floor(timeSinceFreeze / 1000)}s elapsed)`);
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 Market Resolution Worker started');
  console.log(`📍 API Base: ${API_BASE_URL}`);
  console.log(`📍 TTC Backend: ${TTC_BACKEND_URL}`);
  console.log(`⏱️  Freeze check: every ${FREEZE_CHECK_INTERVAL / 1000}s`);
  console.log(`⏱️  Resolution check: every ${RESOLUTION_CHECK_INTERVAL / 1000}s`);
  console.log('');

  // Check for markets to freeze every 10 seconds
  const freezeInterval = setInterval(async () => {
    await freezeMarkets();
  }, FREEZE_CHECK_INTERVAL);

  // Check for markets to resolve every 30 seconds
  const resolveInterval = setInterval(async () => {
    await processResolutions();
  }, RESOLUTION_CHECK_INTERVAL);

  // Run immediately on startup
  await freezeMarkets();
  await processResolutions();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    clearInterval(freezeInterval);
    clearInterval(resolveInterval);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    clearInterval(freezeInterval);
    clearInterval(resolveInterval);
    process.exit(0);
  });
}

// Run the worker
main().catch((error) => {
  console.error('❌ Fatal error in market resolver:', error);
  process.exit(1);
});

export { freezeMarkets, processResolutions, checkTTCArrival };
