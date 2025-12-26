/**
 * RouterSigner adapter for the Dome SDK
 * Wraps wagmi's WalletClient to conform to the Dome SDK's RouterSigner interface
 */
import type { WalletClient } from 'viem';

export interface Eip712Payload {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface RouterSigner {
  getAddress(): Promise<string>;
  signTypedData(payload: Eip712Payload): Promise<string>;
}

/**
 * Creates a RouterSigner from a wagmi WalletClient
 * This adapter bridges wagmi/viem to the Dome SDK's expected signer interface
 */
export function createRouterSigner(
  walletClient: WalletClient,
  address: string
): RouterSigner {
  return {
    async getAddress() {
      return address;
    },
    async signTypedData(payload: Eip712Payload) {
      // Convert the Dome SDK's Eip712Payload to viem's format
      const signature = await walletClient.signTypedData({
        account: address as `0x${string}`,
        domain: payload.domain as {
          name?: string;
          version?: string;
          chainId?: number;
          verifyingContract?: `0x${string}`;
          salt?: `0x${string}`;
        },
        types: payload.types as Record<string, Array<{ name: string; type: string }>>,
        primaryType: payload.primaryType,
        message: payload.message,
      });
      return signature;
    },
  };
}
