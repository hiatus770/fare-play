-- LMSR Prediction Market Schema
-- Run this in Supabase SQL Editor

-- Off-chain betting balance per wallet
CREATE TABLE IF NOT EXISTS balances (
  wallet TEXT PRIMARY KEY,
  balance_lamports BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT positive_balance CHECK (balance_lamports >= 0)
);

-- One row per prediction market
CREATE TABLE IF NOT EXISTS lmsr_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_tag TEXT NOT NULL,
  stop_tag TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  direction TEXT,
  predicted_eta_seconds INTEGER NOT NULL,
  q_early DOUBLE PRECISION NOT NULL DEFAULT 0,
  q_ontime DOUBLE PRECISION NOT NULL DEFAULT 0,
  q_late DOUBLE PRECISION NOT NULL DEFAULT 0,
  b DOUBLE PRECISION NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'cancelled')),
  resolved_outcome TEXT CHECK (resolved_outcome IN ('EARLY', 'ON_TIME', 'LATE')),
  error_seconds DOUBLE PRECISION,
  total_volume_lamports BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolution_source TEXT CHECK (resolution_source IN ('auto', 'admin'))
);

-- Individual share purchases
CREATE TABLE IF NOT EXISTS market_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES lmsr_markets(id),
  wallet TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('EARLY', 'ON_TIME', 'LATE')),
  shares DOUBLE PRECISION NOT NULL,
  cost_lamports BIGINT NOT NULL,
  payout_lamports BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_markets_status ON lmsr_markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_closes_at ON lmsr_markets(closes_at);
CREATE INDEX IF NOT EXISTS idx_trades_market ON market_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_wallet ON market_trades(wallet);

-- RPC: Atomic buy shares
-- Deducts balance, updates market quantities, inserts trade
CREATE OR REPLACE FUNCTION buy_shares(
  p_market_id UUID,
  p_wallet TEXT,
  p_outcome TEXT,
  p_shares DOUBLE PRECISION,
  p_cost_lamports BIGINT
) RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_balance BIGINT;
  v_market_status TEXT;
BEGIN
  -- Lock and check market is open
  SELECT status INTO v_market_status
    FROM lmsr_markets WHERE id = p_market_id FOR UPDATE;
  IF v_market_status IS NULL THEN
    RAISE EXCEPTION 'Market not found';
  END IF;
  IF v_market_status != 'open' THEN
    RAISE EXCEPTION 'Market is not open';
  END IF;

  -- Lock and check balance
  SELECT balance_lamports INTO v_balance
    FROM balances WHERE wallet = p_wallet FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_cost_lamports THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct balance
  UPDATE balances
    SET balance_lamports = balance_lamports - p_cost_lamports,
        updated_at = now()
    WHERE wallet = p_wallet;

  -- Update market quantities
  IF p_outcome = 'EARLY' THEN
    UPDATE lmsr_markets SET q_early = q_early + p_shares,
      total_volume_lamports = total_volume_lamports + p_cost_lamports
      WHERE id = p_market_id;
  ELSIF p_outcome = 'ON_TIME' THEN
    UPDATE lmsr_markets SET q_ontime = q_ontime + p_shares,
      total_volume_lamports = total_volume_lamports + p_cost_lamports
      WHERE id = p_market_id;
  ELSIF p_outcome = 'LATE' THEN
    UPDATE lmsr_markets SET q_late = q_late + p_shares,
      total_volume_lamports = total_volume_lamports + p_cost_lamports
      WHERE id = p_market_id;
  ELSE
    RAISE EXCEPTION 'Invalid outcome: %', p_outcome;
  END IF;

  -- Insert trade
  INSERT INTO market_trades (market_id, wallet, outcome, shares, cost_lamports)
    VALUES (p_market_id, p_wallet, p_outcome, p_shares, p_cost_lamports)
    RETURNING id INTO v_trade_id;

  RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: Atomic market resolution
-- Resolves market and credits winners
CREATE OR REPLACE FUNCTION resolve_market(
  p_market_id UUID,
  p_outcome TEXT,
  p_error_seconds DOUBLE PRECISION DEFAULT NULL,
  p_source TEXT DEFAULT 'auto'
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
BEGIN
  -- Lock and validate market
  PERFORM 1 FROM lmsr_markets WHERE id = p_market_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found or already resolved';
  END IF;

  -- Resolve market
  UPDATE lmsr_markets SET
    status = 'resolved',
    resolved_outcome = p_outcome,
    error_seconds = p_error_seconds,
    resolved_at = now(),
    resolution_source = p_source
    WHERE id = p_market_id;

  -- Credit winners: payout = shares (1 lamport per share unit)
  FOR v_trade IN
    SELECT id, wallet, shares FROM market_trades
      WHERE market_id = p_market_id AND outcome = p_outcome
  LOOP
    -- Set payout on trade
    UPDATE market_trades SET payout_lamports = FLOOR(v_trade.shares)
      WHERE id = v_trade.id;

    -- Credit wallet balance
    INSERT INTO balances (wallet, balance_lamports, updated_at)
      VALUES (v_trade.wallet, FLOOR(v_trade.shares), now())
      ON CONFLICT (wallet) DO UPDATE
        SET balance_lamports = balances.balance_lamports + FLOOR(v_trade.shares),
            updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies: public read, writes through service role (API routes)
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE lmsr_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read balances" ON balances FOR SELECT USING (true);
CREATE POLICY "Public read markets" ON lmsr_markets FOR SELECT USING (true);
CREATE POLICY "Public read trades" ON market_trades FOR SELECT USING (true);
