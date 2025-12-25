import { useCallback, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { ethers } from "ethers";
import { ClobClient } from "@polymarket/clob-client";

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = "polymarket_api_creds_v2"; // Bumped version for context tracking
const CLOB_HOST = "https://clob.polymarket.com";

// Our internal type uses apiKey (for consistency with how we store/use them)
export type PolymarketApiCreds = {
  apiKey: string;
  secret: string;
  passphrase: string;
};

// Extended type with context tracking
type StoredCreds = PolymarketApiCreds & {
  context: "eoa" | "safe";
};

function safeParseCreds(raw: string | null): StoredCreds | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<StoredCreds>;
    if (!obj.apiKey || !obj.secret || !obj.passphrase) return null;
    return { 
      apiKey: obj.apiKey, 
      secret: obj.secret, 
      passphrase: obj.passphrase,
      context: obj.context || "eoa" // Default to EOA for old cached creds
    };
  } catch {
    return null;
  }
}

export type GetApiCredsOptions = {
  funderAddress?: string; // Safe address when using Safe wallet (for ClobClient init only)
};

export function usePolymarketApiCreds() {
  const { address } = useAccount();

  const [isLoading, setIsLoading] = useState(false);

  // CRITICAL: Always cache credentials by EOA address (the signer)
  // Polymarket API keys are linked to the signing address, not the funder/maker
  const cached = useMemo(() => {
    if (!address) return null;
    return safeParseCreds(localStorage.getItem(`${STORAGE_KEY}:${address.toLowerCase()}`));
  }, [address]);

  const clearApiCreds = useCallback((targetAddress?: string) => {
    const addrToClear = targetAddress || address;
    if (!addrToClear) return;
    localStorage.removeItem(`${STORAGE_KEY}:${addrToClear.toLowerCase()}`);
    // Also clear old version keys
    localStorage.removeItem(`polymarket_api_creds_v1:${addrToClear.toLowerCase()}`);
    console.log("[API Creds] Cleared credentials for:", addrToClear);
    toast.message("Cleared trading credentials");
  }, [address]);

  const getApiCreds = useCallback(async (opts?: GetApiCredsOptions): Promise<PolymarketApiCreds | null> => {
    if (!address) {
      toast.error("Connect your wallet first");
      return null;
    }

    // CRITICAL FIX: Always cache/lookup by EOA address (the signer), NOT the Safe address
    // Polymarket's auth system uses POLY_ADDRESS header which must match the API key owner
    // The API key is derived from the EOA signature, so it's always linked to the EOA
    const cacheKey = `${STORAGE_KEY}:${address.toLowerCase()}`;
    const usingSafe = !!opts?.funderAddress && opts.funderAddress.toLowerCase() !== address.toLowerCase();
    const currentContext: "eoa" | "safe" = usingSafe ? "safe" : "eoa";

    console.log("[API Creds] EOA (signer):", address);
    console.log("[API Creds] Funder address:", opts?.funderAddress || address);
    console.log("[API Creds] Using Safe:", usingSafe);
    console.log("[API Creds] Current context:", currentContext);
    console.log("[API Creds] Cache key (always EOA):", cacheKey);

    // Check for existing cached credentials for the EOA
    const existing = safeParseCreds(localStorage.getItem(cacheKey));
    
    // CRITICAL: Check if context changed (EOA -> Safe or Safe -> EOA)
    if (existing) {
      if (existing.context !== currentContext) {
        console.log(`[API Creds] Context changed from ${existing.context} to ${currentContext}, refreshing credentials...`);
        localStorage.removeItem(cacheKey);
        // Continue to re-derive below
      } else {
        console.log("[API Creds] Using cached credentials for EOA:", address, "context:", existing.context);
        return { apiKey: existing.apiKey, secret: existing.secret, passphrase: existing.passphrase };
      }
    }

    setIsLoading(true);
    try {
      // Get ethers signer from window.ethereum
      if (!window.ethereum) {
        throw new Error("No wallet provider found");
      }

      const provider = new ethers.providers.Web3Provider(
        window.ethereum as ethers.providers.ExternalProvider
      );
      const signer = provider.getSigner();

      // Verify we're on Polygon
      const network = await provider.getNetwork();
      if (network.chainId !== POLYGON_CHAIN_ID) {
        throw new Error("Please switch to Polygon network first");
      }

      // signatureType 2 = POLY_GNOSIS_SAFE (for Safe wallet orders)
      // signatureType 0 = EOA (direct wallet orders)
      // NOTE: signatureType affects order signing, but API credentials are still derived for EOA
      const signatureType = usingSafe ? 2 : 0;
      console.log("[API Creds] Creating ClobClient with signatureType:", signatureType, "context:", currentContext);
      
      toast.info("Polymarket setup: please sign to enable trading (one-time per wallet)");

      // Create ClobClient - API credentials are derived for the EOA (signer)
      // The funderAddress is only used for order signing (maker field), not for API auth
      const client = new ClobClient(
        CLOB_HOST,
        POLYGON_CHAIN_ID,
        signer,
        undefined, // No existing creds - will derive
        signatureType,
        usingSafe ? opts?.funderAddress : undefined // funderAddress for Safe order signing only
      );

      // createOrDeriveApiKey derives credentials linked to the SIGNER (EOA)
      // The POLY_ADDRESS header in API calls will use this EOA address
      console.log("[API Creds] Calling createOrDeriveApiKey (credentials linked to EOA)...");
      const apiKeyCreds = await client.createOrDeriveApiKey();

      // ClobClient returns ApiKeyCreds with { key, secret, passphrase }
      if (!apiKeyCreds || !apiKeyCreds.key || !apiKeyCreds.secret || !apiKeyCreds.passphrase) {
        throw new Error("Failed to create/derive API credentials - empty response");
      }

      console.log("[API Creds] Successfully created/derived API credentials for EOA:", address, "context:", currentContext);
      console.log("[API Creds] API Key prefix:", apiKeyCreds.key.slice(0, 8) + "...");

      // Map to our internal format (key -> apiKey) with context
      const storedCreds: StoredCreds = {
        apiKey: apiKeyCreds.key,
        secret: apiKeyCreds.secret,
        passphrase: apiKeyCreds.passphrase,
        context: currentContext,
      };

      // CRITICAL: Cache credentials by EOA address with context
      localStorage.setItem(cacheKey, JSON.stringify(storedCreds));

      toast.success("Trading enabled for this wallet");
      return { apiKey: storedCreds.apiKey, secret: storedCreds.secret, passphrase: storedCreds.passphrase };
    } catch (e: unknown) {
      console.error("[API Creds] Error:", e);
      const msg = e instanceof Error ? e.message : "Failed to enable trading";
      
      if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("user rejected")) {
        toast.error("Signature cancelled");
        return null;
      }
      
      // Handle "Could not create api key" - try derive fallback
      if (msg.includes("Could not create api key")) {
        console.log("[API Creds] Create failed, attempting derive fallback...");
        toast.error("API key creation failed. Please try again.");
      } else {
        toast.error(msg);
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Force refresh credentials (clear cache and re-derive)
  const refreshApiCreds = useCallback(async (opts?: GetApiCredsOptions): Promise<PolymarketApiCreds | null> => {
    if (!address) return null;
    // Always clear by EOA address
    console.log("[API Creds] Forcing credential refresh for EOA:", address);
    localStorage.removeItem(`${STORAGE_KEY}:${address.toLowerCase()}`);
    // Also clear old version
    localStorage.removeItem(`polymarket_api_creds_v1:${address.toLowerCase()}`);
    return await getApiCreds(opts);
  }, [address, getApiCreds]);

  return {
    apiCreds: cached ? { apiKey: cached.apiKey, secret: cached.secret, passphrase: cached.passphrase } : null,
    getApiCreds,
    clearApiCreds,
    refreshApiCreds,
    isLoadingApiCreds: isLoading,
  };
}