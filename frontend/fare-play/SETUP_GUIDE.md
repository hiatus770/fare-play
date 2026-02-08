# FarePlay Setup Guide

## ✅ What's Working Now

1. **Wallet Connection** - Phantom connects properly! 🎉
2. **API Error Handling** - All routes now return JSON (no more HTML errors)
3. **Graceful Degradation** - App works without Supabase (returns empty data)

## 🔧 Environment Setup

### 1. Create `.env.local` File

Copy the template and fill in your values:

```bash
cp .env.local.template .env.local
```

Then edit `.env.local` with your Supabase credentials:

```env
# Get these from https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Solana RPC (devnet for testing)
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com

# Your admin wallet (for market resolution)
ADMIN_WALLET_ADDRESS=YOUR_WALLET_ADDRESS_HERE
```

### 2. Set Up Supabase Database

1. Go to https://supabase.com/dashboard
2. Create a new project (or use existing one)
3. In the SQL Editor, run the migration:

```bash
# Copy the SQL from:
/supabase/migrations/20260208_prediction_market.sql
```

This creates the tables:
- `users` - User accounts and stats
- `markets` - Prediction markets for bus arrivals
- `bets` - Individual user bets
- `market_resolutions` - Payout details

### 3. Deploy Anchor Program (Optional - for betting)

If you want to test the full betting functionality:

```bash
cd anchor
anchor build
anchor deploy --provider.cluster devnet
```

Note the program address and update `VAULT_PROGRAM_ADDRESS` if needed.

## 🧪 Testing Without Supabase

The app will work without Supabase configured! You'll see:
- Empty markets lists
- Zero balances
- Wallet connection still works
- All APIs return valid JSON

This is intentional so you can test the wallet connection and UI without database setup.

## 🚀 Current Features

### ✅ Working:
- Wallet connection (Phantom, Solflare, etc.)
- Wallet address display
- Connect/Disconnect functionality
- Vault deposit/withdraw (on-chain, no database needed)
- API error handling

### 📝 Ready to implement:
- Betting flow (Task #5)
- Market display
- User profiles
- Leaderboards

### ⏳ Not yet implemented:
- Market creation UI
- Bet placement UI
- Market resolution worker
- Payout distribution

## 📁 Project Structure

```
/app
  /api
    /betting          ← New betting API (proportional payouts)
    /markets          ← Old LMSR API (returns empty for now)
    /balance          ← Off-chain balance tracking
  /components
    WalletConnectButton.tsx  ← Fixed! Uses connectors
    TopNav.tsx               ← Shows wallet button
    VaultCard.tsx            ← Deposit/withdraw (works!)

/supabase
  /migrations
    20260208_prediction_market.sql  ← Run this in Supabase

/lib
  /supabase
    queries.ts       ← Helper functions
    database.types.ts ← TypeScript types

/anchor
  /programs
    /vault
      src/lib.rs     ← Solana program (deposit, withdraw, betting)
```

## 🐛 Troubleshooting

### Wallet won't connect
- Make sure Phantom is installed and unlocked
- Check browser console for errors
- Try refreshing the page

### API errors (500)
- Check if `.env.local` exists
- Verify Supabase credentials are correct
- Check console logs for specific errors

### Build errors
- Run `npm install` to ensure all packages are installed
- Check that environment variables don't have syntax errors

## 📞 Next Steps

1. **Set up Supabase** (if you want to test betting)
2. **Test wallet deposit/withdraw** with VaultCard
3. **Implement Task #5** - Integrate betting flow into StopSidebar
4. **Deploy to production** when ready

---

Need help? Check the detailed docs:
- `BETTING_API.md` - API endpoint documentation
- `WALLET_CONNECTION_FIXED.md` - Wallet connection details
- `TESTING_WALLET.md` - Wallet testing guide
