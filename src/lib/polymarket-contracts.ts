// Polymarket Contract Addresses (Polygon Mainnet)
export const POLYGON_CONTRACTS = {
  // USDC on Polygon
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const,
  
  // Conditional Token Framework (ERC1155 outcome tokens)
  CTF_CONTRACT: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const,
  
  // Exchange contracts that need approval to transfer tokens
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const,
  NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const,
  NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as const,
};

// ERC1155 ABI for CTF token approvals (setApprovalForAll)
export const CTF_ABI = [
  {
    name: 'isApprovedForAll',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'setApprovalForAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const;
