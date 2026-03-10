// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @title  ChainlinkPriceOracleAdapter — Wraps a Chainlink feed for REFLEX
/// @notice Reads from a Chainlink AggregatorV3 price feed and re-emits the
///         price as a `PriceUpdated(address,uint256,uint256)` event that the
///         vault's Somnia Reactivity subscription already listens for.
///
///         Deploy this on chains where Chainlink feeds are available.
///         Call `refreshPrice()` periodically (e.g. via a keeper/cron) to read
///         the latest on-chain Chainlink answer and emit the event.
///
/// @dev    Security checks:
///         - Price must be positive.
///         - Round must be completed (answeredInRound >= roundId).
///         - Staleness: updatedAt must be within `heartbeat` seconds.
///         - Scales Chainlink's answer to 18-decimal precision.
contract ChainlinkPriceOracleAdapter is IPriceOracle, Ownable {
    // ─── Errors ──────────────────────────────────────────────────────────────

    error InvalidChainlinkPrice();
    error StaleChainlinkRound(uint256 updatedAt, uint256 heartbeat);
    error IncompleteRound(uint80 roundId, uint80 answeredInRound);

    // ─── Constants ───────────────────────────────────────────────────────────

    bytes32 public constant override PRICE_UPDATED_TOPIC =
        keccak256("PriceUpdated(address,uint256,uint256)");

    uint256 private constant TARGET_DECIMALS = 18;

    // ─── State ───────────────────────────────────────────────────────────────

    IAggregatorV3 public immutable chainlinkFeed;
    address       public immutable asset; // the asset this feed prices
    uint8         public immutable feedDecimals;

    /// @notice Staleness window — how old a Chainlink round can be before
    ///         we refuse to use it.
    uint256 public override heartbeat;

    /// @notice Cache of the last emitted price (18-decimal precision).
    uint256 public lastPrice;
    uint256 public lastUpdatedAt;

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param _feed      Address of the Chainlink AggregatorV3 price feed.
    /// @param _asset     The asset address this feed prices
    ///                   (use address(0) for native-token sentinel).
    /// @param _heartbeat Maximum acceptable age of a Chainlink round (seconds).
    ///                   Typical: 3600 for hourly feeds, 86400 for daily.
    constructor(
        address _feed,
        address _asset,
        uint256 _heartbeat
    ) Ownable(msg.sender) {
        chainlinkFeed = IAggregatorV3(_feed);
        asset         = _asset;
        heartbeat     = _heartbeat;
        feedDecimals  = IAggregatorV3(_feed).decimals();
    }

    // ─── External — price refresh ────────────────────────────────────────────

    /// @notice Read the latest Chainlink round, validate it, scale to 18
    ///         decimals, cache it, and emit `PriceUpdated` so the vault's
    ///         Reactivity subscription picks it up.
    /// @dev    Anyone can call this — it is a read-then-emit pattern with no
    ///         trust assumptions beyond the Chainlink feed itself.
    function refreshPrice() external {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = chainlinkFeed.latestRoundData();

        // ── Validate round completeness ──
        if (answeredInRound < roundId) {
            revert IncompleteRound(roundId, answeredInRound);
        }

        // ── Validate positive price ──
        if (answer <= 0) revert InvalidChainlinkPrice();

        // ── Validate staleness ──
        if (block.timestamp - updatedAt > heartbeat) {
            revert StaleChainlinkRound(updatedAt, heartbeat);
        }

        // ── Scale to 18 decimals ──
        uint256 price = uint256(answer);
        if (feedDecimals < TARGET_DECIMALS) {
            price = price * (10 ** (TARGET_DECIMALS - feedDecimals));
        } else if (feedDecimals > TARGET_DECIMALS) {
            price = price / (10 ** (feedDecimals - TARGET_DECIMALS));
        }

        lastPrice     = price;
        lastUpdatedAt = updatedAt;

        emit PriceUpdated(asset, price, updatedAt);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /// @inheritdoc IPriceOracle
    function getPrice(address _asset)
        external
        view
        override
        returns (uint256 price, uint256 lastUpdateAt)
    {
        // Only answer for the configured asset.
        require(_asset == asset, "Asset not supported by this feed");

        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
        ) = chainlinkFeed.latestRoundData();

        if (answer <= 0) revert InvalidChainlinkPrice();
        if (block.timestamp - updatedAt > heartbeat) {
            revert StaleChainlinkRound(updatedAt, heartbeat);
        }

        price = uint256(answer);
        if (feedDecimals < TARGET_DECIMALS) {
            price = price * (10 ** (TARGET_DECIMALS - feedDecimals));
        } else if (feedDecimals > TARGET_DECIMALS) {
            price = price / (10 ** (feedDecimals - TARGET_DECIMALS));
        }

        lastUpdateAt = updatedAt;
    }

    // ─── Owner ───────────────────────────────────────────────────────────────

    /// @notice Adjust the staleness threshold for the Chainlink feed.
    function setHeartbeat(uint256 _heartbeat) external onlyOwner {
        heartbeat = _heartbeat;
    }
}
