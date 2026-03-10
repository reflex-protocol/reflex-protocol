// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ISomniaReactivity} from "./interfaces/ISomniaReactivity.sol";
import {SomniaEventHandler} from "./base/SomniaEventHandler.sol";

contract REFLEXVault is SomniaEventHandler, ReentrancyGuard, Ownable, Pausable {
    // ─── Events ──────────────────────────────────────────────────────────────

    event PositionOpened(
        address indexed user,
        uint256 collateral,
        uint256 debt,
        uint256 subscriptionId
    );
    event PositionClosed(address indexed user, uint256 returned);
    event ProtectionTriggered(address indexed user, uint256 ratio, uint256 price);
    event PositionAtRisk(address indexed user, uint256 ratio);
    event SubscriptionLow(address indexed user, uint256 subscriptionId, uint256 balance);
    event EmergencyExit(address indexed user, uint256 collateralReturned);

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant MIN_COLLATERAL_RATIO = 120;
    uint256 public constant MIN_SUB_FUNDING     = 2 ether;
    uint256 public constant PROTOCOL_FEE_BPS    = 10; // 0.1% — 10 basis points
    uint256 public constant PRICE_PRECISION      = 1e18;

    // Upper bound prevents nonsensical thresholds that would never trigger.
    uint256 private constant MAX_PROTECTION_RATIO = 500;

    // ─── State ───────────────────────────────────────────────────────────────

    struct Position {
        uint256 collateral;      // user collateral in wei (net of subscription funding)
        uint256 debt;            // borrowed amount in wei
        uint256 openedAt;        // block.timestamp at open
        bool    active;
        uint256 subscriptionId;  // Reactivity subscription tracking this position
        uint256 protectionRatio; // user-set threshold, e.g. 130 = 130%
    }

    mapping(address => Position)  public positions;
    mapping(uint256 => address)   public subIdToUser; // reverse lookup: subId -> owner

    address public priceOracle;
    bytes32 public priceUpdateTopic;

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        address _priceOracle,
        bytes32 _priceUpdateTopic,
        address _precompileAddress
    )
        SomniaEventHandler(_precompileAddress)
        Ownable(msg.sender)
    {
        priceOracle      = _priceOracle;
        priceUpdateTopic = _priceUpdateTopic;
    }

    // ─── External — position lifecycle ───────────────────────────────────────

    /// @notice Open a leveraged position and register a Reactivity subscription
    ///         that watches for price drops.
    /// @param  debt            The amount of debt being taken on (in wei).
    /// @param  protectionRatio The collateral-ratio floor at which the vault
    ///                         should intervene, e.g. 150 = 150%.
    function openPosition(uint256 debt, uint256 protectionRatio)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        require(!positions[msg.sender].active, "Position already active");
        require(debt > 0, "Debt must be non-zero");
        require(
            protectionRatio > MIN_COLLATERAL_RATIO && protectionRatio <= MAX_PROTECTION_RATIO,
            "protectionRatio out of range [121,500]"
        );
        // Collateral is everything the user sends minus the mandatory subscription
        // deposit.  Checking here (not after subtraction) avoids underflow.
        require(msg.value > MIN_SUB_FUNDING, "msg.value must exceed MIN_SUB_FUNDING");

        uint256 collateral = msg.value - MIN_SUB_FUNDING;

        // Create the on-chain Reactivity subscription.
        // originFilter and callerFilter are 0x0 (any).
        // isGuaranteed=true: the chain promises the handler will fire.
        // isCoalesced=false: each price event triggers a separate handler call.
        uint256 subId = ISomniaReactivity(PRECOMPILE_ADDRESS).subscribe{value: MIN_SUB_FUNDING}(
            priceOracle,
            priceUpdateTopic,
            address(0),
            address(0),
            address(this),
            true,
            false
        );

        positions[msg.sender] = Position({
            collateral:      collateral,
            debt:            debt,
            openedAt:        block.timestamp,
            active:          true,
            subscriptionId:  subId,
            protectionRatio: protectionRatio
        });

        subIdToUser[subId]        = msg.sender;
        subscriptionIds[subId]    = true;

        emit PositionOpened(msg.sender, collateral, debt, subId);
    }

    /// @notice Close a position, cancel the Reactivity subscription, and
    ///         return collateral minus the protocol fee.
    function closePosition() external nonReentrant whenNotPaused {
        Position storage pos = positions[msg.sender];
        require(pos.active, "No active position");

        _closeAndRefund(msg.sender, pos);
    }

    /// @notice Add collateral to an existing position to improve its ratio.
    function topUpCollateral() external payable nonReentrant whenNotPaused {
        Position storage pos = positions[msg.sender];
        require(pos.active, "No active position");
        require(msg.value > 0, "Zero value");

        pos.collateral += msg.value;
    }

    /// @notice Fund the Reactivity subscription so it stays active.
    ///         A low-balance warning fires when the remaining balance drops
    ///         below 2× the minimum — giving the user time to react before
    ///         protection goes dark.
    function topUpSubscription() external payable nonReentrant whenNotPaused {
        Position storage pos = positions[msg.sender];
        require(pos.active, "No active position");
        require(msg.value > 0, "Zero value");

        ISomniaReactivity(PRECOMPILE_ADDRESS).fundSubscription{value: msg.value}(
            pos.subscriptionId
        );

        (, , , , uint256 balance) =
            ISomniaReactivity(PRECOMPILE_ADDRESS).getSubscription(pos.subscriptionId);

        // 4 ether = 2 × MIN_SUB_FUNDING — warn early so the user has a full
        // subscription cycle to react before the subscription goes inactive.
        if (balance < 4 ether) {
            emit SubscriptionLow(msg.sender, pos.subscriptionId, balance);
        }
    }

    // ─── Owner ───────────────────────────────────────────────────────────────

    /// @notice Update the oracle address that subscriptions filter on.
    function setPriceOracle(address _oracle) external onlyOwner {
        priceOracle = _oracle;
    }

    function setPriceUpdateTopic(bytes32 _topic) external onlyOwner {
        priceUpdateTopic = _topic;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Reactive handler ────────────────────────────────────────────────────

    /// @dev Invoked by the Reactivity Precompile when a price update matching
    ///      our subscription criteria is emitted by the oracle.
    ///      subscriptionId lets us resolve which user this event concerns.
    function _onEvent(
        uint256 subscriptionId,
        address, /* emitter — not needed; subscription already filtered to priceOracle */
        bytes32[] calldata, /* topics — event topic already matched by subscription */
        bytes calldata data
    ) internal override {
        address user = subIdToUser[subscriptionId];
        if (user == address(0)) return; // unknown subscription — ignore

        Position storage pos = positions[user];
        if (!pos.active) return;

        (uint256 newPrice, ) = abi.decode(data, (uint256, uint256));

        // Multiply before dividing to preserve precision.
        // newPrice is the oracle's price with PRICE_PRECISION (1e18) decimals.
        // ratio = (collateral × price × 100) / (debt × precision)
        uint256 ratio = (pos.collateral * newPrice * 100) / (pos.debt * PRICE_PRECISION);

        if (ratio < pos.protectionRatio) {
            emit ProtectionTriggered(user, ratio, newPrice);

            if (ratio < MIN_COLLATERAL_RATIO) {
                _emergencyExit(user);
            } else {
                // Position is below the user's chosen threshold but above hard
                // liquidation — warn so the owner (or keeper UI) can top up.
                emit PositionAtRisk(user, ratio);
            }
        }
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    /// @dev Unwind a position: cancel subscription, collect fee, send remainder.
    ///      Called from both closePosition() and _emergencyExit().
    ///      The nonReentrant guard on callers protects against re-entrance here.
    function _closeAndRefund(address user, Position storage pos) internal {
        uint256 subId = pos.subscriptionId;

        // Mark inactive before any external call (checks-effects-interactions).
        pos.active = false;
        delete subIdToUser[subId];
        delete subscriptionIds[subId];

        // Best-effort unsubscribe — subscription may already be inactive
        // after a failed emergency exit recovery.  Must not trap user funds.
        try ISomniaReactivity(PRECOMPILE_ADDRESS).unsubscribe(subId) {} catch {}

        uint256 fee      = (pos.collateral * PROTOCOL_FEE_BPS) / 10_000;
        uint256 returned = pos.collateral - fee;

        // Reset collateral in storage before the transfer.
        pos.collateral = 0;

        (bool ok, ) = user.call{value: returned}("");
        require(ok, "Transfer failed");

        emit PositionClosed(user, returned);
    }

    /// @dev Force-close a position when the price has fallen below the hard
    ///      liquidation floor. Must not revert — it is called from _onEvent
    ///      which itself must not bubble errors back into the Reactivity chain.
    function _emergencyExit(address user) internal {
        Position storage pos = positions[user];

        uint256 subId    = pos.subscriptionId;
        uint256 returned = pos.collateral;

        pos.active     = false;
        pos.collateral = 0;
        delete subIdToUser[subId];
        delete subscriptionIds[subId];

        // Best-effort unsubscribe — if this fails (e.g. already inactive) we
        // still want the position marked closed, so we don't revert.
        try ISomniaReactivity(PRECOMPILE_ADDRESS).unsubscribe(subId) {} catch {}

        if (returned > 0) {
            (bool ok, ) = user.call{value: returned}("");
            // Deliberately not reverting on failed transfer inside an emergency exit:
            // a reverted _emergencyExit would leave the position half-dismantled.
            if (!ok) {
                // Re-credit collateral so a subsequent manual close can recover it.
                pos.collateral = returned;
                pos.active     = true;
                return;
            }
        }

        emit EmergencyExit(user, returned);
    }
}
