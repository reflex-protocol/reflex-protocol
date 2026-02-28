import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  REFLEXVault,
  MockPriceOracle,
  MockReactivityPrecompile,
} from "../typechain-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAINNET_PRECOMPILE = "0x0000000000000000000000000000000000000100";
const MIN_SUB_FUNDING    = ethers.parseEther("32");

// Ratio = (collateral_net × price × 100) / (debt × PRICE_PRECISION)
// PRICE_ONE = 1e18 represents a unit price (1.0) with 18-decimal precision.
const PRICE_ONE = ethers.parseEther("1");

// Collateral values (net, after sub-funding deducted from msg.value)
const COLLATERAL_HEALTHY    = ethers.parseEther("150"); // ratio=150 — healthy
const COLLATERAL_AT_RISK    = ethers.parseEther("125"); // ratio=125 — below protection(130), above min(120)
const COLLATERAL_EMERGENCY  = ethers.parseEther("110"); // ratio=110 — below MIN_COLLATERAL_RATIO(120)

const DEBT                  = ethers.parseEther("100");
const PROTECTION_RATIO      = 130n; // threshold used in most tests

// ─── Fixture helpers ──────────────────────────────────────────────────────────

// Matches PriceUpdated(address indexed asset, uint256 price, uint256 timestamp)
// data portion = abi.encode(price, timestamp)  (indexed asset goes to topics)
async function encodeEventData(price: bigint): Promise<string> {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "uint256"],
    [price, Math.floor(Date.now() / 1000)]
  );
}

// ─── Base fixture — deploys all contracts ─────────────────────────────────────

async function deployFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  // Deploy mock precompile at a regular address — vault constructor accepts it.
  const precompile = await (
    await ethers.getContractFactory("MockReactivityPrecompile")
  ).deploy() as MockReactivityPrecompile;

  const oracle          = await (await ethers.getContractFactory("MockPriceOracle")).deploy() as MockPriceOracle;
  const oracleAddr      = await oracle.getAddress();
  const precompileAddr  = await precompile.getAddress();
  const priceUpdateTopic = await oracle.PRICE_UPDATED_TOPIC();

  const vault = await (
    await ethers.getContractFactory("REFLEXVault")
  ).deploy(oracleAddr, priceUpdateTopic, precompileAddr) as REFLEXVault;

  const vaultAddr = await vault.getAddress();
  const assetAddr = ethers.Wallet.createRandom().address; // placeholder asset

  return { vault, oracle, precompile, owner, alice, bob, oracleAddr, vaultAddr, assetAddr, precompileAddr };
}

/// Fixture with alice's healthy position already open (ratio=150, protectionRatio=130).
async function openHealthyPositionFixture() {
  const base = await deployFixture();
  const { vault, alice } = base;

  const tx = await vault.connect(alice).openPosition(
    DEBT,
    PROTECTION_RATIO,
    { value: MIN_SUB_FUNDING + COLLATERAL_HEALTHY }
  );
  const receipt = await tx.wait();
  const event   = receipt!.logs
    .map(l => { try { return vault.interface.parseLog(l); } catch { return null; } })
    .find(e => e?.name === "PositionOpened");
  const subscriptionId = event!.args.subscriptionId as bigint;

  return { ...base, subscriptionId };
}

// ─── describe: openPosition ───────────────────────────────────────────────────

