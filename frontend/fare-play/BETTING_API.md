# FarePlay Betting API Documentation

This document describes the betting prediction market API endpoints for FarePlay.

## Base URL
All betting endpoints are under `/api/betting/`

## Architecture Overview

The betting system uses:
- **On-chain**: Solana program for fund management (user vaults, market escrow vaults)
- **Off-chain**: Supabase for tracking bets, markets, and outcomes
- **Proportional payout**: Winners share the pool based on prediction accuracy

## Authentication

Currently no authentication required. Wallet addresses are used for identification.

## Endpoints

### Markets

#### `POST /api/betting/markets/create`
Create a new prediction market for a vehicle arrival.

**Request Body:**
```json
{
  "route": "501",
  "stopTag": "6155",
  "vehicleId": "1234",
  "predictedArrivalSeconds": 480
}
```

**Response:**
```json
{
  "marketId": "uuid",
  "marketVaultAddress": "solana_address",
  "freezeTime": "2026-02-08T12:35:00Z",
  "predictedArrivalSeconds": 480,
  "status": "ACTIVE"
}
```

**Notes:**
- Market automatically freezes 5 minutes before predicted arrival
- Returns existing market if one already exists for this vehicle
- Minimum prediction: 60 seconds

---

#### `GET /api/betting/markets?status=active`
List markets by status.

**Query Parameters:**
- `status`: `active`, `frozen`, `resolved`, `cancelled` (default: `active`)

**Response:**
```json{
  "markets": [
    {
      "id": "uuid",
      "market_vault_address": "solana_address",
      "route": "501",
      "stop_tag": "6155",
      "vehicle_id": "1234",
      "freeze_time": "2026-02-08T12:35:00Z",
      "predicted_arrival_seconds": 480,
      "status": "ACTIVE",
      "total_pool_lamports": "100000000",
      "bet_count": 5
    }
  ],
  "count": 1
}
```

---

#### `GET /api/betting/markets/[id]`
Get detailed market information with bets and statistics.

**Response:**
```json
{
  "market": { /* market object */ },
  "bets": [
    {
      "id": "uuid",
      "wallet_address": "AbC1...xYz9",
      "predicted_arrival_seconds": 450,
      "amount_lamports": "50000000",
      "created_at": "2026-02-08T12:30:00Z"
    }
  ],
  "stats": {
    "totalBets": 5,
    "totalPool": "250000000",
    "minPrediction": 420,
    "maxPrediction": 510,
    "avgPrediction": 465,
    "predictionDistribution": {
      "420": 1,
      "450": 2,
      "480": 1,
      "510": 1
    },
    "secondsUntilFreeze": 180,
    "isFrozen": false,
    "isResolved": false
  }
}
```

**Notes:**
- Wallet addresses are truncated for privacy
- Prediction distribution is grouped by 10-second buckets

---

#### `POST /api/betting/markets/freeze`
Freeze markets that have reached their freeze time.

**Response:**
```json
{
  "success": true,
  "frozenCount": 3,
  "failedCount": 0,
  "frozenMarkets": [
    {
      "marketId": "uuid",
      "route": "501",
      "stopTag": "6155",
      "vehicleId": "1234"
    }
  ]
}
```

**Notes:**
- Called by cron job every minute
- Can be called manually for testing

---

#### `POST /api/betting/markets/resolve`
Resolve a market by calculating and distributing proportional payouts.

**Request Body (without signature - returns unsigned transaction):**
```json
{
  "marketId": "uuid",
  "actualArrivalSeconds": 475
}
```

**Response (unsigned):**
```json
{
  "success": true,
  "resolved": false,
  "instruction": {
    "programAddress": "...",
    "accounts": [...],
    "data": [...]
  },
  "payouts": [
    {
      "betId": "uuid",
      "userVault": "solana_address",
      "prediction": 450,
      "error": 25,
      "accuracyScore": 0.0384615,
      "payout": "95000000"
    }
  ],
  "summary": {
    "winnerCount": 5,
    "totalPayout": "250000000",
    "totalAccuracyScore": 0.192307,
    "actualArrival": 475
  }
}
```

**Request Body (with signature - confirms resolution):**
```json
{
  "marketId": "uuid",
  "actualArrivalSeconds": 475,
  "adminSignature": "solana_tx_signature"
}
```

**Response (confirmed):**
```json
{
  "success": true,
  "resolved": true,
  "signature": "solana_tx_signature",
  "winnerCount": 5,
  "totalPayout": "250000000"
}
```

**Payout Formula:**
```
For each bet i:
  error_i = |predicted_i - actual_arrival|
  accuracy_score_i = 1 / (1 + error_i)

Total accuracy score = Σ accuracy_score_i

Payout_i = (accuracy_score_i / total_accuracy_score) * total_pool
```

**Notes:**
- Market must be in FROZEN status
- All bets receive proportional payouts based on accuracy
- Dust from rounding goes to highest scorer
- Admin wallet signature required to finalize

---

### Bets

#### `POST /api/betting/bets/place`
Create an unsigned bet placement transaction.

