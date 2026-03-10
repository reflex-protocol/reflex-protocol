// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title  PriceOracle — Production-ready oracle for REFLEX Protocol
/// @notice Replaces MockPriceOracle with security hardening:
///
///   1. **Role-based updaters** — only whitelisted addresses can push prices.
///   2. **Heartbeat / staleness** — getPrice reverts if the last update
///      is older than `heartbeat` seconds.
///   3. **Deviation bounds** — a single update cannot move the price by more
///      than `maxDeviationBps` basis points (prevents flash-manipulation).
///   4. **Minimum update interval** — rate-limits updates to prevent spam.
///
///   Emits the same `PriceUpdated(address,uint256,uint256)` event that the
///   vault's Reactivity subscription already listens for — zero changes needed
///   in the subscription setup.
///
/// @dev    On chains with Chainlink/Pyth feeds available, prefer
///         ChainlinkPriceOracleAdapter instead.  This contract is intended for
///         chains (like Somnia testnet) where no third-party oracle exists yet
///         and a trusted operator pushes prices from an off-chain source.
contract PriceOracle is IPriceOracle, Ownable {
    // ─── Errors ──────────────────────────────────────────────────────────────

    error UnauthorizedUpdater(address caller);
    error PriceIsZero();
    error PriceTooStale(uint256 age, uint256 maxAge);
    error DeviationExceeded(uint256 oldPrice, uint256 newPrice, uint256 maxBps);
    error UpdateTooFrequent(uint256 elapsed, uint256 minInterval);

    // ─── Events ──────────────────────────────────────────────────────────────

    event UpdaterAdded(address indexed updater);
    event UpdaterRemoved(address indexed updater);
    event HeartbeatUpdated(uint256 oldHeartbeat, uint256 newHeartbeat);
    event MaxDeviationUpdated(uint256 oldBps, uint256 newBps);

    // ─── Constants ───────────────────────────────────────────────────────────

    bytes32 public constant override PRICE_UPDATED_TOPIC =
        keccak256("PriceUpdated(address,uint256,uint256)");

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(address => uint256) public prices;
    mapping(address => uint256) public updatedAt;
    mapping(address => bool)    public authorizedUpdaters;

    /// @notice Maximum acceptable age (seconds). Default 5 minutes.
    uint256 public override heartbeat;

    /// @notice Maximum single-update price change in basis points.
    ///         5_00 = 5%.  Prevents manipulation via a single rogue update.
    uint256 public maxDeviationBps;

    /// @notice Minimum seconds between updates for the same asset.
    uint256 public minUpdateInterval;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _heartbeat         Staleness window in seconds (e.g. 300 = 5 min).
    /// @param _maxDeviationBps   Max price move per update in bps (e.g. 500 = 5%).
    /// @param _minUpdateInterval Minimum seconds between consecutive updates.
    constructor(
        uint256 _heartbeat,
        uint256 _maxDeviationBps,
        uint256 _minUpdateInterval
    ) Ownable(msg.sender) {
        heartbeat         = _heartbeat;
        maxDeviationBps   = _maxDeviationBps;
        minUpdateInterval = _minUpdateInterval;

        // Deployer is the first authorized updater.
        authorizedUpdaters[msg.sender] = true;
        emit UpdaterAdded(msg.sender);
    }

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyUpdater() {
        if (!authorizedUpdaters[msg.sender]) {
            revert UnauthorizedUpdater(msg.sender);
        }
        _;
    }

    // ─── External — price updates ────────────────────────────────────────────

    /// @notice Push a new price for `asset`.
    /// @dev    Checks deviation bounds, minimum interval, and non-zero price.
    ///         On the very first update for an asset, deviation and interval
    ///         checks are skipped (no prior reference price).
    /// @param  asset    The asset address (address(0) for native STT sentinel).
    /// @param  newPrice Price with 18-decimal precision (1e18 = 1.0 unit).
    function updatePrice(address asset, uint256 newPrice) external onlyUpdater {
        if (newPrice == 0) revert PriceIsZero();

        uint256 oldPrice  = prices[asset];
        uint256 lastUpdate = updatedAt[asset];

        // Skip deviation + interval checks on first-ever update.
        if (oldPrice > 0) {
            // ── Rate-limit ──
            uint256 elapsed = block.timestamp - lastUpdate;
            if (elapsed < minUpdateInterval) {
                revert UpdateTooFrequent(elapsed, minUpdateInterval);
            }

            // ── Deviation check ──
            uint256 diff = newPrice > oldPrice
                ? newPrice - oldPrice
                : oldPrice - newPrice;
            uint256 deviationBps = (diff * 10_000) / oldPrice;
            if (deviationBps > maxDeviationBps) {
                revert DeviationExceeded(oldPrice, newPrice, maxDeviationBps);
            }
        }

        prices[asset]    = newPrice;
        updatedAt[asset] = block.timestamp;

        emit PriceUpdated(asset, newPrice, block.timestamp);
    }

    // ─── External — views ────────────────────────────────────────────────────

    /// @inheritdoc IPriceOracle
    function getPrice(address asset)
        external
        view
        override
        returns (uint256 price, uint256 lastUpdatedAt)
    {
        price         = prices[asset];
        lastUpdatedAt = updatedAt[asset];

        // Revert if the price has never been set or is stale.
        if (lastUpdatedAt == 0) revert PriceTooStale(0, heartbeat);
        uint256 age = block.timestamp - lastUpdatedAt;
        if (age > heartbeat) revert PriceTooStale(age, heartbeat);
    }

    // ─── Owner — administration ──────────────────────────────────────────────

    /// @notice Whitelist a new address as an authorized price updater.
    function addUpdater(address updater) external onlyOwner {
        authorizedUpdaters[updater] = true;
        emit UpdaterAdded(updater);
    }

    /// @notice Revoke an updater's authorization.
    function removeUpdater(address updater) external onlyOwner {
        authorizedUpdaters[updater] = false;
        emit UpdaterRemoved(updater);
    }

    /// @notice Adjust the staleness window.
    function setHeartbeat(uint256 _heartbeat) external onlyOwner {
        emit HeartbeatUpdated(heartbeat, _heartbeat);
        heartbeat = _heartbeat;
    }

    /// @notice Adjust the maximum per-update deviation.
    function setMaxDeviation(uint256 _maxDeviationBps) external onlyOwner {
        emit MaxDeviationUpdated(maxDeviationBps, _maxDeviationBps);
        maxDeviationBps = _maxDeviationBps;
    }

    /// @notice Adjust the minimum update interval.
    function setMinUpdateInterval(uint256 _interval) external onlyOwner {
        minUpdateInterval = _interval;
    }
}
