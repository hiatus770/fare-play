# Prediction Market - Architecture Plan

## Overview

Keep it simple: the existing vault program handles deposit/withdraw (on-chain). ALL betting logic lives in the backend (Supabase). The on-chain vault is just a "platform balance" that the backend tracks and deducts from.

---

## Core Flow

```
1. Connect Wallet (Phantom)
2. Deposit SOL into vault (already built)
3. Browse markets, pick YES or NO, choose amount
4. Backend deducts from your vault balance in the database
5. Admin resolves the market
6. Backend calculates payouts, credits winners' balances
7. User withdraws whenever they want
```

---

## How Money Moves

```
DEPOSIT:
  User Wallet --(1 SOL on-chain tx)--> Vault PDA
  Backend records: wallet_abc has 1 SOL platform balance

PLACE BET:
  No on-chain tx needed. Backend just updates the database:
    wallet_abc balance: 1 SOL → 0.5 SOL
    bet recorded: 0.5 SOL on YES for market #7

RESOLVE (admin clicks a button):
  Backend looks at all bets for market #7
  YES wins → backend credits all YES bettors proportionally
  NO bettors lose their stake (already deducted)

  Example:
    YES pool: 10 SOL (3 users)
    NO pool:   5 SOL (2 users)
    Outcome: YES

    User A bet 4 SOL on YES
    Payout = (4/10) * 5 + 4 = 6 SOL credited to their balance

    User B bet 3 SOL on NO
    Payout = 0 (stake already gone)

WITHDRAW:
  User clicks withdraw → on-chain tx moves SOL from vault PDA back to wallet
  Backend sets their balance to 0
```

---

## Why This Is Simplest

| Approach | On-chain complexity | Backend complexity |
|----------|--------------------|--------------------|
| Everything on-chain | Hard (4+ instructions, PDAs per market per user) | Easy |
| **Vault on-chain, bets off-chain** | **Easy (already built - deposit/withdraw)** | **Medium** |
| Everything off-chain | None (but no real crypto) | Hard |

The middle approach reuses your existing vault program. The only new code is Supabase tables + API routes.

---

## What Needs to Be Built

### 1. Solana Program - ALREADY DONE

Your existing vault program (`deposit` + `withdraw`) is all you need on-chain. No changes required.

### 2. Supabase Tables

```sql
-- Platform balances (mirrors vault deposits)
create table balances (
  wallet_address text primary key,
  balance_lamports bigint not null default 0
);

-- Prediction markets
create table markets (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  description text,
  image_url text,
  deadline timestamptz not null,
  status text not null default 'open',    -- 'open' | 'closed' | 'resolved'
  outcome text,                            -- 'yes' | 'no' | null
  yes_pool_lamports bigint not null default 0,
  no_pool_lamports bigint not null default 0,
  created_at timestamptz default now()
);

-- Individual bets
create table bets (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references markets(id),
  wallet_address text not null,
  side text not null,                      -- 'yes' | 'no'
  amount_lamports bigint not null,
  payout_lamports bigint default 0,        -- filled in on resolution
  created_at timestamptz default now()
);
```

### 3. Backend API Routes (Next.js API routes or Supabase Edge Functions)

| Route | What It Does |
|-------|-------------|
| `POST /api/deposit-confirm` | After on-chain deposit tx confirms, credit the user's `balances` row |
| `POST /api/withdraw-request` | Deduct from `balances`, then trigger on-chain withdraw |
| `POST /api/bet` | Validate balance, deduct from `balances`, insert into `bets`, update market pools |
| `POST /api/resolve` | Admin only. Set market outcome, calculate payouts, credit winner balances |
| `GET /api/markets` | List open/resolved markets |
| `GET /api/my-bets` | Get bets for a wallet address |

### 4. Key Backend Logic

**Place a bet** (pseudocode):
```
function placeBet(wallet, marketId, side, amount):
  balance = db.get(balances, wallet)
  if balance < amount → error "insufficient funds"
  if market.status != 'open' → error "market closed"

  db.update(balances, wallet, balance - amount)
  db.insert(bets, { marketId, wallet, side, amount })
  db.update(markets, marketId, increment pool for side)
```

**Resolve a market** (pseudocode):
```
function resolveMarket(marketId, outcome):
  market = db.get(markets, marketId)
  winningPool = outcome == 'yes' ? market.yes_pool : market.no_pool
  losingPool  = outcome == 'yes' ? market.no_pool : market.yes_pool

  winningBets = db.query(bets, { marketId, side: outcome })

  for each bet in winningBets:
    payout = (bet.amount / winningPool) * losingPool + bet.amount
    db.update(balances, bet.wallet, balance + payout)
    db.update(bets, bet.id, { payout })

  db.update(markets, marketId, { status: 'resolved', outcome })
```

### 5. Frontend Components

| Component | Purpose | Exists? |
|-----------|---------|---------|
| `SidebarWallet` | Connect wallet, deposit/withdraw, show balance | Yes |
| `MarketList` | Grid/list of open markets | Build |
| `MarketCard` | Shows question, YES/NO pools, deadline | Build |
| `BetPanel` | Pick side, enter amount, submit | Build |
| `MyBets` | User's active and settled bets | Build |
| `AdminPanel` | Create markets, resolve them | Build |

---

## Architecture Diagram

```
  +------------------+
  |  Phantom Wallet  |
  +--------+---------+
           |
      connect + sign
      deposit/withdraw txs only
           |
  +--------v---------+       +------------------+
  |   Next.js App    | <---> |    Supabase DB   |
  |                  |  API  |                  |
  | - Market list    |  routes| - balances       |
  | - Place bets     |       | - markets        |
  | - My bets        |       | - bets           |
  | - Admin panel    |       |                  |
  +--------+---------+       +------------------+
           |                   ALL BETTING LOGIC
      deposit/withdraw         LIVES HERE
      only
           |
  +--------v---------+
  |  Solana Devnet   |
  |                  |
  |  Vault PDA       |
  |  (holds SOL)     |
  +------------------+
    ONLY HOLDS MONEY
```

---

## What to Remove

- `app/login/page.tsx` - not needed
- `app/signup/page.tsx` - not needed
- `contexts/AuthContext.tsx` - not needed
- Supabase Auth config - not needed

Wallet address = user identity. No accounts, no passwords.

---

## Build Order

1. Create Supabase tables (`balances`, `markets`, `bets`)
2. `POST /api/deposit-confirm` - sync on-chain deposit to DB balance
3. `POST /api/bet` - place a bet (deduct balance, record bet)
4. `POST /api/resolve` - admin resolves, calculates payouts
5. `GET /api/markets` + `MarketList` page
6. `BetPanel` component
7. `AdminPanel` page (create + resolve markets)
8. `MyBets` page
9. Remove old auth pages

---

## Security Notes

- API routes that place bets should verify the wallet signature to prove the caller owns the wallet (prevent someone betting on behalf of another wallet)
- Admin resolve route needs auth (could be a simple API key or check against a hardcoded admin wallet)
- The `deposit-confirm` route should verify the on-chain transaction actually happened before crediting balance (check tx signature on Solana RPC)
- Consider rate limiting bet placement
