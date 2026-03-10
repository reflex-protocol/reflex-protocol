import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

// ─── Oracle deployment ───────────────────────────────────────────────────────
//
// ORACLE_MODE (env var) controls which oracle is deployed:
//
//   "mock"        — MockPriceOracle (owner-only updatePrice, no safety checks).
//                   Default for local/hardhat networks.
//
//   "production"  — PriceOracle with access-controlled updaters, staleness
//                   heartbeat, deviation bounds, and rate-limiting.
//                   Default for live networks (somnia_testnet, mainnet, etc.).
//
//   "chainlink"   — ChainlinkPriceOracleAdapter wrapping an existing Chainlink
//                   AggregatorV3 feed.  Requires CHAINLINK_FEED_ADDRESS env var.
//
// You can override the defaults by setting ORACLE_MODE explicitly.
// ─────────────────────────────────────────────────────────────────────────────

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const isLocal = ["hardhat", "localhost"].includes(network.name);
  const mode = (process.env.ORACLE_MODE || (isLocal ? "mock" : "production")).toLowerCase();

  if (mode === "chainlink") {
    // ── Chainlink adapter mode ──────────────────────────────────────────────
    const feedAddress = process.env.CHAINLINK_FEED_ADDRESS;
    if (!feedAddress) {
      throw new Error("CHAINLINK_FEED_ADDRESS env var required when ORACLE_MODE=chainlink");
    }
    const asset = process.env.ORACLE_ASSET_ADDRESS || ethers.ZeroAddress;
    // Heartbeat: how old a Chainlink round can be (default: 1 hour)
    const heartbeat = process.env.CHAINLINK_HEARTBEAT || "3600";

    const result = await deploy("ChainlinkPriceOracleAdapter", {
      from: deployer,
      args: [feedAddress, asset, heartbeat],
      log: true,
      waitConfirmations: isLocal ? 0 : 2,
    });

    console.log(`ChainlinkPriceOracleAdapter deployed to: ${result.address}`);
    console.log(`  Chainlink feed:  ${feedAddress}`);
    console.log(`  Asset:           ${asset}`);
    console.log(`  Heartbeat:       ${heartbeat}s`);

  } else if (mode === "production") {
    // ── Production oracle mode ──────────────────────────────────────────────
    //
    // Configure via env vars:
    //   ORACLE_HEARTBEAT          — staleness window in seconds (default: 300 = 5 min)
    //   ORACLE_MAX_DEVIATION_BPS  — max single-update move in bps (default: 500 = 5%)
    //   ORACLE_MIN_INTERVAL       — min seconds between updates (default: 10)
    //
    const heartbeat       = process.env.ORACLE_HEARTBEAT          || "300";
    const maxDeviationBps = process.env.ORACLE_MAX_DEVIATION_BPS  || "500";
    const minInterval     = process.env.ORACLE_MIN_INTERVAL       || "10";

    const result = await deploy("PriceOracle", {
      from: deployer,
      args: [heartbeat, maxDeviationBps, minInterval],
      log: true,
      waitConfirmations: isLocal ? 0 : 2,
    });

    // Seed initial price so the vault has something to work with.
    const initialPrice = ethers.parseEther("1"); // 1.0 — parity
    await execute(
      "PriceOracle",
      { from: deployer, log: true },
      "updatePrice",
      ethers.ZeroAddress,
      initialPrice
    );

    console.log(`PriceOracle (production) deployed to: ${result.address}`);
    console.log(`  Heartbeat:       ${heartbeat}s`);
    console.log(`  Max deviation:   ${maxDeviationBps} bps`);
    console.log(`  Min interval:    ${minInterval}s`);

  } else {
    // ── Mock oracle mode (default for local) ────────────────────────────────
    const result = await deploy("MockPriceOracle", {
      from: deployer,
      args: [],
      log: true,
      waitConfirmations: isLocal ? 0 : 2,
    });

    // Seed an initial price with 18-decimal precision.
    // 1e18 = 1.0 (unit price, both collateral and debt denominated in STT).
    const initialPrice = ethers.parseEther("1"); // 1.0 — parity
    await execute(
      "MockPriceOracle",
      { from: deployer, log: true },
      "updatePrice",
      ethers.ZeroAddress,
      initialPrice
    );

    console.log(`MockPriceOracle deployed to: ${result.address}`);
  }
};

export default func;
func.tags = ["oracle"];

