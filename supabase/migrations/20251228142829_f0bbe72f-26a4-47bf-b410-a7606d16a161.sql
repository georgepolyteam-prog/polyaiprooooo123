-- Add missing indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_wallet ON user_credits(wallet_address);
CREATE INDEX IF NOT EXISTS idx_deposits_tx ON credit_deposits(tx_signature);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON credit_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_user ON credit_usage(user_id);