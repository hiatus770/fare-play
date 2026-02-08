# End-to-End Testing Guide

Test the complete FarePlay betting and resolution flow!

---

## 🎯 What We're Testing

1. ✅ Place bets from multiple wallets
2. ✅ Market freezes automatically
3. ✅ Get actual arrival from TTC
4. ✅ Resolve market with payouts
5. ✅ View winners in UI

---

## 🚀 Quick Test (5 minutes)

### Step 1: Start Servers

**Terminal 1 - Next.js:**
```bash
cd frontend/fare-play
npm run dev
```

**Terminal 2 - Python TTC Backend:**
```bash
cd backend/ttc-predictor
python api_v2.py
```

###Step 2: Place Test Bets

1. Go to http://localhost:3000
2. Connect your wallet
3. Select a route (e.g., 501 Queen)
4. Select a stop
5. Select a vehicle from predictions
6. Enter prediction: **300 seconds**
7. Bet amount: **0.01 SOL**
8. Click "Place Bet" ✅

**Expected:**
- Phantom popup appears
- Transaction shows 2 instructions (deposit + bet)
- Success message appears
- Check "All Bets" tab → see your bet!

### Step 3: Place More Bets (Different Predictions)

**Switch to another wallet** (or use multiple browsers/devices):

- Wallet 2: Predict **320 seconds**, bet 0.02 SOL
- Wallet 3: Predict **340 seconds**, bet 0.015 SOL

**Why?** Different predictions = different accuracy scores = interesting distribution!

### Step 4: Check Market Info

In the betting panel, you should see:
```
Total Pool: 0.045 SOL
Bets Placed: 3
Freezes In: Xm Xs
Prediction Range: 300s - 340s
```

### Step 5: Freeze Market (Manual)

**Option A: Wait** (if freeze time is soon)
- Market auto-freezes 5 minutes before predicted arrival

**Option B: Manual Trigger**
```bash
curl -X POST http://localhost:3000/api/betting/markets/freeze
```

**Expected:**
- Market status → FROZEN
- "Market Frozen" appears in UI
- Can't place more bets

### Step 6: Mock TTC Arrival Data

**Edit Python backend** to return actual arrival:

`backend/ttc-predictor/api_v2.py`:
```python
# Add test data for your vehicle
frozen_predictions[vehicle_id] = {
    "predicted_eta": 300,
    "frozen_at": datetime.now(),
    "actual_arrival": 320  # ← Set this!
}
```

**Or** use the `/freeze` endpoint to record prediction, then wait for actual bus.

### Step 7: Resolve Market

```bash
curl -X POST http://localhost:3000/api/betting/markets/auto-resolve \
  -H "Content-Type: application/json" \
  -d '{
    "marketId": "YOUR_MARKET_ID_HERE"
  }'
```

**Get Market ID from:**
- Database: `SELECT id FROM markets WHERE status = 'FROZEN' LIMIT 1;`
- Or check console logs when placing bet

**Response:**
```json
{
  "success": true,
  "actualArrivalSeconds": 320,
  "resolution": {
    "payouts": [
      {
        "betId": "...",
        "userVault": "...",
        "prediction": 320,
        "error": 0,
        "accuracyScore": 1.0,
        "payout": "30000000"
      },
      {
        "prediction": 300,
        "error": 20,
        "accuracyScore": 0.048,
        "payout": "10000000"
      },
      {
        "prediction": 340,
        "error": 20,
        "accuracyScore": 0.048,
        "payout": "5000000"
      }
    ],
    "summary": {
      "winnerCount": 3,
      "totalPayout": "45000000",
      "totalAccuracyScore": 1.096
    }
  }
}
```

### Step 8: Execute Payouts (On-Chain)

**For now: Manual execution required**

The response includes an `instruction` object. You need to:
1. Sign it with admin wallet
2. Send to Solana
3. Get transaction signature
4. Call resolve endpoint with signature

**Future:** Worker will do this automatically.

### Step 9: View Winners! 🏆

1. Go to http://localhost:3000
2. Click **"🏆 Winners"** tab
3. See the resolved market with:
   - 🥇 1st place (320s prediction, error=0) → Biggest payout!
   - 🥈 2nd place (300s prediction, error=20) → Some return
   - 🥉 3rd place (340s prediction, error=20) → Small return

**Your bet highlighted in blue if you're a winner!**

---

## 🧪 Full Test Scenarios

### Scenario 1: Perfect Prediction Wins Big

**Bets:**
- Alice: 420s, 0.1 SOL
- Bob: 420s, 0.2 SOL (exact same prediction!)
- Carol: 450s, 0.1 SOL

