import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLY_TOKEN_MINT = Deno.env.get('POLY_TOKEN_MINT')!;
const DEPOSIT_WALLET_ADDRESS = Deno.env.get('DEPOSIT_WALLET_ADDRESS')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!;
const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY')!;

// Credits per POLY token (1 POLY = 10 credits)
const CREDITS_PER_POLY = 10;
const MIN_DEPOSIT = 100;

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
            creditsPerToken: CREDITS_PER_POLY,
            minDeposit: MIN_DEPOSIT
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify and process deposit using Helius API
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

        // Verify the transaction using Helius API
        const heliusUrl = `https://api.helius.xyz/v0/transactions/?api-key=${HELIUS_API_KEY}`;
        
        try {
          const txResponse = await fetch(heliusUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactions: [txSignature]
            })
          });

          const txData = await txResponse.json();
          
          if (!txData || txData.length === 0) {
            console.log('Transaction not found or not confirmed yet');
            return new Response(
              JSON.stringify({ 
                status: 'pending',
                message: 'Transaction pending confirmation. Please wait a moment and try again.' 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const tx = txData[0];
          
          // Check for token transfers
          const tokenTransfers = tx.tokenTransfers || [];
          let validTransfer = null;

          for (const transfer of tokenTransfers) {
            if (
              transfer.mint === POLY_TOKEN_MINT &&
              transfer.toUserAccount === DEPOSIT_WALLET_ADDRESS &&
              transfer.fromUserAccount === walletAddress
            ) {
              validTransfer = transfer;
              break;
            }
          }

          if (!validTransfer) {
            console.log('No valid POLY transfer found in transaction');
            return new Response(
              JSON.stringify({ error: 'No valid POLY token transfer found in this transaction' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Verify amount matches (with some tolerance for decimals)
          const transferAmount = validTransfer.tokenAmount || amount;
          
          if (transferAmount < MIN_DEPOSIT) {
            return new Response(
              JSON.stringify({ error: `Minimum deposit is ${MIN_DEPOSIT} POLY` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Calculate credits
          const creditsToAdd = Math.floor(transferAmount * CREDITS_PER_POLY);

          // Insert deposit record
          const { error: depositError } = await supabase
            .from('credit_deposits')
            .insert({
              user_id: userId,
              wallet_address: walletAddress,
              tx_signature: txSignature,
              amount: transferAmount,
              status: 'confirmed'
            });

          if (depositError) {
            console.error('Error inserting deposit:', depositError);
            return new Response(
              JSON.stringify({ error: 'Failed to record deposit' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Update user credits
          const { data: userCredits } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', userId)
            .single();

          let newBalance = creditsToAdd;
          
          if (userCredits) {
            newBalance = (userCredits.credits_balance || 0) + creditsToAdd;
            await supabase
              .from('user_credits')
              .update({
                credits_balance: newBalance,
                total_deposited: (userCredits.total_deposited || 0) + transferAmount,
                wallet_address: walletAddress
              })
              .eq('user_id', userId);
          } else {
            await supabase
              .from('user_credits')
              .insert({
                user_id: userId,
                wallet_address: walletAddress,
                credits_balance: creditsToAdd,
                total_deposited: transferAmount
              });
          }

          console.log(`Successfully added ${creditsToAdd} credits for user ${userId}`);

          return new Response(
            JSON.stringify({ 
              success: true,
              creditsAdded: creditsToAdd,
              newBalance: newBalance
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (heliusError) {
          console.error('Helius API error:', heliusError);
          return new Response(
            JSON.stringify({ 
              status: 'pending',
              message: 'Unable to verify transaction. Please try again in a moment.' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Webhook handler for Helius (automatic deposit detection)
      if (action === 'webhook') {
        const authHeader = req.headers.get('x-webhook-secret');
        
        if (authHeader !== WEBHOOK_SECRET) {
          console.error('Invalid webhook secret');
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const transactions = Array.isArray(body.data) ? body.data : [body.data];
        
        for (const txData of transactions) {
          const tokenTransfers = txData.tokenTransfers || [];
          
          for (const transfer of tokenTransfers) {
            if (
              transfer.mint === POLY_TOKEN_MINT &&
              transfer.toUserAccount === DEPOSIT_WALLET_ADDRESS
            ) {
              const transferAmount = Math.floor(transfer.tokenAmount);
              const senderWallet = transfer.fromUserAccount;
              const txSignature = txData.signature;
              
              console.log(`Webhook: Deposit detected - ${transferAmount} POLY from ${senderWallet}`);
              
              if (transferAmount < MIN_DEPOSIT) {
                console.log('Deposit below minimum:', transferAmount);
                continue;
              }
              
              // Find user by wallet address
              const { data: userCredit } = await supabase
                .from('user_credits')
                .select('user_id, credits_balance, total_deposited')
                .eq('wallet_address', senderWallet)
                .single();
              
              if (!userCredit) {
                console.log('No user found for wallet:', senderWallet);
                continue;
              }
              
              // Check if transaction already processed
              const { data: existing } = await supabase
                .from('credit_deposits')
                .select('id')
                .eq('tx_signature', txSignature)
                .maybeSingle();
                
              if (existing) {
                console.log('Transaction already processed:', txSignature);
                continue;
              }
              
              const creditsToAdd = transferAmount * CREDITS_PER_POLY;
              const newBalance = (userCredit.credits_balance || 0) + creditsToAdd;
              
              // Update user credits
              await supabase
                .from('user_credits')
                .update({
                  credits_balance: newBalance,
                  total_deposited: (userCredit.total_deposited || 0) + transferAmount
                })
                .eq('user_id', userCredit.user_id);
              
              // Record deposit
              await supabase
                .from('credit_deposits')
                .insert({
                  user_id: userCredit.user_id,
                  wallet_address: senderWallet,
                  amount: transferAmount,
                  tx_signature: txSignature,
                  status: 'confirmed'
                });
              
              console.log(`Webhook: Added ${creditsToAdd} credits to user ${userCredit.user_id}`);
            }
          }
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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