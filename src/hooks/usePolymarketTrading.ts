import { useState, useCallback } from "react";
import { useAccount, useChainId, useSwitchChain, usePublicClient } from "wagmi";
import { toast } from "sonner";
import { ethers } from "ethers";
import {
  ClobClient,
  Side,
  OrderType,
  AssetType,
  type OpenOrder,
  type BalanceAllowanceResponse,
} from "@polymarket/clob-client";
import { BuilderConfig } from "@polymarket/builder-signing-sdk";
import { useUSDCBalance } from "./useUSDCBalance";
import { usePolymarketApiCreds } from "./usePolymarketApiCreds";
import { useSafeWallet } from "./useSafeWallet";

const POLYGON_CHAIN_ID = 137;
const CLOB_HOST = "https://clob.polymarket.com";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Conditional Tokens (ERC1155) contracts on Polygon
// Regular markets use CTF_CONTRACT, negative risk markets use NEG_RISK_ADAPTER
const CTF_CONTRACT = "0x4d97dcd97ec945f40cf65f87097ace5ea0476045" as const;
const NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296" as const;
const SHARES_DECIMALS = 6;

const erc1155BalanceAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const MIN_ORDER_SIZE = 5; // Polymarket minimum order size

export type TradeParams = {
  tokenId: string;
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  marketSlug?: string;
  eventSlug?: string;
  isMarketOrder?: boolean; // If true, uses FAK for immediate fill with partial fills allowed
};

interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  result?: unknown;
}

// Normalize price to avoid floating point errors and ensure valid range
function normalizePrice(price: number): number {
  const rounded = Math.round(price * 100) / 100;
  const clamped = Math.max(0.01, Math.min(0.99, rounded));
  console.log(`[Trade] Price ${price} normalized to ${clamped}`);
  return clamped;
}

