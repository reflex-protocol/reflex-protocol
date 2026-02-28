// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISomniaReactivity} from "../interfaces/ISomniaReactivity.sol";

abstract contract SomniaEventHandler {
    // Immutable set at construction time. On mainnet this is always
    // 0x0000000000000000000000000000000000000100; tests inject a mock address.
    address internal immutable PRECOMPILE_ADDRESS;

    // Subscription IDs this contract has registered — used by inheritors to
    // verify that an incoming handleEvent call belongs to a known subscription.
    mapping(uint256 => bool) public subscriptionIds;

    error UnauthorizedCaller(address caller);

    constructor(address _precompileAddress) {
        PRECOMPILE_ADDRESS = _precompileAddress;
    }

    modifier onlyPrecompile() {
        if (msg.sender != PRECOMPILE_ADDRESS) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    // Called by the Reactivity Precompile when a subscribed event fires.
    // subscriptionId identifies which subscription triggered this invocation,
    // allowing inheritors to map back to their internal state (e.g. user lookup).
    function handleEvent(
        uint256 subscriptionId,
        address emitter,
        bytes32[] calldata topics,
        bytes calldata data
    ) external onlyPrecompile {
        _onEvent(subscriptionId, emitter, topics, data);
    }

    // Inheritors implement their reaction logic here.
    // subscriptionId is forwarded so handlers can resolve context
    // (e.g. which user's position this event relates to).
    function _onEvent(
        uint256 subscriptionId,
        address emitter,
        bytes32[] calldata topics,
        bytes calldata data
    ) internal virtual;
}
