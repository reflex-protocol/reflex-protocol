"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { usePathname } from "next/navigation";
import { somniaTestnet } from "@/lib/wagmi";
import styles from "./TopBar.module.css";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/positions": "Positions",
  "/insurance": "Insurance",
  "/docs": "Documentation",
};

export default function TopBar() {
  const { isConnected, chain } = useAccount();
  const isCorrectChain = chain?.id === somniaTestnet.id;
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "Dashboard";

  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <a href="/" className={styles.homeBtn} title="Back to Home">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
        </a>
        <span className={styles.titleSep} />
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>

      <div className={styles.right}>
        {/* Network status */}
        <div className={styles.networkBadge}>
          <span
            className={
              isConnected && isCorrectChain
                ? styles.netDotOk
                : isConnected
                ? styles.netDotWarn
                : styles.netDotOff
            }
          />
          <span className={styles.netLabel}>
            {isConnected
              ? isCorrectChain
                ? "Somnia Testnet"
                : "Wrong Network"
              : "Disconnected"}
          </span>
        </div>

        {/* Separator */}
        <div className={styles.separator} />

        {/* Connect button */}
        <ConnectButton
          accountStatus="address"
          chainStatus="none"
          showBalance={false}
        />
      </div>
    </header>
  );
}
