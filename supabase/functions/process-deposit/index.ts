import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLY_TOKEN_MINT = Deno.env.get('POLY_TOKEN_MINT')!;
const DEPOSIT_WALLET_ADDRESS = Deno.env.get('DEPOSIT_WALLET_ADDRESS')!;
const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY')!;

// Credits per POLY token (1 POLY = 1 credit)
const CREDITS_PER_POLY = 1;

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

      // Find deposit using Helius Enhanced Transactions API (auto-detect)
      if (action === 'find-deposit') {
        const { walletAddress, minAmount, lookbackMinutes = 30 } = body;

        if (!walletAddress) {
          return new Response(
            JSON.stringify({ error: 'Missing wallet address' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[find-deposit] Searching for deposits from ${walletAddress}, min amount: ${minAmount}`);

        try {
          // Use Helius to get recent transactions for the deposit wallet
          const heliusUrl = `https://api.helius.xyz/v0/addresses/${DEPOSIT_WALLET_ADDRESS}/transactions?api-key=${HELIUS_API_KEY}&limit=20`;
          
          const response = await fetch(heliusUrl);
          const transactions = await response.json();

          if (!Array.isArray(transactions)) {
            console.log('[find-deposit] Invalid response from Helius:', transactions);
            return new Response(
              JSON.stringify({ found: false, message: 'Unable to fetch transactions' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log(`[find-deposit] Found ${transactions.length} recent transactions`);

          // Look for a matching transfer
          const cutoffTime = Date.now() - (lookbackMinutes * 60 * 1000);

          for (const tx of transactions) {
            // Skip if too old
            const txTime = (tx.timestamp || 0) * 1000;
            if (txTime < cutoffTime) continue;

            // Check token transfers
            const tokenTransfers = tx.tokenTransfers || [];
            for (const transfer of tokenTransfers) {
              if (
                transfer.mint === POLY_TOKEN_MINT &&
                transfer.toUserAccount === DEPOSIT_WALLET_ADDRESS &&
                transfer.fromUserAccount?.toLowerCase() === walletAddress.toLowerCase()
              ) {
                const amount = transfer.tokenAmount || 0;
                
                // Check if it meets minimum amount (with small tolerance)
                if (minAmount && amount < minAmount * 0.99) continue;

                // Check if already processed
                const { data: existingDeposit } = await supabase
                  .from('credit_deposits')
                  .select('id')
                  .eq('tx_signature', tx.signature)
                  .single();

                if (existingDeposit) {
                  console.log(`[find-deposit] Transaction ${tx.signature} already processed`);
                  continue;
                }

                console.log(`[find-deposit] Found matching deposit: ${tx.signature}, amount: ${amount}`);
                
                return new Response(
                  JSON.stringify({ 
                    found: true, 
                    signature: tx.signature,
                    amount: amount,
                    timestamp: txTime
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          }

          console.log('[find-deposit] No matching deposit found');
          return new Response(
            JSON.stringify({ found: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (heliusError) {
          console.error('[find-deposit] Helius API error:', heliusError);
          return new Response(
            JSON.stringify({ found: false, error: 'Failed to search transactions' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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

          // Use the verified transfer amount from Helius
          const transferAmount = validTransfer.tokenAmount || amount;

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

      // NOTE: Webhook handling is now done by the dedicated helius-webhook edge function
      // This function only handles get-deposit-address, find-deposit, and verify-deposit actions

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