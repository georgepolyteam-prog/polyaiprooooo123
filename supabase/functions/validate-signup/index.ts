import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory rate limiting (resets on function cold start)
const signupAttempts = new Map<string, { count: number; lastReset: number }>();

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms
const MAX_SIGNUPS_PER_IP = 3;

// Disposable email domains
const disposableDomains = new Set([
  'tempmail.com', 'throwaway.com', 'guerrillamail.com', 'mailinator.com',
  'yopmail.com', '10minutemail.com', 'temp-mail.org', 'fakeinbox.com',
  'trashmail.com', 'getnada.com', 'mailnesia.com', 'dispostable.com',
  'tempinbox.com', 'mailcatch.com', 'mintemail.com', 'tempmailaddress.com',
  'throwawaymail.com', 'sharklasers.com', 'spam4.me', 'grr.la',
  'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de',
  'pokemail.net', 'tempail.com', 'mohmal.com', 'maildrop.cc'
]);

// Bot email patterns
const botPatterns = [
  /^[a-z]+[0-9]{3,}[a-z]+@/i,
  /^[a-z]+\.[0-9]{3,}\.[a-z]+@/i,
  /^[a-z]+_[0-9]{3,}_?[a-z]+@/i,
  /^[a-z]{2,}[0-9]{4,}@/i,
  /^[0-9]+[a-z]+[0-9]+@/i,
];

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = signupAttempts.get(ip);
  
  if (!attempts || now - attempts.lastReset > RATE_LIMIT_WINDOW) {
    signupAttempts.set(ip, { count: 1, lastReset: now });
    return false;
  }
  
  if (attempts.count >= MAX_SIGNUPS_PER_IP) {
    return true;
  }
  
  attempts.count++;
  return false;
}

function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailLower = email.toLowerCase().trim();
  const domain = emailLower.split('@')[1];
  
  if (disposableDomains.has(domain)) {
    return { valid: false, error: 'Please use a permanent email address' };
  }
  
  for (const pattern of botPatterns) {
    if (pattern.test(emailLower)) {
      return { valid: false, error: 'Invalid email format' };
    }
  }
  
  return { valid: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const ip = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check rate limiting
    if (isRateLimited(ip)) {
      // Log suspicious activity
      await supabase.from('signup_logs').insert({
        email,
        ip_address: ip,
        user_agent: userAgent,
        is_suspicious: true,
        rejection_reason: 'rate_limited'
      });

      return new Response(
        JSON.stringify({ allowed: false, error: 'Too many signup attempts. Please try again later.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      await supabase.from('signup_logs').insert({
        email,
        ip_address: ip,
        user_agent: userAgent,
        is_suspicious: true,
        rejection_reason: emailValidation.error
      });

      return new Response(
        JSON.stringify({ allowed: false, error: emailValidation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check for velocity abuse (5+ signups from same IP in last hour)
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW).toISOString();
    const { count } = await supabase
      .from('signup_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gte('created_at', oneHourAgo);

    if (count && count >= 5) {
      await supabase.from('signup_logs').insert({
        email,
        ip_address: ip,
        user_agent: userAgent,
        is_suspicious: true,
        rejection_reason: 'velocity_abuse'
      });

      return new Response(
        JSON.stringify({ allowed: false, error: 'Too many signups from your network. Please try again later.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      );
    }

    // Log valid signup attempt
    await supabase.from('signup_logs').insert({
      email,
      ip_address: ip,
      user_agent: userAgent,
      is_suspicious: false
    });

    return new Response(
      JSON.stringify({ allowed: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validate signup error:', error);
    return new Response(
      JSON.stringify({ allowed: true }), // Allow on error to not block legitimate users
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
