import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLY_TOKEN_MINT = Deno.env.get('POLY_TOKEN_MINT')!;
const DEPOSIT_WALLET_ADDRESS = Deno.env.get('DEPOSIT_WALLET_ADDRESS')!;
const HELIUS_WEBHOOK_SECRET = Deno.env.get('HELIUS_WEBHOOK_SECRET')!;

// Credits per POLY token (1 POLY = 10 credits)
const CREDITS_PER_POLY = 10;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[HeliusWebhook] Received request');

  try {
    // Verify Authorization header from Helius
    const authHeader = req.headers.get('authorization');
    const expectedAuth = `Bearer ${HELIUS_WEBHOOK_SECRET}`;
    
    if (authHeader !== expectedAuth) {
      console.error('[HeliusWebhook] ❌ Invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[HeliusWebhook] ✅ Authorization verified');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const webhookData = await req.json();
    
    // Helius sends array of transactions
    const transactions = Array.isArray(webhookData) ? webhookData : [webhookData];
    
    console.log(`[HeliusWebhook] Processing ${transactions.length} transaction(s)`);

    for (const txData of transactions) {
      const tokenTransfers = txData.tokenTransfers || [];
      const signature = txData.signature;
      
      console.log(`[HeliusWebhook] Transaction ${signature?.substring(0, 20)}... has ${tokenTransfers.length} token transfers`);
      
      for (const transfer of tokenTransfers) {
        // Debug logging for each transfer
        console.log(`[HeliusWebhook] Transfer details:`, {
          receivedMint: transfer.mint,
          expectedMint: POLY_TOKEN_MINT,
          mintMatch: transfer.mint === POLY_TOKEN_MINT,
          receivedTo: transfer.toUserAccount,
          expectedTo: DEPOSIT_WALLET_ADDRESS,
          toMatch: transfer.toUserAccount === DEPOSIT_WALLET_ADDRESS,
          amount: transfer.tokenAmount
        });
        
        // Check if it's POLY token to our deposit wallet
        if (
          transfer.mint === POLY_TOKEN_MINT &&
          transfer.toUserAccount === DEPOSIT_WALLET_ADDRESS
        ) {
          const senderWallet = transfer.fromUserAccount;
          const txSignature = signature;
          
          // Helius tokenAmount is already in human-readable format (not raw)
          // Just use it directly
          const amount = transfer.tokenAmount || 0;
          
          console.log(`[HeliusWebhook] 💰 Deposit detected: ${amount} POLY from ${senderWallet}`);
          
          if (amount <= 0) {
            console.log('[HeliusWebhook] ⚠️ Zero or negative amount, skipping');
            continue;
          }
          
          // Check if this transaction has already been processed
          const { data: existingDeposit } = await supabase
            .from('credit_deposits')
            .select('id')
            .eq('tx_signature', txSignature)
            .maybeSingle();
          
          if (existingDeposit) {
            console.log(`[HeliusWebhook] ⚠️ Transaction already processed: ${txSignature}`);
            continue;
          }
          
          // Find user by wallet address
          const { data: userCredit, error: userError } = await supabase
            .from('user_credits')
            .select('user_id, credits_balance, total_deposited')
            .eq('wallet_address', senderWallet)
            .single();
          
          if (userError || !userCredit) {
            console.log(`[HeliusWebhook] ❌ No user found for wallet: ${senderWallet}`);
            console.log('[HeliusWebhook] User must link their Solana wallet first on /credits page');
            continue;
          }
          
          // Calculate credits (1 POLY = 10 credits)
          const creditsToAdd = Math.floor(amount * CREDITS_PER_POLY);
          const newBalance = (userCredit.credits_balance || 0) + creditsToAdd;
          
          console.log(`[HeliusWebhook] Adding ${creditsToAdd} credits to user ${userCredit.user_id}`);
          
          // Update user credits
          const { error: updateError } = await supabase
            .from('user_credits')
            .update({
              credits_balance: newBalance,
              total_deposited: (userCredit.total_deposited || 0) + amount
            })
            .eq('user_id', userCredit.user_id);
          
          if (updateError) {
            console.error('[HeliusWebhook] Error updating credits:', updateError);
            continue;
          }
          
          // Record deposit
          const { error: depositError } = await supabase
            .from('credit_deposits')
            .insert({
              user_id: userCredit.user_id,
              wallet_address: senderWallet,
              amount: amount,
              tx_signature: txSignature,
              status: 'confirmed'
            });
          
          if (depositError) {
            console.error('[HeliusWebhook] Error recording deposit:', depositError);
            // Continue anyway since credits were already updated
          }
          
          console.log(`[HeliusWebhook] ✅ Successfully added ${creditsToAdd} credits to user ${userCredit.user_id}`);
        }
      }
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[HeliusWebhook] Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
