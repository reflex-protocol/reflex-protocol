// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @notice Lightweight oracle for tests and local development.
///         Implements IPriceOracle so it is a drop-in for the production oracle.
contract MockPriceOracle is IPriceOracle, Ownable {
    // Pre-computed topic so tests can pass it directly as a Reactivity topicFilter.
    bytes32 public constant override PRICE_UPDATED_TOPIC =
        keccak256("PriceUpdated(address,uint256,uint256)");

    mapping(address => uint256) public prices;
    mapping(address => uint256) public updatedAt;

    /// @notice Mock heartbeat — always returns max uint so staleness never triggers.
    uint256 public constant override heartbeat = type(uint256).max;

    constructor() Ownable(msg.sender) {}

    function updatePrice(address asset, uint256 newPrice) external onlyOwner {
        prices[asset]    = newPrice;
        updatedAt[asset] = block.timestamp;
        emit PriceUpdated(asset, newPrice, block.timestamp);
    }

    function getPrice(address asset)
        external
        view
        override
        returns (uint256 price, uint256 lastUpdatedAt)
    {
        return (prices[asset], updatedAt[asset]);
    }
}