function parseNumericString(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export function usePolymarketTrading() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID });
  const { hasSufficientBalance, isFullyApproved, approveUSDC } = useUSDCBalance();
  const { getApiCreds, clearApiCreds, isLoadingApiCreds } = usePolymarketApiCreds();
  const { safeAddress, isDeployed, hasAllowances, deploySafe, isDeploying } = useSafeWallet();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);
  const [clobClient, setClobClient] = useState<ClobClient | null>(null);

  const isOnPolygon = chainId === POLYGON_CHAIN_ID;

  const switchToPolygon = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: POLYGON_CHAIN_ID });
      return true;
    } catch (error) {
      console.error("Network switch error:", error);
      toast.error("Failed to switch to Polygon network");
      return false;
    }
  }, [switchChainAsync]);

  const getOrCreateClient = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected");
    }

    if (clobClient) return clobClient;

    const provider = new ethers.providers.Web3Provider(
      window.ethereum as ethers.providers.ExternalProvider
    );
    const signer = provider.getSigner();

    console.log("[Trade] Initializing API credentials...");
    const creds = await getApiCreds();

    if (!creds || !creds.apiKey || !creds.secret || !creds.passphrase) {
      throw new Error("Failed to initialize trading. Please try again.");
    }

    // For EOA (signatureType 0), funderAddress should be the EOA itself
    // For Safe (signatureType 2), funderAddress is the Safe address
    const useSafe = isDeployed && safeAddress;
    const signatureType = useSafe ? 2 : 0;
    const funderAddress = useSafe ? safeAddress : address;

    const apiKeyCreds = {
      key: creds.apiKey,
      secret: creds.secret,
      passphrase: creds.passphrase,
    };

    // Keep builder config for attribution; only remove testing utilities.
    const builderConfig = new BuilderConfig({
      remoteBuilderConfig: {
        url: `${SUPABASE_URL}/functions/v1/builder-sign`,
      },
    });

    console.log("[Trade] Creating ClobClient with L2 auth...");
    const client = new ClobClient(
      CLOB_HOST,
      POLYGON_CHAIN_ID,
      signer,
      apiKeyCreds,
      signatureType,
      funderAddress,
      undefined,
      undefined,
      builderConfig
    );

    setClobClient(client);
    return client;
  }, [address, clobClient, getApiCreds, isConnected, isDeployed, safeAddress]);

  const getOpenOrders = useCallback(async (): Promise<OpenOrder[]> => {
    try {
      const client = await getOrCreateClient();
      // The SDK already handles pagination internally. We fetch only the first page for speed.
      const orders = await client.getOpenOrders(undefined, true);
      return orders || [];
    } catch (error) {
      console.error("Error fetching open orders:", error);
      return [];
    }
  }, [getOrCreateClient]);

  const cancelOrder = useCallback(
    async (orderId: string) => {
      try {
        const client = await getOrCreateClient();
        const result = await client.cancelOrder({ orderID: orderId });
        return result;
      } catch (error) {
        console.error("Error cancelling order:", error);
        throw error;
      }
    },
    [getOrCreateClient]
  );

  const placeOrder = useCallback(
    async (params: TradeParams): Promise<OrderResult> => {
      if (!isConnected || !address) {
        toast.error("Please connect your wallet first");
        return { success: false, error: "Wallet not connected" };
      }

      setIsPlacingOrder(true);
      setLastOrderResult(null);

      try {
        // Step 1: Switch network if needed (placing orders requires Polygon)
        if (!isOnPolygon) {
          toast.info("Switching to Polygon network...");
          const switched = await switchToPolygon();
          if (!switched) {
            return { success: false, error: "Failed to switch network" };
          }
        }

        // Step 2: Check balance (only for BUY orders - selling doesn't require USDC)
        if (params.side === "BUY" && !hasSufficientBalance(params.amount)) {
          toast.error("Insufficient USDC balance");
          return { success: false, error: "Insufficient balance" };
        }

        // Step 2b: Check minimum order size
        const estimatedSize = params.amount / params.price;
        if (estimatedSize < MIN_ORDER_SIZE) {
          toast.error(`Minimum order size is ${MIN_ORDER_SIZE} shares`);
          return {
            success: false,
            error: `Minimum order size is ${MIN_ORDER_SIZE} shares`,
          };
        }

        // Step 3: Check/request approval
        // For Safe wallets, use hasAllowances from relay (already set in TradePanel Step 4)
        // For EOA wallets, use isFullyApproved from wagmi
        const allApprovalsComplete = isDeployed ? hasAllowances : isFullyApproved;
        
        if (!allApprovalsComplete) {
          // For Safe wallets, this shouldn't happen as allowances are set via relay
          if (isDeployed) {
            toast.error("Please set allowances first (Step 4 in TradePanel)");
            return { success: false, error: "Allowances not set" };
          }
          // For EOA wallets, try wagmi approval
          toast.info("Approving tokens...");
          const approved = await approveUSDC();
          if (!approved) {
            return { success: false, error: "Approval failed" };
          }
        }

        // Step 4: Create/reuse CLOB client
        const client = await getOrCreateClient();

        // Step 5: Fetch market parameters dynamically (CRITICAL for correct signatures)
        console.log("[Trade] Fetching market parameters for tokenId:", params.tokenId);
        const [negRisk, tickSize] = await Promise.all([
          client.getNegRisk(params.tokenId),
          client.getTickSize(params.tokenId),
        ]);
        console.log(`[Trade] Market params: negRisk=${negRisk}, tickSize=${tickSize}`);

        // Step 6: Normalize price and calculate size
        const validatedPrice = normalizePrice(params.price);
        let size = Math.round((params.amount / validatedPrice) * 100) / 100;

        if (size < MIN_ORDER_SIZE) {
          throw new Error(
            `Order size ${size.toFixed(2)} is below minimum of ${MIN_ORDER_SIZE} shares`
          );
        }

        // Step 7: SELL-specific checks (on-chain balance + allowance sync)
        if (params.side === "SELL") {
          toast.info("Checking share balance...");

          // Verify actual on-chain ERC1155 balance for this conditional token
          // CRITICAL: Use the correct contract based on negRisk status
          // Regular markets: CTF_CONTRACT
          // Negative risk markets: NEG_RISK_ADAPTER
          if (publicClient) {
            try {
              const funderAddress = isDeployed && safeAddress ? safeAddress : address;
              const tokenContract = negRisk ? NEG_RISK_ADAPTER : CTF_CONTRACT;
              
              console.log(`[Trade] Checking balance on ${negRisk ? 'NEG_RISK_ADAPTER' : 'CTF_CONTRACT'}: ${tokenContract}`);
              
              const rawBalance = await publicClient.readContract({
                address: tokenContract,
                abi: erc1155BalanceAbi,
                functionName: "balanceOf",
                args: [funderAddress as `0x${string}`, BigInt(params.tokenId)],
              } as any);

              const onChainShares = Number(rawBalance) / 10 ** SHARES_DECIMALS;
              console.log(`[Trade] On-chain balance: ${onChainShares} shares, need: ${size} shares`);
              
              // Auto-cap size to actual balance when within 1% tolerance (handles precision issues)
              if (Number.isFinite(onChainShares)) {
                if (onChainShares < size) {
                  const diff = size - onChainShares;
                  const percentDiff = diff / size;
                  const TOLERANCE = 0.01; // 1% tolerance for "sell all" scenarios
                  
                  if (percentDiff <= TOLERANCE) {
                    console.log(`[Trade] Auto-capping size from ${size} to ${onChainShares} (diff: ${(percentDiff * 100).toFixed(2)}%)`);
                    size = onChainShares;
                  } else {
                    throw new Error(`Not enough shares to sell. Have: ${onChainShares.toFixed(2)}, Need: ${size.toFixed(2)}`);
                  }
                }
                // Floor to 6 decimals to match contract precision
                size = Math.floor(size * 10 ** SHARES_DECIMALS) / 10 ** SHARES_DECIMALS;
                console.log(`[Trade] Final sell size (floored): ${size}`);
              }
            } catch (balanceError) {
              // If we explicitly detected insufficient shares, bubble it up.
              if (balanceError instanceof Error && balanceError.message.includes("Not enough shares to sell")) {
                throw balanceError;
              }
              console.warn("[Trade] Could not fetch on-chain conditional token balance:", balanceError);
            }
          }

          try {
            // Sync off-chain allowance/balance tracking (best-effort)
            await client.updateBalanceAllowance({
              asset_type: AssetType.CONDITIONAL,
              token_id: params.tokenId,
            });
          } catch (allowanceError) {
            console.warn("[Trade] Could not sync balance allowance:", allowanceError);
          }

          let bal: BalanceAllowanceResponse | null = null;
          try {
            bal = await client.getBalanceAllowance({
              asset_type: AssetType.CONDITIONAL,
              token_id: params.tokenId,
            });
          } catch (balanceError) {
            console.warn("[Trade] Could not fetch balance allowance:", balanceError);
          }

          const balanceShares = parseNumericString(bal?.balance);
          // Apply same tolerance logic to CLOB balance check
          if (Number.isFinite(balanceShares) && balanceShares < size) {
            const diff = size - balanceShares;
            const percentDiff = diff / size;
            const TOLERANCE = 0.01;
            
            if (percentDiff > TOLERANCE) {
              throw new Error(`Not enough shares to sell. Have: ${balanceShares.toFixed(2)}, Need: ${size.toFixed(2)}`);
            }
          }
          
          toast.info("Balance confirmed, placing sell order...");
        }

        console.log(
          `[Trade] Order params: tokenId=${params.tokenId}, price=${validatedPrice}, size=${size}, side=${params.side}, isMarketOrder=${params.isMarketOrder}`
        );

        // Step 8: Use SDK methods which handle signing + posting
        toast.info("Please sign the order in your wallet...");

        let response;

        if (params.isMarketOrder) {
          console.log("[Trade] Using createAndPostMarketOrder (FAK)...");

          const marketOrderAmount = params.side === "SELL" ? size : params.amount;

          response = await client.createAndPostMarketOrder(
            {
              tokenID: params.tokenId,
              amount: marketOrderAmount,
              side: params.side === "BUY" ? Side.BUY : Side.SELL,
            },
            { tickSize, negRisk },
            OrderType.FAK
          );

          if (response && response.makingAmount) {
            const filled = parseFloat(response.makingAmount);
            if (filled > 0 && filled < marketOrderAmount) {
              toast.info(
                `Partially filled: ${filled.toFixed(2)} of ${marketOrderAmount.toFixed(2)} shares`
              );
            }
          }
        } else {
          console.log("[Trade] Using createAndPostOrder (GTC limit order)...");
          response = await client.createAndPostOrder(
            {
              tokenID: params.tokenId,
              price: validatedPrice,
              size: size,
              side: params.side === "BUY" ? Side.BUY : Side.SELL,
            },
            { tickSize, negRisk },
            OrderType.GTC
          );
        }

        console.log("[Trade] Order response:", response);
        
        // Log attribution info for orders
        console.log("[Trade] 📊 Order Attribution Info:");
        console.log("[Trade]   → Wallet Address:", address);
        console.log("[Trade]   → Order Type:", params.isMarketOrder ? "MARKET (FAK)" : "LIMIT (GTC)");
        console.log("[Trade]   → Side:", params.side);
        console.log("[Trade]   → Token ID:", params.tokenId);
        console.log("[Trade]   → Price:", validatedPrice);
        console.log("[Trade]   → Size:", size);
        console.log("[Trade]   → Amount:", params.amount);
        console.log("[Trade]   → Neg Risk:", negRisk);
        if (response.orderID || response.id) {
          console.log("[Trade]   → Order ID:", response.orderID || response.id);
        }

        const errorMessage = response.errorMsg || response.error;
        const hasError = response.success === false || errorMessage || response.status >= 400;
        
        // Handle "no match" error with helpful message
        if (errorMessage === "no match" || (typeof errorMessage === 'string' && errorMessage.includes("no match"))) {
          throw new Error("No buyers available at this price. Try using a limit order instead, or adjust your price.");
        }

        if (hasError) {
          if (errorMessage?.includes("401") || errorMessage?.includes("Unauthorized")) {
            console.log("[Trade] Got auth error, clearing cached API credentials...");
            clearApiCreds();
          }

          if (
            errorMessage?.includes("couldn't be fully filled") ||
            errorMessage?.includes("FOK") ||
            errorMessage?.includes("FAK")
          ) {
            throw new Error("No buyers available at current price. Try a limit order instead.");
          }

          if (errorMessage?.includes("not enough balance") || errorMessage?.includes("allowance")) {
            throw new Error("Insufficient balance or token allowance. Please check your wallet.");
          }

          throw new Error(errorMessage || "Order failed");
        }

        const orderId = response.orderID || response.id;
        if (!orderId) {
          throw new Error("Order submission failed - no order ID returned");
        }

        const orderResult: OrderResult = {
          success: true,
          orderId: orderId,
          result: response,
        };

        setLastOrderResult(orderResult);
        toast.success(`Order placed! ID: ${orderResult.orderId?.slice(0, 10)}...`);

        // Fetch and log builder trades for attribution tracking
        try {
          const builderTradesResponse = await fetch(`${CLOB_HOST}/trades/builder`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          if (builderTradesResponse.ok) {
            const builderTrades = await builderTradesResponse.json();
            console.log("[Trade] 🏗️ Builder Trades (getBuilderTrades):", builderTrades);
            console.log(`[Trade]   → Total trades: ${builderTrades.count || builderTrades.trades?.length || 0}`);
          }
        } catch (builderErr) {
          console.log("[Trade] Could not fetch builder trades:", builderErr);
        }

        return orderResult;
      } catch (error: unknown) {
        console.error("[Trade] Error:", error);
        let errorMessage =
          error instanceof Error ? error.message : "Failed to place order";

        if (errorMessage.toLowerCase().includes("no match")) {
          errorMessage =
            "No buyers available at current price. Try a limit order instead.";
        }

        toast.error(errorMessage);

        const result: OrderResult = { success: false, error: errorMessage };
        setLastOrderResult(result);
        return result;
      } finally {
        setIsPlacingOrder(false);
      }
    },
    [
      address,
      approveUSDC,
      clearApiCreds,
      getOrCreateClient,
      hasSufficientBalance,
      isConnected,
      isFullyApproved,
      isOnPolygon,
      switchToPolygon,
      publicClient,
      isDeployed,
      safeAddress,
    ]
  );

  return {
    placeOrder,
    getOpenOrders,
    cancelOrder,
    isPlacingOrder: isPlacingOrder || isDeploying || isLoadingApiCreds,
    lastOrderResult,
    isOnPolygon,
    switchToPolygon,
    isConnected,
    address,
    safeAddress,
    deploySafe,
  };
}
