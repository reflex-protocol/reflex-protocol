// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockPriceOracle is Ownable {
    event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp);

    // Pre-computed topic so tests can pass it directly as a Reactivity topicFilter.
    bytes32 public constant PRICE_UPDATED_TOPIC =
        keccak256("PriceUpdated(address,uint256,uint256)");

    mapping(address => uint256) public prices;
    mapping(address => uint256) public updatedAt;

    constructor() Ownable(msg.sender) {}

    function updatePrice(address asset, uint256 newPrice) external onlyOwner {
        prices[asset]    = newPrice;
        updatedAt[asset] = block.timestamp;
        emit PriceUpdated(asset, newPrice, block.timestamp);
    }

    function getPrice(address asset)
        external
        view
        returns (uint256 price, uint256 lastUpdatedAt)
    {
        return (prices[asset], updatedAt[asset]);
    }
}
