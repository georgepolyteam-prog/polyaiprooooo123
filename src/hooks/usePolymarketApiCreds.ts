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
  createdFresh?: boolean; // Track if key was freshly created (not derived)
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
      context: obj.context || "eoa", // Default to EOA for old cached creds
      createdFresh: obj.createdFresh || false,
    };
  } catch {
    return null;
  }
}

export type GetApiCredsOptions = {
  funderAddress?: string; // Safe address when using Safe wallet (for ClobClient init only)
  forceNewKeys?: boolean; // Force delete + create new keys (for retry after auth errors)
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

    const cacheKey = `${STORAGE_KEY}:${address.toLowerCase()}`;
    const usingSafe = !!opts?.funderAddress && opts.funderAddress.toLowerCase() !== address.toLowerCase();
    const currentContext: "eoa" | "safe" = usingSafe ? "safe" : "eoa";
    const forceNewKeys = opts?.forceNewKeys || false;

    console.log("[API Creds] EOA (signer):", address);
    console.log("[API Creds] Funder address:", opts?.funderAddress || address);
    console.log("[API Creds] Using Safe:", usingSafe);
    console.log("[API Creds] Current context:", currentContext);
    console.log("[API Creds] Force new keys:", forceNewKeys);
    console.log("[API Creds] Cache key (always EOA):", cacheKey);

    // Check for existing cached credentials for the EOA
    const existing = safeParseCreds(localStorage.getItem(cacheKey));
    
    // CRITICAL: Check if context changed, forceNewKeys requested, or Safe without fresh keys
    const needsNewKeys = forceNewKeys || 
      (existing && existing.context !== currentContext) ||
      (usingSafe && existing && !existing.createdFresh);
    
    if (existing && !needsNewKeys) {
      console.log("[API Creds] Using cached credentials for EOA:", address, "context:", existing.context);
      return { apiKey: existing.apiKey, secret: existing.secret, passphrase: existing.passphrase };
    }
    
    if (needsNewKeys) {
      console.log(`[API Creds] Need fresh keys - forceNew:${forceNewKeys}, contextChanged:${existing?.context !== currentContext}, safeMissingFresh:${usingSafe && existing && !existing.createdFresh}`);
      localStorage.removeItem(cacheKey);
    }

    setIsLoading(true);
    try {
      if (!window.ethereum) {
        throw new Error("No wallet provider found");
      }

      const provider = new ethers.providers.Web3Provider(
        window.ethereum as ethers.providers.ExternalProvider
      );
      const signer = provider.getSigner();

      const network = await provider.getNetwork();
      if (network.chainId !== POLYGON_CHAIN_ID) {
        throw new Error("Please switch to Polygon network first");
      }

      const signatureType = usingSafe ? 2 : 0;
      console.log("[API Creds] Creating ClobClient with signatureType:", signatureType, "context:", currentContext);
      
      toast.info("Polymarket setup: please sign to enable trading...");

      const client = new ClobClient(
        CLOB_HOST,
        POLYGON_CHAIN_ID,
        signer,
        undefined,
        signatureType,
        usingSafe ? opts?.funderAddress : undefined
      );

      let apiKeyCreds: { key: string; secret: string; passphrase: string } | null = null;
      let createdFresh = false;

      // For Safe wallets OR when forcing new keys: delete old keys first, then create fresh
      if (usingSafe || forceNewKeys) {
        console.log("[API Creds] Safe wallet or force refresh: deleting old keys and creating fresh ones...");
        
        // Step 1: Try to delete existing keys (they may be stale/wrong context)
        try {
          // Need to derive first to have creds to delete with
          const derivedCreds = await client.deriveApiKey();
          if (derivedCreds?.key) {
            console.log("[API Creds] Derived existing key, now deleting...");
            const deleteClient = new ClobClient(
              CLOB_HOST,
              POLYGON_CHAIN_ID,
              signer,
              { key: derivedCreds.key, secret: derivedCreds.secret, passphrase: derivedCreds.passphrase },
              signatureType,
              usingSafe ? opts?.funderAddress : undefined
            );
            await deleteClient.deleteApiKey();
            console.log("[API Creds] Successfully deleted existing API keys");
          }
        } catch (deleteError) {
          // Might not have any keys to delete, or deletion failed - continue anyway
          console.log("[API Creds] Could not delete existing keys (may not exist):", deleteError);
        }

        // Step 2: Create fresh new keys
        try {
          console.log("[API Creds] Creating fresh API key...");
          apiKeyCreds = await client.createApiKey();
          createdFresh = true;
          console.log("[API Creds] Fresh API key created successfully");
        } catch (createError) {
          console.log("[API Creds] createApiKey failed, falling back to derive:", createError);
          apiKeyCreds = await client.deriveApiKey();
        }
      } else {
        // For EOA without force: use standard createOrDeriveApiKey
        console.log("[API Creds] EOA mode: using createOrDeriveApiKey...");
        apiKeyCreds = await client.createOrDeriveApiKey();
      }

      if (!apiKeyCreds || !apiKeyCreds.key || !apiKeyCreds.secret || !apiKeyCreds.passphrase) {
        throw new Error("Failed to create/derive API credentials - empty response");
      }

      console.log("[API Creds] Successfully got API credentials for EOA:", address, "context:", currentContext, "fresh:", createdFresh);
      console.log("[API Creds] API Key prefix:", apiKeyCreds.key.slice(0, 8) + "...");

      const storedCreds: StoredCreds = {
        apiKey: apiKeyCreds.key,
        secret: apiKeyCreds.secret,
        passphrase: apiKeyCreds.passphrase,
        context: currentContext,
        createdFresh,
      };

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
      
      if (msg.includes("Could not create api key")) {
        console.log("[API Creds] Create failed - too many keys exist");
        toast.error("Too many API keys exist. Please try 'Reset Trading Keys'.");
      } else {
        toast.error(msg);
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Force refresh credentials (clear cache and re-create fresh keys)
  const refreshApiCreds = useCallback(async (opts?: GetApiCredsOptions): Promise<PolymarketApiCreds | null> => {
    if (!address) return null;
    console.log("[API Creds] Forcing credential refresh with forceNewKeys for EOA:", address);
    localStorage.removeItem(`${STORAGE_KEY}:${address.toLowerCase()}`);
    localStorage.removeItem(`polymarket_api_creds_v1:${address.toLowerCase()}`);
    // Pass forceNewKeys to ensure delete+create flow
    return await getApiCreds({ ...opts, forceNewKeys: true });
  }, [address, getApiCreds]);

  return {
    apiCreds: cached ? { apiKey: cached.apiKey, secret: cached.secret, passphrase: cached.passphrase } : null,
    getApiCreds,
    clearApiCreds,
    refreshApiCreds,
    isLoadingApiCreds: isLoading,
  };
}