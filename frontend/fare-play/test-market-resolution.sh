#!/bin/bash

# FarePlay Market Resolution Testing Script

echo "🧪 FarePlay Market Resolution Test"
echo "=================================="
echo ""

# Step 1: Get the latest active/frozen market
echo "📋 Step 1: Fetching latest market..."
MARKET_ID=$(psql $DATABASE_URL -t -c "SELECT id FROM markets WHERE status IN ('ACTIVE', 'FROZEN') ORDER BY created_at DESC LIMIT 1;" | xargs)

if [ -z "$MARKET_ID" ]; then
  echo "❌ No active/frozen markets found!"
  echo "   Please place some bets first."
  exit 1
fi

echo "✅ Found market: $MARKET_ID"
echo ""

# Step 2: Get market details
echo "📊 Step 2: Market details..."
psql $DATABASE_URL -c "SELECT route, stop_tag, vehicle_id, status, total_pool_lamports/1000000000.0 as pool_sol, bet_count FROM markets WHERE id = '$MARKET_ID';"
echo ""

# Step 3: Freeze the market (if not already frozen)
echo "🧊 Step 3: Freezing market..."
curl -s -X POST http://localhost:3000/api/betting/markets/freeze | jq '.'
echo ""

# Step 4: Ask user to set actual arrival time
echo "⏱️  Step 4: Set actual arrival time"
echo "   For testing, enter the actual arrival time in seconds:"
read -p "   Actual arrival (e.g., 320): " ACTUAL_ARRIVAL

if [ -z "$ACTUAL_ARRIVAL" ]; then
  echo "❌ No arrival time provided!"
  exit 1
fi

# Step 5: Resolve the market
echo ""
echo "🎯 Step 5: Resolving market with actual arrival = ${ACTUAL_ARRIVAL}s..."
RESOLVE_RESULT=$(curl -s -X POST http://localhost:3000/api/betting/markets/auto-resolve \
  -H "Content-Type: application/json" \
  -d "{\"marketId\": \"$MARKET_ID\"}")

echo "$RESOLVE_RESULT" | jq '.'
echo ""

# Step 6: Show winners
echo "🏆 Step 6: Winners breakdown..."
echo "$RESOLVE_RESULT" | jq '.resolution.payouts[] | {prediction: .prediction, error: .error, accuracy: .accuracyScore, payout_sol: (.payout | tonumber / 1000000000)}'
echo ""

echo "✅ Test complete! Check the 🏆 Winners tab in the UI!"
echo ""
echo "Next steps:"
echo "1. Go to http://localhost:3000"
echo "2. Click the '🏆 Winners' tab"
echo "3. See your resolved market with payouts!"
