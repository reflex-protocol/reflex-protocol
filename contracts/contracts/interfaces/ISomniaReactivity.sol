// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISomniaReactivity {
    function subscribe(
        address emitterFilter,  // 0x0 = any emitter
        bytes32 topicFilter,    // bytes32(0) = any topic
        address originFilter,   // 0x0 = any origin
        address callerFilter,   // 0x0 = any caller
        address handler,        // the SomniaEventHandler contract
        bool isGuaranteed,      // true = chain guarantees invocation
        bool isCoalesced        // true = batch multiple events into one call
    ) external payable returns (uint256 subscriptionId);

    function unsubscribe(uint256 subscriptionId) external;

    function fundSubscription(uint256 subscriptionId) external payable;

    function getSubscription(uint256 subscriptionId)
        external
        view
        returns (
            address emitter,
            bytes32 topic,
            address handler,
            bool active,
            uint256 balance
        );
}
