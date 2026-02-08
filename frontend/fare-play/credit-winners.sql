-- Credit winners' vaults with their payouts for market 71f6ce4d-6f81-40c8-a262-e1a2e32d1d50

-- Update balances table with payout amounts
INSERT INTO balances (wallet, balance_lamports, updated_at)
SELECT
  b.wallet_address,
  b.payout_lamports,
  NOW()
FROM bets b
WHERE b.market_id = '71f6ce4d-6f81-40c8-a262-e1a2e32d1d50'
  AND b.payout_lamports > 0
ON CONFLICT (wallet)
DO UPDATE SET
  balance_lamports = balances.balance_lamports + EXCLUDED.balance_lamports,
  updated_at = NOW();

-- Show updated balances
SELECT
  b.wallet_address,
  b.payout_lamports / 1000000000.0 as payout_sol,
  bal.balance_lamports / 1000000000.0 as new_balance_sol
FROM bets b
LEFT JOIN balances bal ON bal.wallet = b.wallet_address
WHERE b.market_id = '71f6ce4d-6f81-40c8-a262-e1a2e32d1d50'
  AND b.payout_lamports > 0;
