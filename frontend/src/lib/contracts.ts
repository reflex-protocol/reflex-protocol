// REFLEX Protocol — Contract addresses & ABIs
// Network: Somnia Testnet (chainId 50312)

export const CHAIN_ID = 50312;

// ── Addresses ────────────────────────────────────────────

function requireEnv(key: string): `0x${string}` {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val as `0x${string}`;
}

export const VAULT_ADDRESS = requireEnv("NEXT_PUBLIC_VAULT_ADDRESS");
export const INSURANCE_ADDRESS = requireEnv("NEXT_PUBLIC_INSURANCE_ADDRESS");

export const CONTRACTS = {
  MockPriceOracle: "0x0A95c9540C8D5Cf0D573E7a8aDe32476e027dF28",
  REFLEXVault: "0x2CFf4FF05996365fCc1b9437948639Bbd3CCB5fa",
  REFLEXInsurance: "0xC3Ab24C3523126189d09f95dBf5e40e37497F90a",
  SomniaReactivityPrecompile: "0x0000000000000000000000000000000000000100",
} as const;

export const EXPLORER_BASE = "https://shannon-explorer.somnia.network";

export const EXPLORER_LINKS = {
  MockPriceOracle: `${EXPLORER_BASE}/address/${CONTRACTS.MockPriceOracle}#code`,
  REFLEXVault: `${EXPLORER_BASE}/address/${CONTRACTS.REFLEXVault}#code`,
  REFLEXInsurance: `${EXPLORER_BASE}/address/${CONTRACTS.REFLEXInsurance}#code`,
} as const;

// ── Price topic hash ─────────────────────────────────────

export const PRICE_UPDATED_TOPIC =
  "0xb556fac599c3c70efb9ab1fa725ecace6c81cc48d1455f886607def065f3e0c0"; // keccak256("PriceUpdated(address,uint256,uint256)")

// ── REFLEXVault ABI (frontend-used entries only) ─────────

export const VAULT_ABI = [
  // read
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "collateral", type: "uint256" },
      { name: "debt", type: "uint256" },
      { name: "openedAt", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "subscriptionId", type: "uint256" },
      { name: "protectionRatio", type: "uint256" },
    ],
  },
  // write
  {
    type: "function",
    name: "openPosition",
    stateMutability: "payable",
    inputs: [
      { name: "debt", type: "uint256" },
      { name: "protectionRatio", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "closePosition",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "topUpCollateral",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "topUpSubscription",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  // events
  {
    type: "event",
    name: "PositionOpened",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "collateral", type: "uint256", indexed: false },
      { name: "debt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PositionClosed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "returned", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProtectionTriggered",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "ratio", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EmergencyExit",
    inputs: [
      { name: "user", type: "address", indexed: true },
    ],
  },
] as const;

// ── REFLEXInsurance ABI (frontend-used entries only) ─────

export const INSURANCE_ABI = [
  // read
  {
    type: "function",
    name: "insured",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "coverageAmount",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // write
  {
    type: "function",
    name: "purchaseCoverage",
    stateMutability: "payable",
    inputs: [{ name: "coverage", type: "uint256" }],
    outputs: [],
  },
  // events
  {
    type: "event",
    name: "InsurancePaid",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
