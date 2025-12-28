import { defineChain } from 'viem';

// Sonic Network Configuration
export const sonic = defineChain({
  id: 146,
  name: 'Sonic',
  nativeCurrency: {
    name: 'Sonic',
    symbol: 'S',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.soniclabs.com'] },
  },
  blockExplorers: {
    default: { 
      name: 'Sonic Explorer', 
      url: 'https://sonicscan.org' 
    },
  },
});

// Pandora Contract Addresses (Sonic Network)
export const PANDORA_CONTRACTS = {
  ORACLE: '0x9492a0c32Fb22d1b8940e44C4D69f82B6C3cb298',
  MARKET_FACTORY: '0x017277d36f80422a5d0aA5B8C93f5ae57BA2A317',
  USDC: '0xc6020e5492c2892fD63489797ce3d431ae101d5e', // USDC on Sonic
} as const;

// Pandora AMM ABI (minimal for trading)
export const PREDICTION_AMM_ABI = [
  {
    inputs: [
      { name: 'outcome', type: 'uint8' },
      { name: 'collateralIn', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' }
    ],
    name: 'buy',
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'outcome', type: 'uint8' },
      { name: 'tokensIn', type: 'uint256' },
      { name: 'minCollateralOut', type: 'uint256' }
    ],
    name: 'sell',
    outputs: [{ name: 'collateralOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'outcome', type: 'uint8' }],
    name: 'getPrice',
    outputs: [{ name: 'price', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'yesReserve',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'noReserve',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
] as const;

// ERC20 ABI for USDC approval
export const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
] as const;
