import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLY_TOKEN_MINT = Deno.env.get('POLY_TOKEN_MINT')!;
const DEPOSIT_WALLET_ADDRESS = Deno.env.get('DEPOSIT_WALLET_ADDRESS')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!;

// Credits per POLY token (1 POLY = 10 credits)
const CREDITS_PER_POLY = 10;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (req.method === 'POST') {
      const body = await req.json();
      const { action } = body;

      // Get deposit wallet address (for frontend)
      if (action === 'get-deposit-address') {
        console.log('Returning deposit wallet address');
        return new Response(
          JSON.stringify({ 
            depositAddress: DEPOSIT_WALLET_ADDRESS,
            tokenMint: POLY_TOKEN_MINT,
            creditsPerToken: CREDITS_PER_POLY
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify and process deposit
      if (action === 'verify-deposit') {
        const { txSignature, userId, walletAddress, amount } = body;

        if (!txSignature || !userId || !walletAddress || !amount) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Processing deposit: ${txSignature} for user ${userId}`);

        // Check if this transaction has already been processed
        const { data: existingDeposit } = await supabase
          .from('credit_deposits')
          .select('id')
          .eq('tx_signature', txSignature)
          .single();

        if (existingDeposit) {
          return new Response(
            JSON.stringify({ error: 'Transaction already processed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calculate credits
        const creditsToAdd = Math.floor(amount * CREDITS_PER_POLY);

        // Insert deposit record
        const { error: depositError } = await supabase
          .from('credit_deposits')
          .insert({
            user_id: userId,
            wallet_address: walletAddress,
            tx_signature: txSignature,
            amount: amount,
            status: 'pending'
          });

        if (depositError) {
          console.error('Error inserting deposit:', depositError);
          return new Response(
            JSON.stringify({ error: 'Failed to record deposit' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify the transaction on Solana (using Helius or public RPC)
        const rpcUrl = 'https://api.mainnet-beta.solana.com';
        
        try {
          const txResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getTransaction',
              params: [txSignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
            })
          });

          const txData = await txResponse.json();
          
          if (!txData.result) {
            console.log('Transaction not found or not confirmed yet');
            return new Response(
              JSON.stringify({ 
                status: 'pending',
                message: 'Transaction pending confirmation' 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Verify transaction details
          const tx = txData.result;
          const isConfirmed = tx.meta && !tx.meta.err;

          if (!isConfirmed) {
            await supabase
              .from('credit_deposits')
              .update({ status: 'failed' })
              .eq('tx_signature', txSignature);

            return new Response(
              JSON.stringify({ error: 'Transaction failed on chain' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Update deposit status to confirmed
          await supabase
            .from('credit_deposits')
            .update({ status: 'confirmed' })
            .eq('tx_signature', txSignature);

          // Update user credits
          const { data: userCredits } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (userCredits) {
            await supabase
              .from('user_credits')
              .update({
                credits_balance: (userCredits.credits_balance || 0) + creditsToAdd,
                total_deposited: (userCredits.total_deposited || 0) + amount
              })
              .eq('user_id', userId);
          } else {
            await supabase
              .from('user_credits')
              .insert({
                user_id: userId,
                wallet_address: walletAddress,
                credits_balance: creditsToAdd,
                total_deposited: amount
              });
          }

          console.log(`Successfully added ${creditsToAdd} credits for user ${userId}`);

          return new Response(
            JSON.stringify({ 
              success: true,
              creditsAdded: creditsToAdd,
              newBalance: (userCredits?.credits_balance || 0) + creditsToAdd
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (rpcError) {
          console.error('RPC error:', rpcError);
          return new Response(
            JSON.stringify({ 
              status: 'pending',
              message: 'Unable to verify transaction, will retry' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
