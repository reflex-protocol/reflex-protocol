// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEventHandler {
    function handleEvent(
        uint256 subscriptionId,
        address emitter,
        bytes32[] calldata topics,
        bytes calldata data
    ) external;
}

/// @dev Deployed at 0x0100 in tests (via hardhat_setCode) to stand in for the
///      Somnia Reactivity Precompile. Records every subscribe/unsubscribe call
///      and exposes triggerHandler() so tests can simulate the precompile firing.
contract MockReactivityPrecompile {
    event SubscribeCall(
        uint256 indexed subscriptionId,
        address emitter,
        bytes32 topic,
        address handler
    );
    event UnsubscribeCall(uint256 indexed subscriptionId);

    struct Subscription {
        address emitter;
        bytes32 topic;
        address handler;
        bool    active;
        uint256 balance;
    }

    // Storage slot 0 — starts at 0, first returned subId is 1 (pre-increment).
    uint256 private _nextSubId;

    mapping(uint256 => Subscription) public subscriptions;

    function subscribe(
        address emitterFilter,
        bytes32 topicFilter,
        address, /* originFilter */
        address, /* callerFilter */
        address handler,
        bool,    /* isGuaranteed */
        bool     /* isCoalesced */
    ) external payable returns (uint256 subscriptionId) {
        subscriptionId = ++_nextSubId;
        subscriptions[subscriptionId] = Subscription({
            emitter:  emitterFilter,
            topic:    topicFilter,
            handler:  handler,
            active:   true,
            balance:  msg.value
        });
        emit SubscribeCall(subscriptionId, emitterFilter, topicFilter, handler);
    }

    function unsubscribe(uint256 subscriptionId) external {
        subscriptions[subscriptionId].active = false;
        emit UnsubscribeCall(subscriptionId);
    }

    function fundSubscription(uint256 subscriptionId) external payable {
        subscriptions[subscriptionId].balance += msg.value;
    }

    function getSubscription(uint256 subscriptionId)
        external
        view
        returns (
            address emitter,
            bytes32 topic,
            address handler,
            bool    active,
            uint256 balance
        )
    {
        Subscription storage s = subscriptions[subscriptionId];
        return (s.emitter, s.topic, s.handler, s.active, s.balance);
    }

    /// @dev Test helper — simulates the precompile calling handleEvent on a
    ///      handler contract. Because this contract IS deployed at PRECOMPILE_ADDRESS
    ///      (0x0100), msg.sender inside handleEvent passes the onlyPrecompile guard.
    function triggerHandler(
        address handler,
        uint256 subscriptionId,
        address emitter,
        bytes32[] calldata topics,
        bytes calldata data
    ) external {
        IEventHandler(handler).handleEvent(subscriptionId, emitter, topics, data);
    }
}
