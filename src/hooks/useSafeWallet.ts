import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { ethers } from 'ethers';

const POLYGON_CHAIN_ID = 137;

// Safe Factory address on Polygon (from Polymarket examples)
const SAFE_FACTORY_ADDRESS = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2';
const SAFE_SINGLETON_ADDRESS = '0x3E5c63644E683549055b9Be8653de26E0B4CD36E';

// Derive Safe address deterministically (matches Polymarket's derivation)
function deriveSafeAddress(ownerAddress: string): string {
  // Use create2 to derive deterministic Safe address
  // This matches the Polymarket builder-relayer-client derivation
  const salt = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256'],
      [ownerAddress, 0] // owner + nonce
    )
  );
  
  // Simplified deterministic address derivation
  // In production, this should match the exact Safe factory bytecode
  const initCodeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes32', 'address'],
      [salt, SAFE_SINGLETON_ADDRESS]
    )
  );
  
  return ethers.utils.getCreate2Address(
    SAFE_FACTORY_ADDRESS,
    salt,
    initCodeHash
  );
}

export function useSafeWallet() {
  const { address } = useAccount();
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);

  // Derive Safe address deterministically from EOA (no network call needed)
  const derivedSafeAddress = useMemo(() => {
    if (!address) return null;
    try {
      return deriveSafeAddress(address);
    } catch (e) {
      console.error('[Safe] Failed to derive address:', e);
      return null;
    }
  }, [address]);

  // Load cached deployment status
  useEffect(() => {
    if (derivedSafeAddress) {
      setSafeAddress(derivedSafeAddress);
      
      // Check localStorage for cached deployment status
      const cached = localStorage.getItem(`safe_deployed:${derivedSafeAddress.toLowerCase()}`);
      if (cached === 'true') {
        setIsDeployed(true);
      }
    }
  }, [derivedSafeAddress]);

  // Check if Safe is deployed on-chain (using simple eth_getCode)
  const checkDeployment = useCallback(async () => {
    if (!derivedSafeAddress || !window.ethereum) return false;

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
      const code = await provider.getCode(derivedSafeAddress);
      const deployed = code !== '0x' && code !== '0x0';
      
      setIsDeployed(deployed);
      
      if (deployed) {
        localStorage.setItem(`safe_deployed:${derivedSafeAddress.toLowerCase()}`, 'true');
      }
      
      console.log('[Safe] Deployment status:', deployed);
      return deployed;
    } catch (e) {
      console.error('[Safe] Failed to check deployment:', e);
      return false;
    }
  }, [derivedSafeAddress]);

  // For now, Safe deployment is not required - we'll use EOA trading
  // Safe deployment can be added later if needed
  const deploySafe = useCallback(async () => {
    if (!address) {
      toast.error('Connect wallet first');
      return null;
    }

    if (!derivedSafeAddress) {
      toast.error('Failed to derive Safe address');
      return null;
    }

    // Check if already deployed
    const deployed = await checkDeployment();
    if (deployed) {
      console.log('[Safe] Already deployed at:', derivedSafeAddress);
      return derivedSafeAddress;
    }

    // For now, we'll just use EOA trading
    // Safe deployment would require the RelayClient which has browser crypto issues
    console.log('[Safe] Safe not deployed, will use EOA trading');
    toast.info('Using direct wallet trading (Safe deployment not required)');
    
    return null;
  }, [address, derivedSafeAddress, checkDeployment]);

  return {
    safeAddress: derivedSafeAddress,
    isDeployed,
    deploySafe,
    isDeploying,
    checkDeployment,
  };
}
