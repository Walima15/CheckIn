// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Testnet attendance proofs and points. This is not a transferable token.
contract CheckInRewards is Ownable {
    uint256 public constant PURCHASE_POINTS = 10;
    uint256 public constant CHECKIN_POINTS = 50;
    uint256 public constant PARTICIPATION_POINTS = 25;

    struct Proof {
        uint256 eventId;
        uint256 ticketId;
        address attendee;
        address organizer;
        uint64 timestamp;
        bool valid;
    }

    struct RewardRecord {
        uint256 eventId;
        uint256 ticketId;
        uint256 points;
        uint64 timestamp;
        string reason;
    }

    address public ticketsContract;

    mapping(address => uint256) public points;
    mapping(address => uint256) public checkInCount;
    mapping(uint256 => Proof) private _proofs;
    mapping(address => RewardRecord[]) private _history;
    mapping(address => mapping(bytes32 => bool)) public achievements;
    mapping(uint256 => bool) public bonusClaimed;

    error ZeroAddress();
    error AlreadySet();
    error NotTickets();
    error NotOrganizer();
    error AlreadyRecorded();
    error NotCheckedIn();
    error BonusAlreadyIssued();
    error InvalidBonus();

    event ProofOfAttendanceCreated(
        uint256 indexed eventId,
        uint256 indexed ticketId,
        address indexed attendee,
        address organizer,
        uint64 timestamp
    );

    event RewardIssued(
        address indexed attendee,
        uint256 indexed eventId,
        uint256 indexed ticketId,
        uint256 points,
        string reason
    );

    event AchievementUnlocked(address indexed attendee, string name);

    constructor() Ownable(msg.sender) {}

    modifier onlyTickets() {
        if (msg.sender != ticketsContract) revert NotTickets();
        _;
    }

    function setTicketsContract(address tickets_) external onlyOwner {
        if (tickets_ == address(0)) revert ZeroAddress();
        if (ticketsContract != address(0)) revert AlreadySet();
        ticketsContract = tickets_;
    }

    function creditPurchase(address attendee, uint256 eventId, uint256 ticketId) external onlyTickets {
        _credit(attendee, eventId, ticketId, PURCHASE_POINTS, "Ticket purchase");
        _unlock(attendee, "First Ticket");
    }

    function recordAttendance(
        uint256 eventId,
        uint256 ticketId,
        address attendee,
        address organizer,
        uint256 bonusPoints_
    ) external onlyTickets {
        if (_proofs[ticketId].valid) revert AlreadyRecorded();
        if (bonusPoints_ > 1_000) revert InvalidBonus();

        uint64 timestamp = uint64(block.timestamp);
        _proofs[ticketId] = Proof({
            eventId: eventId,
            ticketId: ticketId,
            attendee: attendee,
            organizer: organizer,
            timestamp: timestamp,
            valid: true
        });
        checkInCount[attendee] += 1;

        emit ProofOfAttendanceCreated(eventId, ticketId, attendee, organizer, timestamp);

        _credit(attendee, eventId, ticketId, CHECKIN_POINTS, "Successful check-in");
        _credit(attendee, eventId, ticketId, PARTICIPATION_POINTS, "Event participation");
        if (bonusPoints_ > 0) {
            _credit(attendee, eventId, ticketId, bonusPoints_, "Organizer bonus");
        }

        _unlock(attendee, "First Check-in");
        if (checkInCount[attendee] >= 3) _unlock(attendee, "Regular");
        if (checkInCount[attendee] >= 5) _unlock(attendee, "Community");
    }

    function issueOrganizerBonus(uint256 ticketId, address organizer, uint256 extraPoints) external onlyTickets {
        Proof memory proof = _proofs[ticketId];
        if (!proof.valid) revert NotCheckedIn();
        if (proof.organizer != organizer) revert NotOrganizer();
        if (bonusClaimed[ticketId]) revert BonusAlreadyIssued();
        if (extraPoints == 0 || extraPoints > 100) revert InvalidBonus();

        bonusClaimed[ticketId] = true;
        _credit(proof.attendee, proof.eventId, ticketId, extraPoints, "Organizer-issued bonus");
    }

    function getProof(uint256 ticketId) external view returns (Proof memory) {
        return _proofs[ticketId];
    }

    function getHistory(address attendee) external view returns (RewardRecord[] memory) {
        return _history[attendee];
    }

    function hasAchievement(address attendee, string calldata name) external view returns (bool) {
        return achievements[attendee][keccak256(bytes(name))];
    }

    function _credit(
        address attendee,
        uint256 eventId,
        uint256 ticketId,
        uint256 amount,
        string memory reason
    ) internal {
        points[attendee] += amount;
        _history[attendee].push(
            RewardRecord({
                eventId: eventId,
                ticketId: ticketId,
                points: amount,
                timestamp: uint64(block.timestamp),
                reason: reason
            })
        );
        emit RewardIssued(attendee, eventId, ticketId, amount, reason);
        if (points[attendee] >= 100) _unlock(attendee, "Explorer");
        if (points[attendee] >= 250) _unlock(attendee, "Dedicated");
    }

    function _unlock(address attendee, string memory name) internal {
        bytes32 key = keccak256(bytes(name));
        if (achievements[attendee][key]) return;
        achievements[attendee][key] = true;
        emit AchievementUnlocked(attendee, name);
    }
}
