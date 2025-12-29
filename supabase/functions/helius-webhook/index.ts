import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLY_TOKEN_MINT = Deno.env.get('POLY_TOKEN_MINT')!;
const DEPOSIT_WALLET_ADDRESS = Deno.env.get('DEPOSIT_WALLET_ADDRESS')!;
const HELIUS_WEBHOOK_SECRET = Deno.env.get('HELIUS_WEBHOOK_SECRET')!;

// Credits per POLY token (1 POLY = 1 credit)
const CREDITS_PER_POLY = 1;

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
      const signature = txData.signature;
      console.log(`[HeliusWebhook] Processing tx ${signature?.substring(0, 20)}...`);
      
      // Try tokenTransfers first
      let senderWallet: string | null = null;
      let amount = 0;
      
      const tokenTransfers = txData.tokenTransfers || [];
      for (const transfer of tokenTransfers) {
        if (transfer.mint === POLY_TOKEN_MINT && transfer.toUserAccount === DEPOSIT_WALLET_ADDRESS) {
          senderWallet = transfer.fromUserAccount;
          amount = transfer.tokenAmount || 0;
          console.log(`[HeliusWebhook] Found tokenTransfer: ${amount} POLY from ${senderWallet}`);
          break;
        }
      }
      
      // If no tokenTransfers match, try accountData.tokenBalanceChanges (Token-2022)
      if (!senderWallet || amount <= 0) {
        const accountData = txData.accountData || [];
        for (const account of accountData) {
          const balanceChanges = account.tokenBalanceChanges || [];
          for (const change of balanceChanges) {
            if (change.mint === POLY_TOKEN_MINT && change.userAccount === DEPOSIT_WALLET_ADDRESS) {
              const rawAmount = change.rawTokenAmount?.tokenAmount;
              const decimals = change.rawTokenAmount?.decimals || 6;
              if (rawAmount) {
                amount = parseFloat(rawAmount) / Math.pow(10, decimals);
                // For Token-2022, sender is the feePayer
                senderWallet = txData.feePayer;
                console.log(`[HeliusWebhook] Found Token-2022 balance change: ${amount} POLY, feePayer: ${senderWallet}`);
                break;
              }
            }
          }
          if (senderWallet && amount > 0) break;
        }
      }
      
      if (!senderWallet || amount <= 0) {
        console.log(`[HeliusWebhook] No valid POLY transfer in tx ${signature?.substring(0, 20)}`);
        continue;
      }
      
      // Check if this transaction has already been processed
      const { data: existingDeposit } = await supabase
        .from('credit_deposits')
        .select('id')
        .eq('tx_signature', signature)
        .maybeSingle();
      
      if (existingDeposit) {
        console.log(`[HeliusWebhook] ⚠️ Transaction already processed: ${signature}`);
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
        continue;
      }
      
      // Calculate credits (1 POLY = 1 credit)
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
          tx_signature: signature,
          status: 'confirmed'
        });
      
      if (depositError) {
        console.error('[HeliusWebhook] Error recording deposit:', depositError);
      }
      
      console.log(`[HeliusWebhook] ✅ Added ${creditsToAdd} credits to user ${userCredit.user_id}`);
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