**Request Body:**
```json
{
  "walletAddress": "solana_address",
  "marketId": "uuid",
  "predictedArrivalSeconds": 450,
  "amountLamports": 50000000
}
```

**Response:**
```json
{
  "instruction": {
    "programAddress": "...",
    "accounts": [...],
    "data": [...]
  },
  "marketId": "uuid",
  "userId": "uuid",
  "userVaultAddress": "solana_address",
  "marketVaultAddress": "solana_address"
}
```

**Flow:**
1. Call this endpoint to get unsigned transaction
2. Frontend signs transaction with wallet
3. Send transaction to Solana
4. Call `/api/betting/bets/confirm` with signature

**Validations:**
- Market must be ACTIVE
- Market must not be frozen yet
- Amount must be > 0
- User can only place one bet per market

---

#### `POST /api/betting/bets/confirm`
Confirm a bet after Solana transaction succeeds.

**Request Body:**
```json
{
  "marketId": "uuid",
  "userId": "uuid",
  "walletAddress": "solana_address",
  "predictedArrivalSeconds": 450,
  "amountLamports": 50000000,
  "signature": "solana_tx_signature"
}
```

**Response:**
```json
{
  "success": true,
  "betId": "uuid",
  "signature": "solana_tx_signature"
}
```

**Notes:**
- Call this after successful Solana transaction
- Records bet in database
- Updates market statistics

---

#### `GET /api/betting/bets/user/[wallet]`
Get all bets for a user wallet address.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "wallet_address": "solana_address",
    "vault_address": "solana_address",
    "total_bets_placed": 15,
    "total_markets_won": 8,
    "lifetime_wagered_lamports": 1500000000,
    "lifetime_winnings_lamports": 1800000000
  },
  "activeBets": [
    {
      "id": "uuid",
      "predicted_arrival_seconds": 450,
      "amount_lamports": 50000000,
      "market": {
        "route": "501",
        "stop_tag": "6155",
        "vehicle_id": "1234",
        "freeze_time": "2026-02-08T12:35:00Z",
        "status": "ACTIVE"
      }
    }
  ],
  "pendingResolutions": [/* frozen markets awaiting resolution */],
  "history": [/* resolved/cancelled bets */]
}
```

---

## Workflow Example

### 1. Create Market
```bash
POST /api/betting/markets/create
{
  "route": "501",
  "stopTag": "6155",
  "vehicleId": "1234",
  "predictedArrivalSeconds": 480
}
```

### 2. Place Bet
```bash
# Get unsigned transaction
POST /api/betting/bets/place
{
  "walletAddress": "user_wallet",
  "marketId": "market_uuid",
  "predictedArrivalSeconds": 450,
  "amountLamports": 50000000
}

# Sign with wallet and send to Solana
# Then confirm:
POST /api/betting/bets/confirm
{
  "marketId": "market_uuid",
  "userId": "user_uuid",
  "walletAddress": "user_wallet",
  "predictedArrivalSeconds": 450,
  "amountLamports": 50000000,
  "signature": "tx_signature"
}
```

### 3. Market Lifecycle
```bash
# Market freezes automatically when freeze_time reached
POST /api/betting/markets/freeze

# Worker fetches actual arrival from TTC API
# Then resolves market:
POST /api/betting/markets/resolve
{
  "marketId": "market_uuid",
  "actualArrivalSeconds": 475
}

# Admin signs and submits Solana transaction
# Then confirms:
POST /api/betting/markets/resolve
{
  "marketId": "market_uuid",
  "actualArrivalSeconds": 475,
  "adminSignature": "admin_tx_signature"
}
```

---

## Error Codes

- `400` - Bad request (invalid parameters, market frozen, etc.)
- `404` - Resource not found
- `500` - Internal server error

## Database Schema

See `/supabase/migrations/20260208_prediction_market.sql` for full schema.

**Key Tables:**
- `users` - User accounts and lifetime stats
- `markets` - Prediction markets
- `bets` - Individual bets
- `market_resolutions` - Resolution details

## Solana Program

**Program ID:** `EBngoQ315cEWJoeqg8RTBzDnhSuE7BswEtHQ9ou9MSXe`

**Instructions:**
- `deposit` - Deposit SOL to personal vault
- `withdraw` - Withdraw SOL from personal vault
- `place_bet` - Transfer SOL from user vault to market vault
- `distribute_payouts` - Transfer SOL from market vault to winner vaults
- `refund_market` - Refund bets from cancelled markets

**PDA Seeds:**
- User vault: `["vault", user_wallet_address]`
- Market vault: `["market", market_id_string]`

## Frontend Integration

Use the `useBettingMarkets` hook:

```typescript
import { useBettingMarkets } from '@/hooks/useBettingMarkets';

function MyComponent() {
  const { activeMarkets, resolvedMarkets, loading, error, refetch } = useBettingMarkets();

  // activeMarkets: currently accepting bets
  // resolvedMarkets: completed markets with payouts
  // loading: initial load state
  // error: error message if fetch fails
  // refetch: manually refresh data
}
```

## Environment Variables

Required:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
ADMIN_WALLET_ADDRESS=admin_wallet_for_resolutions
```
