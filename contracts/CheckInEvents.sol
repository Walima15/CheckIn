// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Event registry for CheckIn. Ticket ownership is not stored here.
contract CheckInEvents is Ownable {
    struct EventInfo {
        uint256 id;
        address organizer;
        string name;
        string description;
        string imageURI;
        uint64 startTime;
        uint64 endTime;
        string venue;
        string location;
        string category;
        uint256 priceWei;
        uint256 maxSupply;
        uint256 sold;
        uint256 checkedIn;
        uint256 revenueWei;
        uint256 bonusPoints;
        bool active;
        bool transfersAllowed;
        bool demo;
        bool exists;
    }

    struct EventInput {
        string name;
        string description;
        string imageURI;
        uint64 startTime;
        uint64 endTime;
        string venue;
        string location;
        string category;
        uint256 priceWei;
        uint256 maxSupply;
        uint256 bonusPoints;
        bool transfersAllowed;
        bool demo;
    }

    struct EventUpdate {
        string name;
        string description;
        string imageURI;
        uint64 startTime;
        uint64 endTime;
        string venue;
        string location;
        string category;
        uint256 priceWei;
        uint256 maxSupply;
        uint256 bonusPoints;
        bool active;
        bool transfersAllowed;
    }

    uint256 public nextEventId = 1;
    address public ticketsContract;

    mapping(uint256 => EventInfo) private _events;
    uint256[] private _ids;

    error ZeroAddress();
    error AlreadySet();
    error NotTickets();
    error NotOrganizer();
    error InvalidInput();
    error NotFound();
    error SoldOut();
    error Inactive();
    error SupplyTooLow();

    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string name,
        uint256 priceWei,
        uint256 maxSupply,
        string category
    );

    event EventUpdated(uint256 indexed eventId, address indexed organizer);

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

    function createEvent(EventInput calldata input) external returns (uint256 eventId) {
        _validate(
            input.name,
            input.description,
            input.imageURI,
            input.venue,
            input.location,
            input.category,
            input.priceWei,
            input.maxSupply,
            input.bonusPoints,
            input.startTime,
            input.endTime
        );

        eventId = nextEventId++;
        _events[eventId] = EventInfo({
            id: eventId,
            organizer: msg.sender,
            name: input.name,
            description: input.description,
            imageURI: input.imageURI,
            startTime: input.startTime,
            endTime: input.endTime,
            venue: input.venue,
            location: input.location,
            category: input.category,
            priceWei: input.priceWei,
            maxSupply: input.maxSupply,
            sold: 0,
            checkedIn: 0,
            revenueWei: 0,
            bonusPoints: input.bonusPoints,
            active: true,
            transfersAllowed: input.transfersAllowed,
            demo: input.demo,
            exists: true
        });
        _ids.push(eventId);

        emit EventCreated(eventId, msg.sender, input.name, input.priceWei, input.maxSupply, input.category);
    }

    function updateEvent(uint256 eventId, EventUpdate calldata input) external {
        EventInfo storage existing = _events[eventId];
        if (!existing.exists) revert NotFound();
        if (msg.sender != existing.organizer) revert NotOrganizer();
        _validate(
            input.name,
            input.description,
            input.imageURI,
            input.venue,
            input.location,
            input.category,
            input.priceWei,
            input.maxSupply,
            input.bonusPoints,
            input.startTime,
            input.endTime
        );
        if (input.maxSupply < existing.sold) revert SupplyTooLow();

        existing.name = input.name;
        existing.description = input.description;
        existing.imageURI = input.imageURI;
        existing.startTime = input.startTime;
        existing.endTime = input.endTime;
        existing.venue = input.venue;
        existing.location = input.location;
        existing.category = input.category;
        existing.priceWei = input.priceWei;
        existing.maxSupply = input.maxSupply;
        existing.bonusPoints = input.bonusPoints;
        existing.active = input.active;
        existing.transfersAllowed = input.transfersAllowed;

        emit EventUpdated(eventId, msg.sender);
    }

    /// @dev Called by the ticket contract before a ticket is minted.
    function recordSale(uint256 eventId, uint256 paid) external onlyTickets {
        EventInfo storage info = _events[eventId];
        if (!info.exists || !info.active) revert Inactive();
        if (info.sold >= info.maxSupply) revert SoldOut();
        if (paid != info.priceWei) revert InvalidInput();
        info.sold += 1;
        info.revenueWei += paid;
    }

    function recordCheckIn(uint256 eventId) external onlyTickets {
        EventInfo storage info = _events[eventId];
        if (!info.exists) revert NotFound();
        info.checkedIn += 1;
    }

    function eventInfo(uint256 eventId) external view returns (EventInfo memory) {
        if (!_events[eventId].exists) revert NotFound();
        return _events[eventId];
    }

    function getOrganizer(uint256 eventId) external view returns (address) {
        if (!_events[eventId].exists) revert NotFound();
        return _events[eventId].organizer;
    }

    function transfersAllowed(uint256 eventId) external view returns (bool) {
        if (!_events[eventId].exists) revert NotFound();
        return _events[eventId].transfersAllowed;
    }

    function bonusPoints(uint256 eventId) external view returns (uint256) {
        if (!_events[eventId].exists) revert NotFound();
        return _events[eventId].bonusPoints;
    }

    function eventCount() external view returns (uint256) {
        return _ids.length;
    }

    function getAllEvents() external view returns (EventInfo[] memory list) {
        uint256 n = _ids.length;
        list = new EventInfo[](n);
        for (uint256 i = 0; i < n; i++) {
            list[i] = _events[_ids[i]];
        }
    }

    function _validate(
        string calldata name,
        string calldata description,
        string calldata imageURI,
        string calldata venue,
        string calldata location,
        string calldata category,
        uint256 priceWei,
        uint256 maxSupply,
        uint256 bonusPoints_,
        uint64 startTime,
        uint64 endTime
    ) internal pure {
        uint256 nameLen = bytes(name).length;
        if (nameLen == 0 || nameLen > 100 || _hasUnsafe(name)) revert InvalidInput();
        if (bytes(description).length > 1000) revert InvalidInput();
        if (bytes(imageURI).length > 500) revert InvalidInput();
        if (bytes(venue).length == 0 || bytes(venue).length > 120) revert InvalidInput();
        if (bytes(location).length == 0 || bytes(location).length > 120) revert InvalidInput();
        if (bytes(category).length == 0 || bytes(category).length > 40 || _hasUnsafe(category)) revert InvalidInput();
        if (maxSupply == 0 || maxSupply > 100_000) revert InvalidInput();
        if (bonusPoints_ > 1_000) revert InvalidInput();
        if (priceWei > 100 ether) revert InvalidInput();
        if (startTime == 0 || endTime < startTime) revert InvalidInput();
    }

    function _hasUnsafe(string memory value) internal pure returns (bool) {
        bytes memory data = bytes(value);
        for (uint256 i = 0; i < data.length; i++) {
            if (data[i] == 0x22 || data[i] == 0x5c) return true;
        }
        return false;
    }
}