describe("openPosition", function () {
  it("opens successfully with enough collateral and emits PositionOpened", async () => {
    const { vault, alice } = await loadFixture(deployFixture);
    const sendValue = MIN_SUB_FUNDING + COLLATERAL_HEALTHY;

    await expect(
      vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, { value: sendValue })
    )
      .to.emit(vault, "PositionOpened")
      .withArgs(alice.address, COLLATERAL_HEALTHY, DEBT, 1n /* first subId */);
  });

  it("stores position data correctly after open", async () => {
    const { vault, alice } = await loadFixture(deployFixture);
    await vault.connect(alice).openPosition(
      DEBT, PROTECTION_RATIO,
      { value: MIN_SUB_FUNDING + COLLATERAL_HEALTHY }
    );

    const pos = await vault.positions(alice.address);
    expect(pos.collateral).to.equal(COLLATERAL_HEALTHY);
    expect(pos.debt).to.equal(DEBT);
    expect(pos.active).to.be.true;
    expect(pos.protectionRatio).to.equal(PROTECTION_RATIO);
  });

  it("correctly separates subscription funding from user collateral", async () => {
    const { vault, alice } = await loadFixture(deployFixture);
    const sendValue = MIN_SUB_FUNDING + COLLATERAL_HEALTHY;

    await vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, { value: sendValue });

    const pos = await vault.positions(alice.address);
    // Collateral must be exactly msg.value minus the subscription deposit.
    expect(pos.collateral).to.equal(sendValue - MIN_SUB_FUNDING);
  });

  it("creates a subscription on the precompile with correct oracle and topic", async () => {
    const { vault, precompile, alice, oracleAddr } = await loadFixture(deployFixture);

    await vault.connect(alice).openPosition(
      DEBT, PROTECTION_RATIO,
      { value: MIN_SUB_FUNDING + COLLATERAL_HEALTHY }
    );

    // Verify the subscription was recorded by the mock precompile.
    const sub = await precompile.subscriptions(1n);
    expect(sub.emitter).to.equal(oracleAddr);
    expect(sub.handler).to.equal(await vault.getAddress());
    expect(sub.active).to.be.true;
    expect(sub.balance).to.equal(MIN_SUB_FUNDING);
  });

  it("reverts if a position is already active for the caller", async () => {
    const { vault, alice } = await loadFixture(deployFixture);
    const sendValue = MIN_SUB_FUNDING + COLLATERAL_HEALTHY;

    await vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, { value: sendValue });

    await expect(
      vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, { value: sendValue })
    ).to.be.revertedWith("Position already active");
  });

  it("reverts if protectionRatio is <= MIN_COLLATERAL_RATIO (120)", async () => {
    const { vault, alice } = await loadFixture(deployFixture);
    const sendValue = MIN_SUB_FUNDING + COLLATERAL_HEALTHY;

    // Exactly at the minimum boundary — should revert.
    await expect(
      vault.connect(alice).openPosition(DEBT, 120n, { value: sendValue })
    ).to.be.revertedWith("protectionRatio out of range [121,500]");

    // Below the minimum.
    await expect(
      vault.connect(alice).openPosition(DEBT, 115n, { value: sendValue })
    ).to.be.revertedWith("protectionRatio out of range [121,500]");
  });

  it("reverts if protectionRatio exceeds 500", async () => {
    const { vault, alice } = await loadFixture(deployFixture);
    await expect(
      vault.connect(alice).openPosition(
        DEBT, 501n,
        { value: MIN_SUB_FUNDING + COLLATERAL_HEALTHY }
      )
    ).to.be.revertedWith("protectionRatio out of range [121,500]");
  });

  it("reverts if msg.value does not exceed MIN_SUB_FUNDING", async () => {
    const { vault, alice } = await loadFixture(deployFixture);

    // Exactly equal — not strictly greater, so should revert.
    await expect(
      vault.connect(alice).openPosition(DEBT, PROTECTION_RATIO, { value: MIN_SUB_FUNDING })
    ).to.be.revertedWith("msg.value must exceed MIN_SUB_FUNDING");

    // One wei short.
    await expect(
      vault.connect(alice).openPosition(
        DEBT, PROTECTION_RATIO,
        { value: MIN_SUB_FUNDING - 1n }
      )
    ).to.be.revertedWith("msg.value must exceed MIN_SUB_FUNDING");
  });

  it("reverts if debt is zero", async () => {
    const { vault, alice } = await loadFixture(deployFixture);

    await expect(
      vault.connect(alice).openPosition(0n, PROTECTION_RATIO, {
        value: MIN_SUB_FUNDING + COLLATERAL_HEALTHY,
      })
    ).to.be.revertedWith("Debt must be non-zero");
  });
});

