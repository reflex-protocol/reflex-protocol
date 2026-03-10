// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  IAggregatorV3 — Minimal Chainlink AggregatorV3 Interface
/// @notice Subset of the Chainlink aggregator interface — only the functions
///         the adapter actually calls.  Avoids pulling in the full Chainlink
///         contracts dependency which is unnecessary on non-Chainlink chains.
interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}
