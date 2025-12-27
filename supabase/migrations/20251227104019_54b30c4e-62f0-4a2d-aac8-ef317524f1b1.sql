-- Create tracked_wallets table for wallet tracking feature
CREATE TABLE public.tracked_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, wallet_address)
);

-- Enable RLS
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user-only access
CREATE POLICY "Users can view their tracked wallets"
  ON public.tracked_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their tracked wallets"
  ON public.tracked_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their tracked wallets"
  ON public.tracked_wallets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their tracked wallets"
  ON public.tracked_wallets FOR DELETE
  USING (auth.uid() = user_id);