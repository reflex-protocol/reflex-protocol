"use client";

import { useReadContract } from "wagmi";
import { zeroAddress, formatEther } from "viem";
import { ORACLE_ADDRESS, ORACLE_ABI } from "@/lib/contracts";
import { somniaTestnet } from "@/lib/wagmi";
import { useAccount } from "wagmi";

// ── Types ────────────────────────────────────────────────

export interface OraclePriceData {
  /** Raw price in wei (18-decimal precision). */
  priceRaw: bigint;
  /** Human-readable price string (e.g. "1.0"). */
  priceFormatted: string;
  /** UNIX timestamp of last update. */
  lastUpdatedAt: number;
  /** Seconds since last update. */
  age: number;
  /** Whether the price is considered stale (>5 min old). */
  isStale: boolean;
  /** Whether the oracle data is loading. */
  isLoading: boolean;
  /** Error message if the read failed. */
  error: string | null;
}

// ── Constants ────────────────────────────────────────────

// Default staleness threshold for the UI (5 minutes).
const DEFAULT_STALE_THRESHOLD = 300;

// ── Hook ─────────────────────────────────────────────────

/**
 * Reads the current price from the on-chain oracle contract.
 *
 * @param asset          The asset address to query (default: address(0) for STT).
 * @param staleThreshold Seconds after which the price is considered stale (default: 300).
 * @param refetchInterval Polling interval in ms (default: 15_000 = 15 seconds).
 */
export function useOraclePrice(
  asset: `0x${string}` = zeroAddress,
  staleThreshold: number = DEFAULT_STALE_THRESHOLD,
  refetchInterval: number = 15_000
): OraclePriceData {
  const { chain } = useAccount();
  const isCorrectChain = chain?.id === somniaTestnet.id;

  // Read price from the oracle's `prices` mapping (never reverts, unlike getPrice).
  const {
    data: priceRaw,
    isLoading: priceLoading,
    error: priceError,
  } = useReadContract({
    address: ORACLE_ADDRESS,
    abi: ORACLE_ABI,
    functionName: "prices",
    args: [asset],
    query: {
      enabled: isCorrectChain,
      refetchInterval,
    },
  });

  // Read last update timestamp.
  const {
    data: updatedAtRaw,
    isLoading: tsLoading,
    error: tsError,
  } = useReadContract({
    address: ORACLE_ADDRESS,
    abi: ORACLE_ABI,
    functionName: "updatedAt",
    args: [asset],
    query: {
      enabled: isCorrectChain,
      refetchInterval,
    },
  });

  const price = (priceRaw as bigint) ?? 0n;
  const updatedAt = Number((updatedAtRaw as bigint) ?? 0n);
  const now = Math.floor(Date.now() / 1000);
  const age = updatedAt > 0 ? now - updatedAt : 0;
  const isStale = updatedAt === 0 || age > staleThreshold;

  const error = priceError?.message ?? tsError?.message ?? null;

  return {
    priceRaw: price,
    priceFormatted: price > 0n ? formatEther(price) : "—",
    lastUpdatedAt: updatedAt,
    age,
    isStale,
    isLoading: priceLoading || tsLoading,
    error,
  };
}
