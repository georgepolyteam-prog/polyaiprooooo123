import { useCallback, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { ethers } from "ethers";
import { ClobClient } from "@polymarket/clob-client";

const POLYGON_CHAIN_ID = 137;
const STORAGE_KEY = "polymarket_api_creds_v1";
const CLOB_HOST = "https://clob.polymarket.com";

// Our internal type uses apiKey (for consistency with how we store/use them)
export type PolymarketApiCreds = {
  apiKey: string;
  secret: string;
  passphrase: string;
};

function safeParseCreds(raw: string | null): PolymarketApiCreds | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<PolymarketApiCreds>;
    if (!obj.apiKey || !obj.secret || !obj.passphrase) return null;
    return { apiKey: obj.apiKey, secret: obj.secret, passphrase: obj.passphrase };
  } catch {
    return null;
  }
}

export type GetApiCredsOptions = {
  funderAddress?: string; // Safe address when using Safe wallet
};

export function usePolymarketApiCreds() {
  const { address } = useAccount();

  const [isLoading, setIsLoading] = useState(false);

  // Cached credentials for EOA (default) - Safe credentials checked dynamically
  const cached = useMemo(() => {
    if (!address) return null;
    return safeParseCreds(localStorage.getItem(`${STORAGE_KEY}:${address.toLowerCase()}`));
  }, [address]);

  const clearApiCreds = useCallback((targetAddress?: string) => {
    const addrToClear = targetAddress || address;
    if (!addrToClear) return;
    localStorage.removeItem(`${STORAGE_KEY}:${addrToClear.toLowerCase()}`);
    toast.message("Cleared Polymarket API credentials");
  }, [address]);

  const getApiCreds = useCallback(async (opts?: GetApiCredsOptions): Promise<PolymarketApiCreds | null> => {
    if (!address) {
      toast.error("Connect your wallet first");
      return null;
    }

    // Determine target address: Safe address (if provided) or EOA
    const targetAddress = opts?.funderAddress || address;
    const usingSafe = !!opts?.funderAddress && opts.funderAddress.toLowerCase() !== address.toLowerCase();
    const cacheKey = `${STORAGE_KEY}:${targetAddress.toLowerCase()}`;

    console.log("[API Creds] Target address:", targetAddress, "Using Safe:", usingSafe);

    // Check for existing cached credentials for this target
    const existing = safeParseCreds(localStorage.getItem(cacheKey));
    if (existing) {
      console.log("[API Creds] Using cached credentials for:", targetAddress);
      return existing;
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

      const signatureType = usingSafe ? 2 : 0; // 2 = POLY_GNOSIS_SAFE, 0 = EOA
      console.log("[API Creds] Creating ClobClient with signatureType:", signatureType);
      
      if (usingSafe) {
        toast.info("Polymarket setup: please sign to enable trading for your Safe wallet");
      } else {
        toast.info("Polymarket setup: please sign to enable trading (one-time per wallet)");
      }

      // Create ClobClient with correct signatureType and funderAddress
      // For Safe wallets (signatureType 2), the funderAddress is the Safe address
      // The EOA signs to derive API keys linked to the Safe address
      const client = new ClobClient(
        CLOB_HOST,
        POLYGON_CHAIN_ID,
        signer,
        undefined, // No existing creds - will derive
        signatureType,
        usingSafe ? targetAddress : undefined // funderAddress for Safe
      );

      // Use ClobClient's built-in method to create or derive API credentials
      // For Safe wallets, this derives keys linked to the Safe address
      console.log("[API Creds] Calling createOrDeriveApiKey for:", targetAddress);
      const apiKeyCreds = await client.createOrDeriveApiKey();

      // ClobClient returns ApiKeyCreds with { key, secret, passphrase }
      if (!apiKeyCreds || !apiKeyCreds.key || !apiKeyCreds.secret || !apiKeyCreds.passphrase) {
        throw new Error("Failed to create/derive API credentials - empty response");
      }

      console.log("[API Creds] Successfully created/derived API credentials for:", targetAddress);

      // Map to our internal format (key -> apiKey)
      const creds: PolymarketApiCreds = {
        apiKey: apiKeyCreds.key,
        secret: apiKeyCreds.secret,
        passphrase: apiKeyCreds.passphrase,
      };

      // Cache credentials keyed by target address (Safe or EOA)
      localStorage.setItem(cacheKey, JSON.stringify(creds));

      toast.success(usingSafe ? "Trading enabled for Safe wallet" : "Trading enabled for this wallet");
      return creds;
    } catch (e: unknown) {
      console.error("[API Creds] Error:", e);
      const msg = e instanceof Error ? e.message : "Failed to enable trading";
      
      if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("user rejected")) {
        toast.error("Signature cancelled");
        return null;
      }
      
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Force refresh credentials (clear cache and re-derive)
  const refreshApiCreds = useCallback(async (opts?: GetApiCredsOptions): Promise<PolymarketApiCreds | null> => {
    if (!address) return null;
    const targetAddress = opts?.funderAddress || address;
    console.log("[API Creds] Forcing credential refresh for:", targetAddress);
    localStorage.removeItem(`${STORAGE_KEY}:${targetAddress.toLowerCase()}`);
    return await getApiCreds(opts);
  }, [address, getApiCreds]);

  return {
    apiCreds: cached,
    getApiCreds,
    clearApiCreds,
    refreshApiCreds,
    isLoadingApiCreds: isLoading,
  };
}
