#!/bin/bash

# Manually resolve all frozen markets with reasonable actual arrivals
# Usage: ./resolve-all-frozen.sh

echo "🔍 Finding frozen markets..."

# Get all frozen markets
MARKETS=$(curl -s "http://localhost:3000/api/betting/markets?status=FROZEN")

# Parse market IDs using Python
MARKET_IDS=$(echo "$MARKETS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
markets = data.get('markets', [])
for m in markets:
    print(m['id'], m.get('predicted_arrival_seconds', 300), m.get('route', '?'), m.get('vehicle_id', '?'))
")

if [ -z "$MARKET_IDS" ]; then
  echo "❌ No frozen markets found"
  exit 0
fi

echo "📊 Found frozen markets:"
echo "$MARKET_IDS"
echo ""

# Resolve each market
while IFS= read -r line; do
  MARKET_ID=$(echo "$line" | awk '{print $1}')
  PREDICTED=$(echo "$line" | awk '{print $2}')
  ROUTE=$(echo "$line" | awk '{print $3}')
  VEHICLE=$(echo "$line" | awk '{print $4}')

  # Generate a reasonable actual arrival (predicted ± random 0-40 seconds)
  VARIANCE=$((RANDOM % 80 - 40))
  ACTUAL=$((PREDICTED + VARIANCE))

  echo "🎯 Resolving market: $ROUTE vehicle $VEHICLE"
  echo "   Market ID: $MARKET_ID"
  echo "   Predicted: ${PREDICTED}s"
  echo "   Actual: ${ACTUAL}s (variance: ${VARIANCE}s)"

  # Resolve via API
  RESULT=$(curl -s -X POST "http://localhost:3000/api/betting/markets/resolve" \
    -H "Content-Type: application/json" \
    -d "{\"marketId\": \"$MARKET_ID\", \"actualArrivalSeconds\": $ACTUAL}")

  SUCCESS=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))")

  if [ "$SUCCESS" = "True" ]; then
    WINNERS=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('summary', {}).get('winnerCount', 0))")
    PAYOUT=$(echo "$RESULT" | python3 -c "import sys, json; print(float(json.load(sys.stdin).get('summary', {}).get('totalPayout', 0)) / 1e9)")
    echo "   ✅ RESOLVED! Winners: $WINNERS, Payout: ${PAYOUT} SOL"
  else
    echo "   ❌ Failed: $RESULT"
  fi
  echo ""

done <<< "$MARKET_IDS"

echo "✅ Done! Check the 🏆 Winners tab in your UI"
