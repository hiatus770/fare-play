# Market Resolution Worker Guide

The market resolution worker is a background process that automatically manages the lifecycle of prediction markets.

## What It Does

1. **Freezes markets** - Stops accepting bets 5 minutes before predicted bus arrival
2. **Checks for arrivals** - Queries TTC backend for verified arrival data
3. **Resolves markets** - Calculates and distributes proportional payouts to winners
4. **Handles timeouts** - Cancels markets and refunds bets if bus never arrives (30+ min)

## Architecture

```
┌──────────────┐
│   Worker     │
│ (30s loop)   │
└──────┬───────┘
       │
       ├─→ GET /api/betting/markets/list?status=FROZEN
       │   (Fetch markets awaiting resolution)
       │
       ├─→ GET http://localhost:5000/compare/{route}/{stop}/{vehicle}
       │   (Check TTC backend for verified arrival)
       │
       ├─→ POST /api/betting/markets/resolve
       │   (Trigger payout calculation and distribution)
       │
       └─→ POST /api/betting/markets/cancel
           (Cancel timed-out markets)
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs `tsx` which allows running TypeScript directly.

### 2. Set Environment Variables

Create `.env.local` if you haven't already:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
TTC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Start Required Services

**Terminal 1 - TTC Backend (Python):**
```bash
cd ../../backend/ttc-predictor
python api_v2.py
```

**Terminal 2 - Next.js App:**
```bash
cd frontend/fare-play
npm run dev
```

**Terminal 3 - Market Resolver:**
```bash
cd frontend/fare-play
npm run resolver
```

## Worker Configuration

Edit `workers/market-resolver.ts` to adjust timing:

```typescript
const RESOLUTION_CHECK_INTERVAL = 30000;  // Check every 30s
const FREEZE_CHECK_INTERVAL = 10000;      // Check every 10s
const MARKET_TIMEOUT_MS = 30 * 60 * 1000; // Cancel after 30 min
```

## Logs and Monitoring

The worker outputs detailed logs:

```
🚀 Market Resolution Worker started
📍 API Base: http://localhost:3000
📍 TTC Backend: http://localhost:5000
⏱️  Freeze check: every 10s
⏱️  Resolution check: every 30s

🔍 Checking for markets to resolve...
📊 Found 3 frozen markets
✅ TTC verified arrival for market abc123: error=5s
✅ Resolved market abc123: winners=3, totalPayout=0.45 SOL
⏳ Market def456 waiting for TTC data (45s elapsed)
🚫 Cancelled market ghi789 (timeout): refunded 2 bets
```

### Log Legend

- 🚀 Startup
- 🔍 Resolution check cycle started
- ✅ Successful action (freeze, resolve)
- ⏳ Waiting for data
- 🚫 Market cancelled
- ⏰ Market timed out
- ❌ Error occurred

## Production Deployment

### Option 1: Long-Running Process

Run as a systemd service, PM2, or Docker container:

```bash
# Using PM2
pm2 start npm --name "fare-play-resolver" -- run resolver
pm2 save
pm2 startup
```

### Option 2: Cron Job (Vercel Cron)

Create `app/api/cron/worker/route.ts`:

```typescript
import { freezeMarkets, processResolutions } from '../../../../workers/market-resolver';

