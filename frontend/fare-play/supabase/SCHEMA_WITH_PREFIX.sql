-- ============================================================================
-- FarePlay Schema with "fp_" prefix to avoid conflicts
-- Use this if you want to keep your old tables
-- ============================================================================

-- BALANCES TABLE
CREATE TABLE IF NOT EXISTS fp_balances (
  wallet TEXT PRIMARY KEY,
  balance_lamports BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fp_positive_balance CHECK (balance_lamports >= 0)
);

-- USERS TABLE
CREATE TABLE IF NOT EXISTS fp_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  vault_address TEXT UNIQUE NOT NULL,
  total_bets_placed INTEGER DEFAULT 0,
  total_markets_won INTEGER DEFAULT 0,
  lifetime_wagered_lamports BIGINT DEFAULT 0,
  lifetime_winnings_lamports BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fp_users_wallet ON fp_users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_fp_users_vault ON fp_users(vault_address);

-- MARKETS TABLE
CREATE TABLE IF NOT EXISTS fp_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_vault_address TEXT UNIQUE NOT NULL,
  route TEXT NOT NULL,
  stop_tag TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  freeze_time TIMESTAMPTZ NOT NULL,
  predicted_arrival_seconds INTEGER NOT NULL,
  actual_arrival_seconds INTEGER,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'RESOLVED', 'CANCELLED')),
  total_pool_lamports BIGINT DEFAULT 0,
  bet_count INTEGER DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  resolution_signature TEXT,
  UNIQUE(route, stop_tag, vehicle_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_fp_markets_status ON fp_markets(status);
CREATE INDEX IF NOT EXISTS idx_fp_markets_vehicle ON fp_markets(vehicle_id, route, stop_tag);
CREATE INDEX IF NOT EXISTS idx_fp_markets_freeze ON fp_markets(freeze_time);

-- BETS TABLE
CREATE TABLE IF NOT EXISTS fp_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES fp_markets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES fp_users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  predicted_arrival_seconds INTEGER NOT NULL,
  amount_lamports BIGINT NOT NULL CHECK (amount_lamports > 0),
  placement_signature TEXT NOT NULL,
  error_seconds INTEGER,
  accuracy_score REAL,
  payout_lamports BIGINT DEFAULT 0,
  payout_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(market_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fp_bets_market ON fp_bets(market_id);
CREATE INDEX IF NOT EXISTS idx_fp_bets_user ON fp_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_fp_bets_wallet ON fp_bets(wallet_address);

-- RESOLUTIONS TABLE
CREATE TABLE IF NOT EXISTS fp_market_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES fp_markets(id) ON DELETE CASCADE,
  actual_arrival_seconds INTEGER NOT NULL,
  total_payout_lamports BIGINT NOT NULL,
  winner_count INTEGER NOT NULL,
  total_accuracy_score REAL NOT NULL,
  resolved_at TIMESTAMPTZ DEFAULT NOW(),
  resolution_signature TEXT NOT NULL,
  UNIQUE(market_id)
);

-- TRIGGERS AND FUNCTIONS (same as before, adapted for fp_ tables)

CREATE OR REPLACE FUNCTION fp_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fp_update_users_updated_at BEFORE UPDATE ON fp_users
FOR EACH ROW EXECUTE FUNCTION fp_update_updated_at_column();

CREATE OR REPLACE FUNCTION fp_get_or_create_user(
  p_wallet_address TEXT,
  p_vault_address TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM fp_users WHERE wallet_address = p_wallet_address;
  IF v_user_id IS NULL THEN
    INSERT INTO fp_users (wallet_address, vault_address)
    VALUES (p_wallet_address, p_vault_address)
    RETURNING id INTO v_user_id;
  END IF;
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- More triggers...
CREATE OR REPLACE FUNCTION fp_update_user_stats_on_bet()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE fp_users
  SET total_bets_placed = total_bets_placed + 1,
      lifetime_wagered_lamports = lifetime_wagered_lamports + NEW.amount_lamports
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fp_trigger_update_user_stats_on_bet
AFTER INSERT ON fp_bets
FOR EACH ROW EXECUTE FUNCTION fp_update_user_stats_on_bet();

-- RLS Policies
ALTER TABLE fp_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fp_market_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fp_balances" ON fp_balances FOR SELECT USING (true);
CREATE POLICY "Public read fp_users" ON fp_users FOR SELECT USING (true);
CREATE POLICY "Public read fp_markets" ON fp_markets FOR SELECT USING (true);
CREATE POLICY "Public read fp_bets" ON fp_bets FOR SELECT USING (true);
CREATE POLICY "Public read fp_resolutions" ON fp_market_resolutions FOR SELECT USING (true);

-- NOTE: If you use this prefix version, you'll need to update ALL the API routes
-- to use fp_markets, fp_users, fp_bets instead of markets, users, bets
