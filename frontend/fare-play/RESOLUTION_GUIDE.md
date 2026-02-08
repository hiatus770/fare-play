# Market Resolution & Winnings Distribution Guide

## Overview

When a bus arrives, FarePlay calculates **proportional payouts** based on prediction accuracy. More accurate predictions receive a larger share of the total pool.

---

## Distribution Formula

### Accuracy Score
```
accuracy_score = 1 / (1 + |predicted_seconds - actual_seconds|)
```

### Payout Calculation
```
user_payout = (total_pool × user_accuracy_score) / sum_all_accuracy_scores
```

---

## Example: 3 Bets on Same Market

**Market Setup:**
- Total Pool: 1.0 SOL (1,000,000,000 lamports)
- Actual Arrival: 420 seconds

**Bets Placed:**

| User | Predicted | Bet Amount | Error | Accuracy Score |
|------|-----------|------------|-------|----------------|
| Alice | 420s | 0.5 SOL | 0s | 1.000 |
| Bob | 425s | 0.3 SOL | 5s | 0.167 |
| Carol | 440s | 0.2 SOL | 20s | 0.048 |

**Accuracy Score Calculation:**
- Alice: `1 / (1 + 0) = 1.000`
- Bob: `1 / (1 + 5) = 0.167`
- Carol: `1 / (1 + 20) = 0.048`
- **Total Score: 1.215**

**Payout Distribution:**
- Alice: `(1.000 / 1.215) × 1.0 SOL = 0.823 SOL` ✅ (64% profit)
- Bob: `(0.167 / 1.215) × 1.0 SOL = 0.137 SOL` ❌ (54% loss)
- Carol: `(0.048 / 1.215) × 1.0 SOL = 0.040 SOL` ❌ (80% loss)

**Key Points:**
- ✅ Alice was exact → Gets biggest share
- ⚠️ Bob gets some return despite losing
- 💰 All pool distributed (no house cut!)
- 🎯 Closer prediction = Better outcome

---

## Market Lifecycle

```
1. ACTIVE (Accepting Bets)
   ↓
   User places bet → SOL deposited to market vault
   ↓
2. FROZEN (Betting Closed)
   ↓
   5 minutes before predicted arrival
   ↓
3. WAITING FOR ARRIVAL
   ↓
   Bus arrives → TTC records actual time
   ↓
4. RESOLUTION
   ↓
   Calculate accuracy scores
   ↓
5. PAYOUT DISTRIBUTION
   ↓
   SOL distributed from market vault → user vaults
   ↓
6. RESOLVED (Complete)
```

---

## Resolution Flow

### Step 1: Market Freezes

**Trigger:** 5 minutes before predicted arrival

**What Happens:**
- Market status → `FROZEN`
- No new bets accepted
- Existing bets locked in

**API:**
```bash
POST /api/betting/markets/freeze
```

**Automatic:** Worker checks every 10 seconds

---

### Step 2: Wait for Actual Arrival

**Waiting for:**
- Bus to actually arrive at stop
- TTC backend to record arrival time

**Check Status:**
```bash
GET http://localhost:5000/compare/{route}/{stop}/{vehicle}
```

**Response (when ready):**
```json
{
  "frozen_prediction": {
    "predicted_eta": 420,
    "actual_arrival": 425,
    "frozen_at": "2026-02-08T12:25:00Z"
  },
  "error_seconds": 5
}
```

---

### Step 3: Auto-Resolve Market

**Trigger:** Worker detects TTC has arrival data

**API:**
```bash
POST /api/betting/markets/auto-resolve
{
  "marketId": "uuid"
}
```

**What Happens:**
1. Fetch actual arrival from TTC
2. Calculate accuracy scores for all bets
3. Calculate proportional payouts
4. Build `distribute_payouts` Solana instruction
5. Return unsigned instruction

**Response:**
```json
{
  "success": true,
  "actualArrivalSeconds": 425,
  "resolution": {
    "instruction": { ... },
    "payouts": [
      {
        "betId": "uuid",
        "userVault": "4W43CW...",
        "prediction": 420,
        "error": 5,
        "accuracyScore": 0.167,
        "payout": "137000000"
      }
    ],
    "summary": {
      "winnerCount": 3,
      "totalPayout": "1000000000",
      "totalAccuracyScore": 1.215
    }
  }
}
```

---

### Step 4: Execute Payout (On-Chain)

**Who:** Admin wallet (has authority to call `distribute_payouts`)

**Solana Instruction:**
```rust
distribute_payouts(
  market_id: "501-6155-1234-1738995123456",
  payouts: Vec<Payout> {
    { winner_vault: "4W43...", amount: 823000000 },
    { winner_vault: "Abcd...", amount: 137000000 },
    { winner_vault: "Xyz9...", amount: 40000000 },
  }
)
```

**What Happens On-Chain:**
1. Verify market vault has sufficient balance
2. Transfer lamports from market vault → each winner vault
3. Emit success

**After Transaction Confirms:**
```bash
POST /api/betting/markets/resolve
{
  "marketId": "uuid",
  "actualArrivalSeconds": 425,
  "adminSignature": "5xK7Rz..."
}
```

**Database Updates:**
- Each bet: error, accuracy_score, payout_lamports, payout_signature
- Market: status → `RESOLVED`, actual_arrival_seconds, resolution_signature
- Create market_resolution record

---

