#!/usr/bin/env node

/**
 * FarePlay Market Resolution Worker
 *
 * Runs continuously to:
 * 1. Freeze markets when betting closes (5 min before predicted arrival)
 * 2. Resolve frozen markets when TTC has actual arrival data
 * 3. Distribute payouts proportionally based on accuracy
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TTC_BASE = process.env.TTC_BACKEND_URL || 'http://localhost:5000';
const CHECK_INTERVAL = 30000; // 30 seconds

console.log('🚀 FarePlay Market Resolution Worker starting...');
console.log(`   API: ${API_BASE}`);
console.log(`   TTC: ${TTC_BASE}`);
console.log(`   Check interval: ${CHECK_INTERVAL}ms`);
console.log('');

let cycleCount = 0;

/**
 * Main worker cycle
 */
async function runCycle() {
  cycleCount++;
  const timestamp = new Date().toISOString();

  console.log(`\n[$${timestamp}] 🔄 Cycle #${cycleCount}`);
  console.log('━'.repeat(60));

  try {
    // Step 1: Freeze markets that are ready to close
    await freezeMarkets();

    // Step 2: Resolve frozen markets with TTC data
    await resolveMarkets();

  } catch (error) {
    console.error('❌ Cycle error:', error.message);
  }
}

/**
 * Freeze markets where betting should close
 */
async function freezeMarkets() {
  console.log('\n🧊 Checking for markets to freeze...');

  try {
    const response = await fetch(`${API_BASE}/api/betting/markets/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Freeze API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.frozenMarkets && data.frozenMarkets.length > 0) {
      console.log(`   ✅ Froze ${data.frozenMarkets.length} market(s):`);
      data.frozenMarkets.forEach(m => {
        console.log(`      - ${m.route}/${m.stop_tag}/${m.vehicle_id}`);
      });
    } else {
      console.log('   ℹ️  No markets ready to freeze');
    }

  } catch (error) {
    console.error('   ❌ Freeze error:', error.message);
  }
}

/**
 * Resolve frozen markets that have TTC actual arrival data
 */
async function resolveMarkets() {
  console.log('\n🎯 Checking frozen markets for resolution...');

  try {
    // Get all frozen markets
    const marketsResp = await fetch(`${API_BASE}/api/betting/markets?status=FROZEN`);

    if (!marketsResp.ok) {
      throw new Error(`Markets API returned ${marketsResp.status}`);
    }

    const marketsData = await marketsResp.json();
    const frozenMarkets = marketsData.markets || [];

    if (frozenMarkets.length === 0) {
      console.log('   ℹ️  No frozen markets waiting for resolution');
      return;
    }

    console.log(`   📋 Found ${frozenMarkets.length} frozen market(s)`);

    // Check each market for TTC data
    for (const market of frozenMarkets) {
      await checkAndResolveMarket(market);
    }

  } catch (error) {
    console.error('   ❌ Resolution check error:', error.message);
  }
}

/**
 * Check if TTC has actual arrival data and resolve if available
 */
async function checkAndResolveMarket(market) {
  const { id, route, stop_tag, vehicle_id, market_id_string } = market;

  console.log(`\n   🔍 Checking: ${route}/${stop_tag}/${vehicle_id}`);

  try {
    // Parse market_id_string to get the original data
    // Format: "route-stopTag-vehicleId-timestamp"
    const parts = market_id_string?.split('-') || [];
    const marketRoute = parts[0] || route;
    const marketStop = parts[1] || stop_tag;
    const marketVehicle = parts[2] || vehicle_id;

    // Check TTC backend for actual arrival
    const ttcUrl = `${TTC_BASE}/compare/${marketRoute}/${marketStop}/${marketVehicle}`;
    console.log(`      TTC: ${ttcUrl}`);

    const ttcResp = await fetch(ttcUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!ttcResp.ok) {
      console.log(`      ⏳ TTC data not available yet (${ttcResp.status})`);
      return;
    }

    const ttcData = await ttcResp.json();

    // Check if actual arrival is recorded
    if (!ttcData.frozen_prediction?.actual_arrival) {
      console.log(`      ⏳ Waiting for actual arrival (prediction frozen but bus hasn't arrived)`);
      return;
    }

    const actualArrival = ttcData.frozen_prediction.actual_arrival;
    console.log(`      ✅ TTC has actual arrival: ${actualArrival}s`);

    // Resolve the market
    console.log(`      🎲 Resolving market ${id}...`);

    const resolveResp = await fetch(`${API_BASE}/api/betting/markets/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId: id,
        actualArrivalSeconds: actualArrival
      })
    });

    if (!resolveResp.ok) {
      const error = await resolveResp.json();
      throw new Error(error.error || 'Resolution failed');
    }

    const resolveData = await resolveResp.json();

    console.log(`      🎉 RESOLVED!`);
    console.log(`         Winners: ${resolveData.summary?.winnerCount || 0}`);
    console.log(`         Total payout: ${(resolveData.summary?.totalPayout || 0) / 1e9} SOL`);
    console.log(`         Signature: ${resolveData.signature?.slice(0, 8)}...`);

  } catch (error) {
    console.error(`      ❌ Error: ${error.message}`);

    // Check if market is too old (30+ minutes since freeze)
    const freezeTime = new Date(market.freeze_time);
    const minutesSinceFreeze = (Date.now() - freezeTime.getTime()) / 60000;

    if (minutesSinceFreeze > 30) {
      console.log(`      ⚠️  Market frozen for ${Math.floor(minutesSinceFreeze)}m - consider cancellation`);
      // TODO: Implement market cancellation with refunds
    }
  }
}

/**
 * Start the worker
 */
async function start() {
  // Run first cycle immediately
  await runCycle();

  // Then run every CHECK_INTERVAL
  setInterval(async () => {
    await runCycle();
  }, CHECK_INTERVAL);

  console.log(`\n✅ Worker running - checking every ${CHECK_INTERVAL / 1000}s`);
  console.log('   Press Ctrl+C to stop\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Worker stopping...');
  console.log(`   Completed ${cycleCount} cycles`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Worker stopping...');
  process.exit(0);
});

// Start the worker
start().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
