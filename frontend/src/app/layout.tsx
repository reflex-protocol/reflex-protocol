import type { Metadata } from "next";
import Web3Provider from "@/providers/Web3Provider";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "REFLEX Protocol — Autonomous DeFi Protection",
  description:
    "Autonomous DeFi Position Protection powered by Somnia Reactivity. Real-time collateral monitoring with sub-second response.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Animated Background */}
        <div className="appBackground" aria-hidden="true">
          <div className="orbPurple" />
          <div className="orbBlue" />
          <div className="orbPink" />
        </div>
        <div className="gridOverlay" aria-hidden="true" />

        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