## Why This Distribution Method?

### ✅ Advantages

1. **Fair & Merit-Based**
   - Better predictions = Better rewards
   - Accuracy is rewarded proportionally

2. **No House Edge**
   - 100% of pool returned to bettors
   - Platform makes money elsewhere (if at all)

3. **Encourages Participation**
   - Even slightly wrong bets get something back
   - Reduces all-or-nothing risk

4. **Mathematically Sound**
   - Score function ensures smooth gradient
   - No edge cases or exploits

5. **Simple to Understand**
   - Users can calculate expected payout
   - Transparent formula

### ⚠️ Considerations

1. **No Guaranteed Profit**
   - If you're less accurate than average, you lose money
   - Pool is zero-sum among participants

2. **Rounding Errors**
   - Handled by giving remainder to best prediction
   - Maximum 1 lamport difference

3. **Requires Trust in TTC Data**
   - Actual arrival time must be accurate
   - Sourced from official TTC API

---

## Testing Locally

### 1. Create a Test Market
```bash
# Place 3 bets on different predictions
# Bet A: 300s, 0.1 SOL
# Bet B: 320s, 0.2 SOL
# Bet C: 340s, 0.15 SOL
```

### 2. Freeze Market (Automatic)
```bash
# Worker runs: POST /api/betting/markets/freeze
# Or manually trigger after time passes
```

### 3. Mock TTC Response
```bash
# In Python backend, add test data
# Set actual_arrival = 320 (Bob wins big!)
```

### 4. Auto-Resolve
```bash
curl -X POST http://localhost:3000/api/betting/markets/auto-resolve \
  -H "Content-Type: application/json" \
  -d '{"marketId":"uuid"}'
```

### 5. Check Payouts
```bash
# Expected with actual = 320s:
# Bet A (300s, error=20): score = 0.048, payout ≈ 0.021 SOL
# Bet B (320s, error=0):  score = 1.000, payout ≈ 0.443 SOL (🎉 Winner!)
# Bet C (340s, error=20): score = 0.048, payout ≈ 0.021 SOL
```

---

## Production Deployment

### Option 1: Manual Resolution (Current)

**Pros:**
- Full control over payouts
- Can verify before executing
- Safer for testing

**Cons:**
- Requires admin intervention
- Not fully automated
- Slower resolution

**Process:**
1. Worker calls `/api/betting/markets/auto-resolve`
2. Returns unsigned instruction
3. Admin reviews payout distribution
4. Admin signs and sends transaction
5. Admin calls resolve with signature

### Option 2: Automated (Future)

**Requirements:**
- Hot wallet for admin key
- Secure key management (AWS KMS, etc.)
- Transaction monitoring
- Alerting for failures

**Risks:**
- Key compromise = fund loss
- Bug in payout calc = unfair distribution
- Need comprehensive testing

**Recommendation:** Start with manual, move to automated after confidence

---

## Security Considerations

### On-Chain (Solana Program)

✅ **Protected:**
- Only admin can call `distribute_payouts`
- Market vault seeds prevent collisions
- Payout amounts verified by program

⚠️ **Risks:**
- Admin key compromise
- Program upgrade authority

### Off-Chain (Database)

✅ **Protected:**
- RLS disabled for service role
- Only API routes can write
- Signatures verified

⚠️ **Risks:**
- Database compromise shows user data
- API route bugs could corrupt data

### Mitigation

1. **Multi-sig Admin** (Future)
   - Require 2-of-3 signatures for payouts
   - Protects against single key compromise

2. **Payout Limits**
   - Maximum payout per transaction
   - Rate limiting on distributions

3. **Monitoring**
   - Alert on large payouts
   - Track all resolutions
   - Audit trail in database

---

## Troubleshooting

### Market Won't Freeze

**Check:**
- Is freeze_time in the past?
- Is market status still `ACTIVE`?
- Is worker running?

**Fix:**
```bash
# Manually freeze
curl -X POST http://localhost:3000/api/betting/markets/freeze
```

### No TTC Data

**Check:**
- Is Python backend running on port 5000?
- Does `/compare` endpoint return data?
- Has bus actually arrived?

**Fix:**
```bash
# Test TTC endpoint
curl http://localhost:5000/compare/501/6155/1234
```

### Resolution Fails

**Check:**
- Is market `FROZEN` status?
- Do all bets have valid vault addresses?
- Is market_id_string set?

**Logs:**
```bash
# Check Next.js terminal for error details
# Check Supabase for bet records
```

### Payout Distribution Fails

**Check:**
- Does market vault have sufficient balance?
- Are user vault addresses valid?
- Is admin wallet configured?

**Verify:**
```sql
SELECT SUM(amount_lamports) FROM bets WHERE market_id = 'uuid';
-- Should equal market.total_pool_lamports
```

---

## Next Steps

1. ✅ Test resolution with 1 market manually
2. ✅ Verify payouts are calculated correctly
3. ✅ Run worker to auto-freeze markets
4. ✅ Implement admin signing flow
5. ⏳ Add UI to show resolved markets
6. ⏳ Display user's winnings
7. ⏳ Add notification when market resolves

---

## Questions?

- 📖 See [BETTING_API.md](./BETTING_API.md) for API details
- 📖 See [WORKER_GUIDE.md](./WORKER_GUIDE.md) for worker setup
- 🐛 Report issues on GitHub