// ─── describe: _onEvent — protection triggered ────────────────────────────────

describe("_onEvent — protection triggered", function () {
  it("non-precompile caller on handleEvent reverts with UnauthorizedCaller", async () => {
    const { vault, alice } = await loadFixture(openHealthyPositionFixture);

    await expect(
      vault.connect(alice).handleEvent(1n, alice.address, [], "0x")
    ).to.be.revertedWithCustomError(vault, "UnauthorizedCaller");
  });

  it("price stays healthy — ProtectionTriggered and PositionAtRisk are NOT emitted", async () => {
    const { vault, precompile, alice, assetAddr, vaultAddr, subscriptionId } =
      await loadFixture(openHealthyPositionFixture);

    // price=1e18 → ratio = (150e18 × 1e18 × 100) / (100e18 × 1e18) = 150 — above protectionRatio(130)
    const data = await encodeEventData(PRICE_ONE);

    const tx = precompile.triggerHandler(vaultAddr, subscriptionId, assetAddr, [], data);

    await expect(tx).to.not.emit(vault, "ProtectionTriggered");
    await expect(tx).to.not.emit(vault, "PositionAtRisk");
    await expect(tx).to.not.emit(vault, "EmergencyExit");
  });

  it("price drop to below protectionRatio but above MIN emits PositionAtRisk", async () => {
    const { vault, precompile, alice, assetAddr, vaultAddr } =
      await loadFixture(deployFixture);

    // Open with collateral that gives ratio=125 at price=1 — below protection(130), above min(120)
    await vault.connect(alice).openPosition(
      DEBT, PROTECTION_RATIO,
      { value: MIN_SUB_FUNDING + COLLATERAL_AT_RISK }
    );

    const pos  = await vault.positions(alice.address);
    const subId = pos.subscriptionId;

    // ratio = (125e18 × 1e18 × 100) / (100e18 × 1e18) = 125 → below 130, above 120
    const data = await encodeEventData(PRICE_ONE);

    await expect(
      precompile.triggerHandler(vaultAddr, subId, assetAddr, [], data)
    )
      .to.emit(vault, "ProtectionTriggered")
      .withArgs(alice.address, 125n, PRICE_ONE)
      .and.to.emit(vault, "PositionAtRisk")
      .withArgs(alice.address, 125n);
  });

  it("price drop below MIN_COLLATERAL_RATIO triggers _emergencyExit", async () => {
    const { vault, precompile, alice, assetAddr, vaultAddr } =
      await loadFixture(deployFixture);

    // Open with collateral giving ratio=110 at price=1 — below MIN(120)
    await vault.connect(alice).openPosition(
      DEBT, PROTECTION_RATIO,
      { value: MIN_SUB_FUNDING + COLLATERAL_EMERGENCY }
    );

    const pos   = await vault.positions(alice.address);
    const subId  = pos.subscriptionId;

    // ratio = (110e18 × 1e18 × 100) / (100e18 × 1e18) = 110 → below MIN_COLLATERAL_RATIO(120)
    const data = await encodeEventData(PRICE_ONE);

    await expect(
      precompile.triggerHandler(vaultAddr, subId, assetAddr, [], data)
    )
      .to.emit(vault, "ProtectionTriggered")
      .withArgs(alice.address, 110n, PRICE_ONE)
      .and.to.emit(vault, "EmergencyExit");

    // Position must be marked inactive after emergency exit.
    const posAfter = await vault.positions(alice.address);
    expect(posAfter.active).to.be.false;
  });

  it("ignores events for unknown subscriptionIds — no revert, no state change", async () => {
    const { vault, precompile, alice, assetAddr, vaultAddr } =
      await loadFixture(openHealthyPositionFixture);

    const data         = await encodeEventData(PRICE_ONE);
    const unknownSubId = 9999n;

    const tx = precompile.triggerHandler(vaultAddr, unknownSubId, assetAddr, [], data);
    await expect(tx).to.not.emit(vault, "ProtectionTriggered");
    await expect(tx).to.not.emit(vault, "PositionAtRisk");
    await expect(tx).to.not.emit(vault, "EmergencyExit");
  });
});

