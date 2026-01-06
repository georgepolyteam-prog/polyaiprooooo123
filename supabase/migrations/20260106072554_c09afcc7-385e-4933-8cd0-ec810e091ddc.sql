-- User-specific price alerts for Polymarket terminal
CREATE TABLE IF NOT EXISTS public.user_price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  market_slug TEXT NOT NULL,
  condition_id TEXT NOT NULL,
  token_id TEXT,
  market_title TEXT NOT NULL,
  market_image TEXT,
  target_price INTEGER NOT NULL,
  direction TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_at TIMESTAMPTZ,
  triggered_price INTEGER
);

-- Basic validation
ALTER TABLE public.user_price_alerts
  ADD CONSTRAINT user_price_alerts_target_price_range CHECK (target_price >= 0 AND target_price <= 100);

ALTER TABLE public.user_price_alerts
  ADD CONSTRAINT user_price_alerts_direction_check CHECK (direction IN ('above','below'));

CREATE INDEX IF NOT EXISTS idx_user_price_alerts_user_id ON public.user_price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_price_alerts_user_market ON public.user_price_alerts(user_id, market_slug);
CREATE INDEX IF NOT EXISTS idx_user_price_alerts_user_condition ON public.user_price_alerts(user_id, condition_id);

-- RLS
ALTER TABLE public.user_price_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_price_alerts' AND policyname='Users can view their own price alerts'
  ) THEN
    CREATE POLICY "Users can view their own price alerts"
    ON public.user_price_alerts
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_price_alerts' AND policyname='Users can create their own price alerts'
  ) THEN
    CREATE POLICY "Users can create their own price alerts"
    ON public.user_price_alerts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_price_alerts' AND policyname='Users can update their own price alerts'
  ) THEN
    CREATE POLICY "Users can update their own price alerts"
    ON public.user_price_alerts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_price_alerts' AND policyname='Users can delete their own price alerts'
  ) THEN
    CREATE POLICY "Users can delete their own price alerts"
    ON public.user_price_alerts
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_user_price_alerts_updated_at ON public.user_price_alerts;
CREATE TRIGGER set_user_price_alerts_updated_at
BEFORE UPDATE ON public.user_price_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
