-- Create table for storing Polymarket API credentials
CREATE TABLE public.polymarket_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  api_passphrase TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.polymarket_credentials ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all credentials (for edge functions)
CREATE POLICY "Service role can manage credentials"
  ON public.polymarket_credentials
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_polymarket_credentials_updated_at
  BEFORE UPDATE ON public.polymarket_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();