// ─── describe: closePosition ─────────────────────────────────────────────────

describe("closePosition", function () {
  it("returns collateral minus protocol fee and emits PositionClosed", async () => {
    const { vault, alice } = await loadFixture(openHealthyPositionFixture);

    const FEE_BPS = 10n;
    const fee      = (COLLATERAL_HEALTHY * FEE_BPS) / 10_000n;
    const expected = COLLATERAL_HEALTHY - fee;

    await expect(vault.connect(alice).closePosition())
      .to.emit(vault, "PositionClosed")
      .withArgs(alice.address, expected);

    const pos = await vault.positions(alice.address);
    expect(pos.active).to.be.false;
  });

  it("transfers the correct ETH amount back to the caller", async () => {
    const { vault, alice } = await loadFixture(openHealthyPositionFixture);

    const FEE_BPS  = 10n;
    const fee      = (COLLATERAL_HEALTHY * FEE_BPS) / 10_000n;
    const expected = COLLATERAL_HEALTHY - fee;

    await expect(vault.connect(alice).closePosition()).to.changeEtherBalance(
      alice,
      expected
    );
  });

  it("unsubscribes from the precompile on close", async () => {
    const { vault, precompile, alice, subscriptionId } =
      await loadFixture(openHealthyPositionFixture);

    await vault.connect(alice).closePosition();

    const sub = await precompile.subscriptions(subscriptionId);
    expect(sub.active).to.be.false;
  });

  it("reverts if the caller has no active position", async () => {
    const { vault, bob } = await loadFixture(openHealthyPositionFixture);

    await expect(vault.connect(bob).closePosition()).to.be.revertedWith(
      "No active position"
    );
  });
});

// ─── describe: topUpCollateral ────────────────────────────────────────────────

describe("topUpCollateral", function () {
  it("increases collateral by exactly msg.value", async () => {
    const { vault, alice } = await loadFixture(openHealthyPositionFixture);

    const topUp = ethers.parseEther("10");
    await vault.connect(alice).topUpCollateral({ value: topUp });

    const pos = await vault.positions(alice.address);
    expect(pos.collateral).to.equal(COLLATERAL_HEALTHY + topUp);
  });

  it("reverts if the caller has no active position", async () => {
    const { vault, bob } = await loadFixture(openHealthyPositionFixture);

    await expect(
      vault.connect(bob).topUpCollateral({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("No active position");
  });
});

// ─── describe: topUpSubscription ─────────────────────────────────────────────

describe("topUpSubscription", function () {
  it("emits SubscriptionLow when balance after top-up is below 64 ether", async () => {
    const { vault, alice, subscriptionId } =
      await loadFixture(openHealthyPositionFixture);

    // Starting balance = MIN_SUB_FUNDING (32 ether); adding 10 → 42 ether < 64 ether
    const topUp = ethers.parseEther("10");

    await expect(vault.connect(alice).topUpSubscription({ value: topUp }))
      .to.emit(vault, "SubscriptionLow")
      .withArgs(alice.address, subscriptionId, MIN_SUB_FUNDING + topUp);
  });

  it("does NOT emit SubscriptionLow when balance is at or above 64 ether", async () => {
    const { vault, alice } = await loadFixture(openHealthyPositionFixture);

    // 32 (initial) + 40 = 72 ether ≥ 64 ether — no warning
    const topUp = ethers.parseEther("40");

    await expect(
      vault.connect(alice).topUpSubscription({ value: topUp })
    ).to.not.emit(vault, "SubscriptionLow");
  });

  it("reverts if the caller has no active position", async () => {
    const { vault, bob } = await loadFixture(openHealthyPositionFixture);

    await expect(
      vault.connect(bob).topUpSubscription({ value: ethers.parseEther("5") })
    ).to.be.revertedWith("No active position");
  });
}); 
