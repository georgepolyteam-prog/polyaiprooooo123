-- Create table for storing arbitrage opportunities
CREATE TABLE public.arb_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_key TEXT NOT NULL,
  event_title TEXT NOT NULL,
  sport TEXT,
  kalshi_ticker TEXT NOT NULL,
  polymarket_slug TEXT NOT NULL,
  polymarket_token_id TEXT,
  spread_percent NUMERIC NOT NULL,
  buy_platform TEXT NOT NULL,
  buy_price INTEGER NOT NULL,
  sell_platform TEXT NOT NULL,
  sell_price INTEGER NOT NULL,
  buy_volume NUMERIC,
  sell_volume NUMERIC,
  expires_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.arb_opportunities ENABLE ROW LEVEL SECURITY;

-- Public read access for opportunities
CREATE POLICY "Anyone can read arb opportunities"
  ON public.arb_opportunities
  FOR SELECT
  USING (true);

-- Service role can manage
CREATE POLICY "Service role can manage arb opportunities"
  ON public.arb_opportunities
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create table for user arbitrage alerts
CREATE TABLE public.arb_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'spread_threshold',
  sport TEXT,
  min_spread_percent NUMERIC DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.arb_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
CREATE POLICY "Users can view their own arb alerts"
  ON public.arb_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own alerts
CREATE POLICY "Users can create their own arb alerts"
  ON public.arb_alerts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own alerts
CREATE POLICY "Users can update their own arb alerts"
  ON public.arb_alerts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own alerts
CREATE POLICY "Users can delete their own arb alerts"
  ON public.arb_alerts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all
CREATE POLICY "Service role can manage arb alerts"
  ON public.arb_alerts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_arb_opportunities_sport ON public.arb_opportunities(sport);
CREATE INDEX idx_arb_opportunities_spread ON public.arb_opportunities(spread_percent DESC);
CREATE INDEX idx_arb_opportunities_active ON public.arb_opportunities(is_active);
CREATE INDEX idx_arb_alerts_user ON public.arb_alerts(user_id);
CREATE INDEX idx_arb_alerts_active ON public.arb_alerts(is_active);

-- Add trigger for updated_at on arb_opportunities
CREATE TRIGGER update_arb_opportunities_updated_at
  BEFORE UPDATE ON public.arb_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on arb_alerts
CREATE TRIGGER update_arb_alerts_updated_at
  BEFORE UPDATE ON public.arb_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();