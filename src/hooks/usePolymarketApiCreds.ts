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

export function usePolymarketApiCreds() {
  const { address } = useAccount();

  const [isLoading, setIsLoading] = useState(false);

  const cached = useMemo(() => {
    if (!address) return null;
    return safeParseCreds(localStorage.getItem(`${STORAGE_KEY}:${address.toLowerCase()}`));
  }, [address]);

  const clearApiCreds = useCallback(() => {
    if (!address) return;
    localStorage.removeItem(`${STORAGE_KEY}:${address.toLowerCase()}`);
    toast.message("Cleared Polymarket API credentials for this wallet");
  }, [address]);

  const getApiCreds = useCallback(async (): Promise<PolymarketApiCreds | null> => {
    if (!address) {
      toast.error("Connect your wallet first");
      return null;
    }

    // Check for existing cached credentials
    const existing = safeParseCreds(localStorage.getItem(`${STORAGE_KEY}:${address.toLowerCase()}`));
    if (existing) {
      console.log("[API Creds] Using cached credentials for:", address);
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

      console.log("[API Creds] Creating ClobClient for L1 auth...");
      toast.info("Polymarket setup: please sign to enable trading (one-time per wallet)");

      // Create ClobClient without credentials - it will use L1 auth
      // The ClobClient uses ethers internally which produces correct EIP-712 signatures
      const client = new ClobClient(
        CLOB_HOST,
        POLYGON_CHAIN_ID,
        signer
      );

      // Use ClobClient's built-in method to create or derive API credentials
      // This handles all the EIP-712 signing correctly using ethers
      console.log("[API Creds] Calling createOrDeriveApiKey...");
      const apiKeyCreds = await client.createOrDeriveApiKey();

      // ClobClient returns ApiKeyCreds with { key, secret, passphrase }
      // We map to our internal format { apiKey, secret, passphrase }
      if (!apiKeyCreds || !apiKeyCreds.key || !apiKeyCreds.secret || !apiKeyCreds.passphrase) {
        throw new Error("Failed to create/derive API credentials - empty response");
      }

      console.log("[API Creds] Successfully created/derived API credentials");

      // Map to our internal format (key -> apiKey)
      const creds: PolymarketApiCreds = {
        apiKey: apiKeyCreds.key,
        secret: apiKeyCreds.secret,
        passphrase: apiKeyCreds.passphrase,
      };

      // Cache the credentials
      localStorage.setItem(
        `${STORAGE_KEY}:${address.toLowerCase()}`, 
        JSON.stringify(creds)
      );

      toast.success("Trading enabled for this wallet");
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
  const refreshApiCreds = useCallback(async (): Promise<PolymarketApiCreds | null> => {
    if (!address) return null;
    console.log("[API Creds] Forcing credential refresh for:", address);
    localStorage.removeItem(`${STORAGE_KEY}:${address.toLowerCase()}`);
    return await getApiCreds();
  }, [address, getApiCreds]);

  return {
    apiCreds: cached,
    getApiCreds,
    clearApiCreds,
    refreshApiCreds,
    isLoadingApiCreds: isLoading,
  };
}
