# Supabase Database Setup Guide

Follow these steps to set up your Supabase database for FarePlay.

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Sign in or create an account
3. Click "New Project"
4. Fill in:
   - **Name**: fare-play (or any name you like)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
   - **Plan**: Free tier is fine for development
5. Click "Create new project"
6. Wait 2-3 minutes for project to provision

## Step 2: Get Your API Credentials

1. In your Supabase project, go to **Settings** (gear icon) → **API**
2. You'll see:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
   - **service_role** key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

⚠️ **Important**: The service_role key is SECRET - never commit it to git!

## Step 3: Update Your .env.local File

1. Open `/frontend/fare-play/.env.local` (or create it if it doesn't exist)
2. Add these values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Keep these
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
ADMIN_WALLET_ADDRESS=YOUR_WALLET_ADDRESS_HERE
```

3. Replace the `xxxxx` with your actual Project URL
4. Replace the keys with your actual keys from Step 2
5. Save the file

## Step 4: Run the Database Schema

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open `/frontend/fare-play/supabase/COMPLETE_SCHEMA.sql` in your code editor
4. **Copy the ENTIRE file contents**
5. **Paste into the Supabase SQL Editor**
6. Click **Run** button (bottom right)

You should see:

```
Success. No rows returned
```

This is normal! It means all tables were created successfully.

## Step 5: Verify Tables Were Created

In the Supabase SQL Editor, run this query:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- ✅ `balances`
- ✅ `bets`
- ✅ `market_resolutions`
- ✅ `markets`
- ✅ `users`

You should also see 2 views:
- ✅ `active_markets_with_stats`
- ✅ `user_leaderboard`

## Step 6: Test Your Connection

1. Restart your Next.js dev server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser: http://localhost:3000

3. Check the browser console - you should NO LONGER see:
   - ❌ "Could not find the table 'public.markets'"
   - ❌ JSON parsing errors

4. Try the betting flow:
   - Connect wallet
   - Select a route and stop
   - Enter a prediction
   - Place a bet

If you see a Phantom popup to sign a transaction - **SUCCESS!** 🎉

## Troubleshooting

### "relation 'public.markets' does not exist"

This means the SQL didn't run. Double-check:
- You pasted the ENTIRE contents of COMPLETE_SCHEMA.sql
- You clicked "Run" in Supabase SQL Editor
- You saw "Success" message (even if it says "No rows returned")

### "Invalid API key"

Check your `.env.local`:
- Keys should be VERY long (starts with `eyJhbG...`)
- No quotes around values
- No extra spaces
- File must be named exactly `.env.local` (not `.env.local.txt`)

After fixing, **restart the dev server**:
```bash
# Stop with Ctrl+C, then:
npm run dev
```

### "Error: fetch failed"

Check that:
- Your Supabase URL ends with `.supabase.co` (no trailing slash)
- You're using HTTPS in the URL (not HTTP)
- Your project is actually running (check Supabase dashboard)

### Still seeing errors?

Enable debug logging. Add to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_DEBUG=true
```

Then check browser console and terminal for detailed error messages.

## Next Steps

Once Supabase is set up:

1. ✅ Test wallet connection
2. ✅ Test placing a bet
3. ✅ Check Supabase dashboard → Table Editor → `bets` table
4. 📖 Read [WORKER_GUIDE.md](./WORKER_GUIDE.md) to start the market resolver
5. 🧪 Read [BETTING_API.md](./BETTING_API.md) for API documentation

## Database Schema Overview

Here's what each table does:

| Table | Purpose |
|-------|---------|
| **balances** | Tracks off-chain SOL balance after vault deposit |
| **users** | User profiles with wallet addresses and stats |
| **markets** | Prediction markets for bus arrivals |
| **bets** | Individual user predictions and bet amounts |
| **market_resolutions** | Resolution details and payout calculations |

All SOL funds are stored **on-chain** in Solana vaults. Supabase only tracks metadata.

## Security Notes

✅ **Safe to do:**
- Share your Project URL
- Share your `anon public` key (it's meant to be public)
- Commit `.env.local.template` to git

❌ **NEVER do:**
- Share your `service_role` key (full database access!)
- Commit `.env.local` to git
- Put credentials in frontend code

## Need Help?

- 📖 [Supabase Documentation](https://supabase.com/docs)
- 📖 [FarePlay Setup Guide](./SETUP_GUIDE.md)
- 🐛 [Report issues](https://github.com/hiatus770/fare-play/issues)

