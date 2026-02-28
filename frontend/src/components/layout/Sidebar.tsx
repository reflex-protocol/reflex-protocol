"use client";

import Image from "next/image";
import { useAccount } from "wagmi";
import styles from "./Sidebar.module.css";

/* ── SVG Icons (inline for zero-dep) ──────────────────── */

const icons: Record<string, JSX.Element> = {
  Home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  ),
  Dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Positions: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  Insurance: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Positions", href: "/positions" },
  { label: "Insurance", href: "/insurance" },
  { label: "Docs", href: "/docs" },
] as const;

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Sidebar({
  activeNav = "Dashboard",
}: {
  activeNav?: string;
}) {
  const { address, isConnected, chain } = useAccount();

  return (
    <aside className={styles.sidebar}>
      {/* ── Logo ──────────────────────────────────────── */}
      <a href="/" className={styles.logoSection} style={{ textDecoration: "none" }}>
        <div className={styles.logoMark}>
          <Image
            src="/logo.svg"
            alt="REFLEX"
            width={28}
            height={28}
            priority
          />
        </div>
        <div className={styles.logoText}>
          <span className={styles.brandName}>REFLEX</span>
          <span className={styles.brandTag}>PROTOCOL</span>
        </div>
      </a>

      {/* ── Navigation ────────────────────────────────── */}
      <nav className={styles.nav}>
        <span className={styles.navLabel}>Menu</span>
        {NAV_ITEMS.map((item) => {
          const isActive = item.label === activeNav;
          return (
            <a
              key={item.label}
              href={item.href}
              className={isActive ? styles.navItemActive : styles.navItem}
            >
              <span className={styles.navIcon}>
                {icons[item.label]}
              </span>
              <span className={styles.navText}>{item.label}</span>
              {isActive && <span className={styles.activeIndicator} />}
            </a>
          );
        })}
      </nav>

      {/* ── Bottom: wallet info ───────────────────────── */}
      <div className={styles.bottomSection}>
        <div className={styles.networkRow}>
          <span
            className={
              isConnected && chain
                ? styles.statusDotLive
                : styles.statusDotOff
            }
          />
          <span className={styles.networkName}>
            {isConnected && chain ? chain.name : "Disconnected"}
          </span>
        </div>
        {isConnected && address && (
          <div className={styles.walletAddress}>
            {truncateAddress(address)}
          </div>
        )}
      </div>
    </aside>
  );
}
