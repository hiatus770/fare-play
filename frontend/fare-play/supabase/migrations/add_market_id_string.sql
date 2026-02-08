-- Add market_id_string column to store the exact string used for PDA derivation
ALTER TABLE markets ADD COLUMN IF NOT EXISTS market_id_string TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_markets_id_string ON markets(market_id_string);
