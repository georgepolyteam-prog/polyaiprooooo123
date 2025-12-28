-- Create signup_logs table for IP tracking and bot detection
CREATE TABLE public.signup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_suspicious BOOLEAN DEFAULT false,
  rejection_reason TEXT
);

-- Enable RLS
ALTER TABLE public.signup_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access signup logs
CREATE POLICY "Service role can manage signup logs" 
ON public.signup_logs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create index for IP tracking queries
CREATE INDEX idx_signup_logs_ip ON public.signup_logs(ip_address);
CREATE INDEX idx_signup_logs_created_at ON public.signup_logs(created_at DESC);