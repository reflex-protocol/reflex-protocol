"use client";

import { useState, useEffect } from "react";
import { useAccount, useSwitchChain, useReadContract, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther, formatEther } from "viem";
import Image from "next/image";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Badge from "@/components/ui/Badge";
import { ToastContainer, useToast } from "@/components/ui/Toast";

import { INSURANCE_ADDRESS, INSURANCE_ABI } from "@/lib/contracts";
import { somniaTestnet } from "@/lib/wagmi";
import styles from "./page.module.css";

const COVERAGE_OPTIONS = [
  { amount: "5", cost: "0.5", label: "Basic" },
  { amount: "10", cost: "1", label: "Standard" },
  { amount: "25", cost: "2.5", label: "Premium" },
  { amount: "50", cost: "5", label: "Maximum" },
];

export default function InsurancePage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { toasts, show: showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isCorrectChain = chain?.id === somniaTestnet.id;

  const [customAmount, setCustomAmount] = useState("");
  const [customCost, setCustomCost] = useState("");
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  const { data: isInsured, refetch: refetchInsured } = useReadContract({
    address: INSURANCE_ADDRESS,
    abi: INSURANCE_ABI,
    functionName: "insured",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isCorrectChain, refetchInterval: 10_000 },
  });

  const { data: coverageRaw, refetch: refetchCoverage } = useReadContract({
    address: INSURANCE_ADDRESS,
    abi: INSURANCE_ABI,
    functionName: "coverageAmount",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isCorrectChain, refetchInterval: 10_000 },
  });

  const coverage = coverageRaw ? formatEther(coverageRaw as bigint) : "0";

  const { writeContract, isPending, error: writeError } = useWriteContract();

  useEffect(() => {
    if (writeError) {
      showToast(writeError.message.slice(0, 120), "error");
    }
  }, [writeError, showToast]);

  function handlePurchaseCoverage(coverageAmount: string, costAmount: string) {
    writeContract({
      address: INSURANCE_ADDRESS,
      abi: INSURANCE_ABI,
      functionName: "purchaseCoverage",
      args: [parseEther(coverageAmount)],
      value: parseEther(costAmount),
    });
    showToast("Coverage purchase submitted", "info");
  }

  function handleCustomPurchase() {
    if (!customAmount || !customCost || parseFloat(customAmount) <= 0 || parseFloat(customCost) <= 0) {
      showToast("Please enter valid amounts", "error");
      return;
    }
    handlePurchaseCoverage(customAmount, customCost);
    setCustomAmount("");
    setCustomCost("");
  }

  // Guard: not connected
  if (mounted && !isConnected) {
    return (
      <div className={styles.shell}>
        <Sidebar activeNav="Insurance" />
        <div className={styles.guard}>
          <div className={styles.guardVisual}>
            <div className={styles.guardRing} />
            <Image src="/logo.svg" alt="REFLEX" width={40} height={40} priority />
          </div>
          <h2 className={styles.guardTitle}>Connect Your Wallet</h2>
          <p className={styles.guardText}>
            Connect your wallet to view and purchase insurance coverage.
          </p>
          <ConnectButton.Custom>
            {({ openConnectModal: openModal, mounted: rkMounted }) => (
              <button
                className={styles.btnConnect}
                onClick={openModal}
                disabled={!rkMounted}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M22 10H2" />
                  <path d="M6 14h2" />
                </svg>
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
          <a href="/" className={styles.guardHomeLink}>Back to Home</a>
        </div>
      </div>
    );
  }

  // Guard: wrong chain
  if (!isCorrectChain) {
    return (
      <div className={styles.shell}>
        <Sidebar activeNav="Insurance" />
        <div className={styles.guard}>
          <div className={styles.guardVisual}>
            <div className={styles.guardRing} />
            <Image src="/logo.svg" alt="REFLEX" width={40} height={40} priority />
          </div>
          <h2 className={styles.guardTitle}>Wrong Network</h2>
          <p className={styles.guardText}>
            Please switch to Somnia Testnet to access insurance.
          </p>
          <button
            className={styles.btnSwitch}
            onClick={() => switchChain({ chainId: somniaTestnet.id })}
          >
            Switch to Somnia Testnet
          </button>
          <a href="/" className={styles.guardHomeLink}>Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <Sidebar activeNav="Insurance" />
      <div className={styles.main}>
        <TopBar />
        <div className={styles.content}>
          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Insurance</h1>
              <p className={styles.pageDesc}>
                Protect your positions with coverage that pays out automatically when protection triggers.
              </p>
            </div>
          </div>

          {/* Coverage Status */}
          <div className={styles.coverageStatus}>
            <div className={styles.coverageIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className={styles.coverageInfo}>
              <div className={styles.coverageHeader}>
                <h2 className={styles.coverageTitle}>Your Coverage</h2>
                {isInsured ? (
                  <Badge variant="success" glow>ACTIVE</Badge>
                ) : (
                  <Badge variant="neutral">NOT COVERED</Badge>
                )}
              </div>
              {isInsured ? (
                <div className={styles.coverageDetails}>
                  <div className={styles.coverageDetail}>
                    <span className={styles.coverageDetailLabel}>Coverage Amount</span>
                    <span className={styles.coverageDetailValue}>{parseFloat(coverage).toFixed(4)} STT</span>
                  </div>
                  <div className={styles.coverageDetail}>
                    <span className={styles.coverageDetailLabel}>Status</span>
                    <span className={styles.coverageDetailValue}>Active and Monitoring</span>
                  </div>
                  <div className={styles.coverageDetail}>
                    <span className={styles.coverageDetailLabel}>Payout Trigger</span>
                    <span className={styles.coverageDetailValue}>Automatic on Protection Event</span>
                  </div>
                </div>
              ) : (
                <p className={styles.coverageEmpty}>
                  You do not have active coverage. Purchase a plan below to protect your positions
                  against unexpected market movements.
                </p>
              )}
            </div>
          </div>

          {/* How Insurance Works */}
          <div className={styles.infoCard}>
            <h3 className={styles.infoTitle}>How Insurance Works</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoStep}>
                <span className={styles.infoStepNum}>1</span>
                <div>
                  <h4 className={styles.infoStepTitle}>Purchase Coverage</h4>
                  <p className={styles.infoStepDesc}>
                    Choose a coverage amount and pay the premium. Your coverage is immediately active.
                  </p>
                </div>
              </div>
              <div className={styles.infoStep}>
                <span className={styles.infoStepNum}>2</span>
                <div>
                  <h4 className={styles.infoStepTitle}>Position is Monitored</h4>
                  <p className={styles.infoStepDesc}>
                    Somnia Reactivity continuously watches your position health ratio in real time.
                  </p>
                </div>
              </div>
              <div className={styles.infoStep}>
                <span className={styles.infoStepNum}>3</span>
                <div>
                  <h4 className={styles.infoStepTitle}>Automatic Payout</h4>
                  <p className={styles.infoStepDesc}>
                    If protection triggers, your insurance payout is sent automatically to your wallet.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Coverage Tiers */}
          <div>
            <h3 className={styles.sectionTitle}>Select Coverage</h3>
            <div className={styles.tiersGrid}>
              {COVERAGE_OPTIONS.map((option, i) => (
                <div
                  key={option.label}
                  className={`${styles.tierCard} ${selectedTier === i ? styles.tierCardSelected : ""}`}
                  onClick={() => setSelectedTier(i)}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className={styles.tierLabel}>{option.label}</span>
                  <span className={styles.tierAmount}>{option.amount} STT</span>
                  <span className={styles.tierAmountLabel}>Coverage</span>
                  <div className={styles.tierDivider} />
                  <span className={styles.tierCost}>{option.cost} STT</span>
                  <span className={styles.tierCostLabel}>Premium</span>
                  <button
                    className={styles.btnTier}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePurchaseCoverage(option.amount, option.cost);
                    }}
                    disabled={isPending}
                  >
                    {isPending ? "Processing..." : "Purchase"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div className={styles.customCard}>
            <h3 className={styles.customTitle}>Custom Coverage Amount</h3>
            <p className={styles.customDesc}>
              Need a specific coverage amount? Enter your desired coverage and premium below.
            </p>
            <div className={styles.customInputs}>
              <div className={styles.customField}>
                <label className={styles.customLabel}>Coverage Amount (STT)</label>
                <input
                  type="number"
                  placeholder="e.g. 100"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className={styles.input}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className={styles.customField}>
                <label className={styles.customLabel}>Premium (STT)</label>
                <input
                  type="number"
                  placeholder="e.g. 10"
                  value={customCost}
                  onChange={(e) => setCustomCost(e.target.value)}
                  className={styles.input}
                  min="0"
                  step="0.01"
                />
              </div>
              <button
                className={styles.btnPurchase}
                onClick={handleCustomPurchase}
                disabled={isPending}
              >
                {isPending ? "Processing..." : "Purchase Coverage"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