export async function GET() {
  await freezeMarkets();
  await processResolutions();
  return Response.json({ success: true });
}
```

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/worker",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

### Option 3: AWS Lambda

Package the worker as a Lambda function with EventBridge trigger.

## API Endpoints Used

### GET /api/betting/markets/list?status=FROZEN
Returns all markets with the specified status.

**Response:**
```json
{
  "markets": [
    {
      "id": "uuid",
      "route": "501",
      "stop_tag": "6155",
      "vehicle_id": "1234",
      "freeze_time": "2026-02-08T12:30:00Z",
      "status": "FROZEN",
      "total_pool_lamports": 500000000
    }
  ]
}
```

### GET http://localhost:5000/compare/{route}/{stop}/{vehicle}
TTC backend endpoint for verified arrival data.

**Response:**
```json
{
  "frozen_prediction": {
    "predicted_eta": 420,
    "frozen_at": "2026-02-08T12:25:00Z",
    "actual_arrival": 425
  },
  "error_seconds": 5
}
```

### POST /api/betting/markets/freeze
Freezes all markets that have reached their freeze time.

**Response:**
```json
{
  "frozenMarkets": [
    { "id": "uuid", "route": "501", "vehicle_id": "1234" }
  ]
}
```

### POST /api/betting/markets/resolve
Resolves a market with proportional payouts.

**Request:**
```json
{ "marketId": "uuid" }
```

**Response:**
```json
{
  "success": true,
  "marketId": "uuid",
  "winners": [
    { "wallet": "CV4x...", "payout": 150000000, "accuracy_score": 1.0 }
  ],
  "totalPayout": 500000000,
  "signature": "5xK7..."
}
```

### POST /api/betting/markets/cancel
Cancels a timed-out market and refunds bets.

**Request:**
```json
{ "marketId": "uuid" }
```

**Response:**
```json
{
  "success": true,
  "marketId": "uuid",
  "refundCount": 5,
  "totalRefunded": 500000000
}
```

## Troubleshooting

### Worker won't start

**Error:** `Cannot find module 'tsx'`
```bash
npm install
```

**Error:** `ECONNREFUSED localhost:3000`
- Make sure Next.js app is running: `npm run dev`

**Error:** `ECONNREFUSED localhost:5000`
- Make sure TTC backend is running: `python api_v2.py`

### Markets not freezing

- Check that `freeze_time` is set correctly in database
- Verify freeze endpoint works: `curl -X POST http://localhost:3000/api/betting/markets/freeze`
- Check worker logs for errors

### Markets not resolving

- Verify TTC backend has verified arrival data
- Check `/compare` endpoint manually:
  ```bash
  curl http://localhost:5000/compare/501/6155/1234
  ```
- Ensure market status is "FROZEN" (not "ACTIVE")
- Check Supabase has bet records

### Payouts not distributed

- Check Solana program is deployed correctly
- Verify market vault has sufficient balance
- Check for Solana transaction errors in logs
- Ensure admin wallet has SOL for transaction fees

## Testing Locally

### Test Freeze Logic

```bash
# Create a test market that freezes in 30 seconds
curl -X POST http://localhost:3000/api/betting/markets/create \
  -H "Content-Type: application/json" \
  -d '{
    "route": "501",
    "stopTag": "6155",
    "vehicleId": "TEST123",
    "predictedArrivalSeconds": 330
  }'

# Wait 30 seconds, then check worker logs
# Should see: "✅ Frozen 1 markets"
```

### Test Resolution Logic

```bash
# Place some bets on a market
# Wait for market to freeze
# Mock TTC backend response with verified arrival
# Check worker logs for resolution
```

### Test Cancellation

```bash
# Create old frozen market (modify freeze_time in DB to 31 min ago)
# Worker should cancel it on next check
# Should see: "🚫 Cancelled market ... (timeout)"
```

## Security Considerations

1. **Admin-only operations** - Only the worker (with service role key) can resolve/cancel markets
2. **Idempotent resolution** - Markets can only be resolved once (status check prevents duplicates)
3. **Timeout protection** - Markets auto-cancel if no arrival data after 30 minutes
4. **Signature verification** - All Solana transactions are verified on-chain

## Performance Optimization

### Reduce Database Queries

Instead of polling every 30s, use Supabase Realtime subscriptions:

```typescript
supabase
  .channel('market-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'markets',
    filter: 'status=eq.FROZEN'
  }, (payload) => {
    // Process immediately
  })
  .subscribe();
```

### Batch Processing

Process multiple markets in parallel:

```typescript
await Promise.all(markets.map(market => resolveMarket(market.id)));
```

### Rate Limiting

If TTC backend rate-limits, add exponential backoff:

```typescript
const response = await retry(() => fetch(ttcUrl), {
  retries: 3,
  factor: 2,
  minTimeout: 1000
});
```

## Next Steps

1. Add monitoring and alerting (Sentry, Datadog)
2. Implement health check endpoint
3. Add metrics collection (resolution time, success rate)
4. Set up log aggregation (CloudWatch, Logtail)
5. Deploy to production environment

---

**Questions?** Check the main [SETUP_GUIDE.md](./SETUP_GUIDE.md) or [BETTING_API.md](./BETTING_API.md)
