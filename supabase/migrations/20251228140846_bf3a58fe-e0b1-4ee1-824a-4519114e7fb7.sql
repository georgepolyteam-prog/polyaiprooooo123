-- Create user_credits table
CREATE TABLE public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT,
  credits_balance INTEGER DEFAULT 0,
  total_deposited INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create credit_deposits table
CREATE TABLE public.credit_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  amount INTEGER NOT NULL,
  tx_signature TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create credit_usage table
CREATE TABLE public.credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  credits_used INTEGER DEFAULT 1,
  message_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_user_credits_user ON public.user_credits(user_id);
CREATE INDEX idx_user_credits_wallet ON public.user_credits(wallet_address);
CREATE INDEX idx_deposits_tx ON public.credit_deposits(tx_signature);
CREATE INDEX idx_deposits_user ON public.credit_deposits(user_id);
CREATE INDEX idx_usage_user ON public.credit_usage(user_id);

-- Enable RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_credits
CREATE POLICY "Users can view own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credits" ON public.user_credits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credits" ON public.user_credits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all credits" ON public.user_credits
  FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for credit_deposits
CREATE POLICY "Users can view own deposits" ON public.credit_deposits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage deposits" ON public.credit_deposits
  FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for credit_usage
CREATE POLICY "Users can view own usage" ON public.credit_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage" ON public.credit_usage
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for user_credits
ALTER TABLE public.user_credits REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_credits;

-- Trigger for updated_at
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();