**Actual:** 420s

**Expected Payouts:**
- Alice: 0.1 SOL (break even, shares with Bob)
- Bob: 0.2 SOL (break even, shares with Bob)
- Carol: ~0 SOL (way off)

**Why?** Alice and Bob have same accuracy, so they split the winnings from Carol's bet proportionally to their stake.

### Scenario 2: Close Predictions

**Bets:**
- Alice: 300s, 0.1 SOL
- Bob: 305s, 0.1 SOL
- Carol: 310s, 0.1 SOL

**Actual:** 305s

**Expected:**
- Alice (error=5): score = 0.167
- Bob (error=0): score = 1.000
- Carol (error=5): score = 0.167
- Total score: 1.334

**Payouts:**
- Alice: (0.167/1.334) × 0.3 = 0.0376 SOL (-62%)
- Bob: (1.000/1.334) × 0.3 = 0.2248 SOL (+125%) ✅
- Carol: (0.167/1.334) × 0.3 = 0.0376 SOL (-62%)

**Why?** Small differences in prediction = big differences in payout!

### Scenario 3: All Wrong (but someone's least wrong)

**Bets:**
- Alice: 200s, 0.1 SOL
- Bob: 300s, 0.1 SOL
- Carol: 400s, 0.1 SOL

**Actual:** 500s

**Errors:**
- Alice: 300s (very wrong)
- Bob: 200s (wrong)
- Carol: 100s (least wrong) ✅

**Expected:**
- Carol gets most of the pool despite being 100s off!
- It's relative, not absolute

---

## 🔍 Debugging

### Bets Not Showing Up

**Check:**
1. Are you on the right tab? ("All Bets")
2. Open browser console - see fetch logs?
3. Check database: `SELECT * FROM bets;`

**Fix:**
```bash
# Check Next.js terminal
# Should show: ✅ Fetched X bets from database
```

### Market Won't Freeze

**Check:**
1. Is freeze_time in the past?
2. Check database: `SELECT id, freeze_time, status FROM markets;`

**Manual freeze:**
```bash
curl -X POST http://localhost:3000/api/betting/markets/freeze
```

### TTC Data Missing

**Check:**
1. Is Python backend running on port 5000?
2. Test endpoint: `curl http://localhost:5000/compare/501/6155/1234`

**Mock data:**
```bash
# Add to Python backend frozen_predictions dict
```

### Resolution Fails

**Check:**
1. Market is FROZEN status?
2. market_id_string exists in DB?
3. All bets have user vault addresses?

**Logs:**
```bash
# Check Next.js terminal for detailed error
```

---

## ✅ Success Checklist

- [ ] Can place bet from wallet
- [ ] Bet shows in "All Bets" tab
- [ ] Market info shows correct pool/count
- [ ] Market freezes (auto or manual)
- [ ] Can fetch TTC actual arrival
- [ ] Auto-resolve calculates payouts correctly
- [ ] Winners tab shows resolved market
- [ ] Top 3 winners displayed with podium (🥇🥈🥉)
- [ ] Your own bets highlighted in blue
- [ ] Profit percentages calculated correctly

---

## 🎉 Next Steps

Once basic testing works:

1. **Deploy Worker**
   - Run: `npm run resolver`
   - Auto-freezes and resolves markets

2. **Test Real TTC Data**
   - Use actual bus predictions
   - Wait for real arrivals
   - Verify TTC backend accuracy

3. **Multi-Market Testing**
   - Create markets on different routes
   - Test simultaneous resolutions
   - Verify no interference

4. **Stress Testing**
   - 10+ bets on one market
   - Multiple markets resolving
   - Check performance

5. **Production Deploy**
   - Devnet → Mainnet
   - Real SOL (start small!)
   - Monitor everything

---

## 📊 Expected Outcomes

**From Testing:**
- Understand payout distribution
- Verify accuracy scoring works
- Build confidence in system
- Find edge cases

**What You'll Learn:**
- Being close matters more than you think
- Small errors compound quickly
- Pool size affects profit potential
- Timing of freeze is critical

---

## 🆘 Need Help?

**Check logs in order:**
1. Browser console (F12)
2. Next.js terminal
3. Python terminal
4. Database (Supabase)

**Common Issues:**
- Port conflicts (3000/5000 already in use)
- Missing env vars (.env.local)
- Supabase not configured
- Program not deployed to devnet

**Still stuck?**
- Read RESOLUTION_GUIDE.md for detailed flow
- Check BETTING_API.md for endpoint specs
- Review Supabase tables directly

---

Happy testing! 🚀
