// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  IPriceOracle — Standard interface for REFLEX price oracles
/// @notice Any oracle (mock, production, Chainlink adapter, etc.) that feeds
///         the REFLEXVault must implement this interface.
///         The vault subscribes to the PriceUpdated event via Somnia Reactivity
///         and reads (price, timestamp) from the event data payload.
interface IPriceOracle {
    // ─── Events ──────────────────────────────────────────────────────────────

    /// @notice Emitted every time a price is published.  The vault's Reactivity
    ///         subscription filters on this topic hash.
    /// @param asset     The asset whose price changed (address(0) for native STT).
    /// @param price     The new price with 18-decimal precision (1e18 = 1.0).
    /// @param timestamp The block.timestamp of the update.
    event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp);

    // ─── Views ───────────────────────────────────────────────────────────────

    /// @notice Returns the latest price and the timestamp it was recorded at.
    /// @param  asset The asset to query.
    /// @return price         The most recent price (18-decimal precision).
    /// @return lastUpdatedAt UNIX timestamp of the last update.
    function getPrice(address asset)
        external
        view
        returns (uint256 price, uint256 lastUpdatedAt);

    /// @notice The canonical topic hash for PriceUpdated.
    ///         Convenience function so callers don't have to recompute it.
    function PRICE_UPDATED_TOPIC() external pure returns (bytes32);

    /// @notice Maximum acceptable age (in seconds) of a price update before
    ///         it is considered stale.
    function heartbeat() external view returns (uint256);
}
