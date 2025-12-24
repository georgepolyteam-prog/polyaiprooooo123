// This function has been deprecated and does nothing
// It exists only to replace the old active version and stop resource consumption

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[DEPRECATED] update-cache function called but is no longer active');
  
  return new Response(
    JSON.stringify({ 
      deprecated: true, 
      message: 'This function has been disabled',
      timestamp: new Date().toISOString()
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  );
});
