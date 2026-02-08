#!/bin/bash

# Simple Market Resolution Test for FarePlay

echo "🧪 FarePlay Market Resolution Test"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Freeze any active markets
echo -e "${BLUE}🧊 Step 1: Freezing active markets...${NC}"
curl -s -X POST http://localhost:3000/api/betting/markets/freeze | jq '.'
echo ""

# Step 2: Ask for market ID
echo -e "${BLUE}📋 Step 2: Enter market details${NC}"
echo "   Find your market ID from the database or console logs when placing bets"
read -p "   Market ID: " MARKET_ID

if [ -z "$MARKET_ID" ]; then
  echo -e "${RED}❌ No market ID provided!${NC}"
  exit 1
fi

# Step 3: Ask for actual arrival time
echo ""
echo -e "${BLUE}⏱️  Step 3: Set actual arrival time${NC}"
echo "   This should be the 'actual' arrival time to compare against predictions"
echo "   Example: If bets were 300s, 320s, 340s - try actual = 320s"
read -p "   Actual arrival (seconds): " ACTUAL_ARRIVAL

if [ -z "$ACTUAL_ARRIVAL" ]; then
  echo -e "${RED}❌ No arrival time provided!${NC}"
  exit 1
fi

# Step 4: Update market to FROZEN if needed
echo ""
echo -e "${BLUE}🔒 Step 4: Ensuring market is FROZEN...${NC}"
curl -s -X POST http://localhost:3000/api/betting/markets/freeze
echo ""

# Step 5: Manually resolve (since auto-resolve expects TTC backend data)
echo ""
echo -e "${BLUE}🎯 Step 5: Resolving market...${NC}"
echo "   Market: $MARKET_ID"
echo "   Actual Arrival: ${ACTUAL_ARRIVAL}s"
echo ""

RESOLVE_RESULT=$(curl -s -X POST http://localhost:3000/api/betting/markets/resolve \
  -H "Content-Type: application/json" \
  -d "{
    \"marketId\": \"$MARKET_ID\",
    \"actualArrivalSeconds\": $ACTUAL_ARRIVAL
  }")

echo "$RESOLVE_RESULT" | jq '.'
echo ""

# Step 6: Show winners breakdown
echo -e "${GREEN}🏆 Step 6: Winners Breakdown${NC}"
echo "$RESOLVE_RESULT" | jq -r '.payouts[]? | "Prediction: \(.prediction)s | Error: \(.error)s | Accuracy: \(.accuracyScore | tonumber | . * 1000 | floor / 1000) | Payout: \((.payout | tonumber / 1000000000) | . * 1000 | floor / 1000) SOL"'
echo ""

# Summary
echo -e "${GREEN}✅ Resolution complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Go to http://localhost:3000"
echo "  2. Click the '🏆 Winners' tab"
echo "  3. See your resolved market with:"
echo "     - Top 3 winners (🥇🥈🥉)"
echo "     - Accuracy scores"
echo "     - Payouts"
echo "     - Profit percentages"
echo ""
