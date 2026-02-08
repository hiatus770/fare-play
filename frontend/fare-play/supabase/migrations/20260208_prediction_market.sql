-- FarePlay Prediction Market Schema
-- This schema tracks betting markets, bets, and payouts
-- All SOL funds are stored on-chain in Solana vaults
-- This database only tracks state and metadata

-- Users table: Track wallet addresses and stats
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  vault_address TEXT UNIQUE NOT NULL,  -- Solana vault PDA
  total_bets_placed INTEGER DEFAULT 0,
  total_markets_won INTEGER DEFAULT 0,
  lifetime_wagered_lamports BIGINT DEFAULT 0,
  lifetime_winnings_lamports BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_vault ON users(vault_address);

-- Markets table: Track prediction markets for bus arrivals
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_vault_address TEXT UNIQUE NOT NULL,  -- Solana escrow PDA

  -- TTC data
  route TEXT NOT NULL,
  stop_tag TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  freeze_time TIMESTAMPTZ NOT NULL,  -- Betting closes (prediction - 5min)
  predicted_arrival_seconds INTEGER NOT NULL,  -- TTC's prediction at creation
  actual_arrival_seconds INTEGER,  -- Verified from TTC backend

  -- State
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'RESOLVED', 'CANCELLED')),
  total_pool_lamports BIGINT DEFAULT 0,
  bet_count INTEGER DEFAULT 0,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_signature TEXT,  -- Solana tx signature for payout distribution

  UNIQUE(route, stop_tag, vehicle_id, created_at)
);

CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_vehicle ON markets(vehicle_id, route, stop_tag);
CREATE INDEX idx_markets_freeze ON markets(freeze_time);
CREATE INDEX idx_markets_created ON markets(created_at DESC);

-- Bets table: Individual user bets in markets
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,

  -- Bet details
  predicted_arrival_seconds INTEGER NOT NULL,
  amount_lamports BIGINT NOT NULL CHECK (amount_lamports > 0),
  placement_signature TEXT NOT NULL,  -- Solana tx signature

  -- Outcome (filled after resolution)
  error_seconds INTEGER,  -- Abs(predicted - actual)
  accuracy_score REAL,  -- 1 / (1 + error_seconds) for proportional calc
  payout_lamports BIGINT DEFAULT 0,
  payout_signature TEXT,  -- Solana tx signature for payout

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(market_id, user_id)
);

CREATE INDEX idx_bets_market ON bets(market_id);
CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_wallet ON bets(wallet_address);
CREATE INDEX idx_bets_created ON bets(created_at DESC);

-- Market resolutions table: Detailed resolution data
CREATE TABLE IF NOT EXISTS market_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,

  -- Resolution data
  actual_arrival_seconds INTEGER NOT NULL,
  total_payout_lamports BIGINT NOT NULL,
  winner_count INTEGER NOT NULL,

  -- Proportional calculation details
  total_accuracy_score REAL NOT NULL,  -- Sum of all accuracy scores

  resolved_at TIMESTAMPTZ DEFAULT NOW(),
  resolution_signature TEXT NOT NULL,  -- Main distribution tx

  UNIQUE(market_id)
);

CREATE INDEX idx_resolutions_market ON market_resolutions(market_id);
CREATE INDEX idx_resolutions_resolved ON market_resolutions(resolved_at DESC);

-- Trigger to update users.updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get user's vault address from wallet
CREATE OR REPLACE FUNCTION get_or_create_user(
  p_wallet_address TEXT,
  p_vault_address TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Try to find existing user
  SELECT id INTO v_user_id
  FROM users
  WHERE wallet_address = p_wallet_address;

  -- If not found, create new user
  IF v_user_id IS NULL THEN
    INSERT INTO users (wallet_address, vault_address)
    VALUES (p_wallet_address, p_vault_address)
    RETURNING id INTO v_user_id;
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update user stats after bet placement
CREATE OR REPLACE FUNCTION update_user_stats_on_bet()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET
    total_bets_placed = total_bets_placed + 1,
    lifetime_wagered_lamports = lifetime_wagered_lamports + NEW.amount_lamports
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats_on_bet
AFTER INSERT ON bets
FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_bet();

-- Function to update user stats after payout
CREATE OR REPLACE FUNCTION update_user_stats_on_payout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payout_lamports > 0 AND OLD.payout_lamports = 0 THEN
    UPDATE users
    SET
      total_markets_won = total_markets_won + 1,
      lifetime_winnings_lamports = lifetime_winnings_lamports + NEW.payout_lamports
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats_on_payout
AFTER UPDATE ON bets
FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_payout();

-- Function to update market stats when bet placed
CREATE OR REPLACE FUNCTION update_market_stats_on_bet()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE markets
  SET
    total_pool_lamports = total_pool_lamports + NEW.amount_lamports,
    bet_count = bet_count + 1
  WHERE id = NEW.market_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_market_stats_on_bet
AFTER INSERT ON bets
FOR EACH ROW EXECUTE FUNCTION update_market_stats_on_bet();

-- View for active markets with bet stats
CREATE OR REPLACE VIEW active_markets_with_stats AS
SELECT
  m.*,
  COUNT(b.id) as current_bet_count,
  SUM(b.amount_lamports) as current_pool_lamports,
  MIN(b.predicted_arrival_seconds) as min_prediction,
  MAX(b.predicted_arrival_seconds) as max_prediction,
  AVG(b.predicted_arrival_seconds) as avg_prediction
FROM markets m
LEFT JOIN bets b ON m.id = b.market_id
WHERE m.status IN ('ACTIVE', 'FROZEN')
GROUP BY m.id;

-- View for user leaderboard
CREATE OR REPLACE VIEW user_leaderboard AS
SELECT
  wallet_address,
  total_bets_placed,
  total_markets_won,
  lifetime_wagered_lamports,
  lifetime_winnings_lamports,
  CASE
    WHEN total_bets_placed > 0
    THEN (total_markets_won::REAL / total_bets_placed::REAL) * 100
    ELSE 0
  END as win_percentage,
  CASE
    WHEN lifetime_wagered_lamports > 0
    THEN ((lifetime_winnings_lamports::REAL - lifetime_wagered_lamports::REAL) / lifetime_wagered_lamports::REAL) * 100
    ELSE 0
  END as roi_percentage
FROM users
WHERE total_bets_placed > 0
ORDER BY lifetime_winnings_lamports DESC;

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts with wallet addresses and lifetime statistics';
COMMENT ON TABLE markets IS 'Prediction markets for TTC bus/streetcar arrivals';
COMMENT ON TABLE bets IS 'Individual user bets in prediction markets';
COMMENT ON TABLE market_resolutions IS 'Detailed resolution data for completed markets';
COMMENT ON COLUMN markets.status IS 'ACTIVE: accepting bets, FROZEN: betting closed, RESOLVED: payouts distributed, CANCELLED: refunds issued';
COMMENT ON COLUMN bets.accuracy_score IS 'Proportional payout weight: 1 / (1 + error_seconds)';
