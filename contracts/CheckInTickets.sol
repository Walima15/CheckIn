// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {CheckInEvents} from "./CheckInEvents.sol";
import {CheckInRewards} from "./CheckInRewards.sol";

/// @notice ERC-721 event tickets. Ownership, check-in, and transfers are enforced here.
contract CheckInTickets is ERC721, ERC721Enumerable, ReentrancyGuard {
    using Strings for uint256;

    struct Ticket {
        uint256 eventId;
        uint64 purchasedAt;
        bool checkedIn;
        uint64 checkedInAt;
    }

    CheckInEvents public immutable eventsContract;
    CheckInRewards public immutable rewardsContract;

    uint256 public nextTicketId = 1;
    mapping(uint256 => Ticket) private _tickets;
    mapping(uint256 => uint256[]) private _eventTickets;

    error IncorrectPayment();
    error PaymentFailed();
    error TicketNotFound();
    error AlreadyCheckedIn();
    error NotCheckedIn();
    error NotOrganizer();
    error TransfersDisabled();
    error DirectPaymentsDisabled();

    event TicketPurchased(
        uint256 indexed ticketId,
        uint256 indexed eventId,
        address indexed buyer,
        uint256 priceWei
    );

    event TicketCheckedIn(
        uint256 indexed ticketId,
        uint256 indexed eventId,
        address indexed attendee,
        address organizer,
        uint64 timestamp
    );

    event TicketTransferred(uint256 indexed ticketId, address indexed from, address indexed to);

    constructor(address events_, address rewards_) ERC721("CheckIn Ticket", "CHK") {
        eventsContract = CheckInEvents(events_);
        rewardsContract = CheckInRewards(rewards_);
    }

    function buyTicket(uint256 eventId) external payable nonReentrant returns (uint256 ticketId) {
        CheckInEvents.EventInfo memory info = eventsContract.eventInfo(eventId);
        if (msg.value != info.priceWei) revert IncorrectPayment();

        eventsContract.recordSale(eventId, msg.value);

        ticketId = nextTicketId++;
        _tickets[ticketId] = Ticket({
            eventId: eventId,
            purchasedAt: uint64(block.timestamp),
            checkedIn: false,
            checkedInAt: 0
        });
        _eventTickets[eventId].push(ticketId);
        _safeMint(msg.sender, ticketId);

        rewardsContract.creditPurchase(msg.sender, eventId, ticketId);

        emit TicketPurchased(ticketId, eventId, msg.sender, msg.value);

        if (msg.value > 0) {
            (bool ok, ) = info.organizer.call{value: msg.value}("");
            if (!ok) revert PaymentFailed();
        }
    }

    function checkIn(uint256 ticketId) external nonReentrant {
        address attendee = _ownerOrRevert(ticketId);
        Ticket storage ticket = _tickets[ticketId];
        if (ticket.checkedIn) revert AlreadyCheckedIn();

        address organizer = eventsContract.getOrganizer(ticket.eventId);
        if (msg.sender != organizer) revert NotOrganizer();

        uint64 timestamp = uint64(block.timestamp);
        ticket.checkedIn = true;
        ticket.checkedInAt = timestamp;

        eventsContract.recordCheckIn(ticket.eventId);
        uint256 bonus = eventsContract.bonusPoints(ticket.eventId);
        rewardsContract.recordAttendance(ticket.eventId, ticketId, attendee, organizer, bonus);

        emit TicketCheckedIn(ticketId, ticket.eventId, attendee, organizer, timestamp);
    }

    function issueBonus(uint256 ticketId, uint256 extraPoints) external nonReentrant {
        _ownerOrRevert(ticketId);
        Ticket storage ticket = _tickets[ticketId];
        if (!ticket.checkedIn) revert NotCheckedIn();

        address organizer = eventsContract.getOrganizer(ticket.eventId);
        if (msg.sender != organizer) revert NotOrganizer();
        rewardsContract.issueOrganizerBonus(ticketId, organizer, extraPoints);
    }

    function getTicket(uint256 ticketId)
        external
        view
        returns (uint256 eventId, address owner, uint64 purchasedAt, bool checkedIn, uint64 checkedInAt)
    {
        owner = _ownerOrRevert(ticketId);
        Ticket memory ticket = _tickets[ticketId];
        return (ticket.eventId, owner, ticket.purchasedAt, ticket.checkedIn, ticket.checkedInAt);
    }

    function ticketsOf(address owner) external view returns (uint256[] memory ids) {
        uint256 n = balanceOf(owner);
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
    }

    function getEventAttendees(uint256 eventId)
        external
        view
        returns (
            uint256[] memory ids,
            address[] memory owners,
            uint64[] memory purchasedAt,
            bool[] memory checkedIn,
            uint64[] memory checkedInAt
        )
    {
        ids = _eventTickets[eventId];
        uint256 n = ids.length;
        owners = new address[](n);
        purchasedAt = new uint64[](n);
        checkedIn = new bool[](n);
        checkedInAt = new uint64[](n);
        for (uint256 i = 0; i < n; i++) {
            uint256 id = ids[i];
            owners[i] = ownerOf(id);
            Ticket memory ticket = _tickets[id];
            purchasedAt[i] = ticket.purchasedAt;
            checkedIn[i] = ticket.checkedIn;
            checkedInAt[i] = ticket.checkedInAt;
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _ownerOrRevert(tokenId);
        Ticket memory ticket = _tickets[tokenId];
        CheckInEvents.EventInfo memory info = eventsContract.eventInfo(ticket.eventId);
        string memory status = ticket.checkedIn ? "Checked In" : "Valid";
        string memory json = string.concat(
            '{"name":"CheckIn Ticket #',
            tokenId.toString(),
            '","description":"Avalanche C-Chain ticket for ',
            info.name,
            '","attributes":[{"trait_type":"Event","value":"',
            info.name,
            '"},{"trait_type":"Status","value":"',
            status,
            '"},{"trait_type":"Category","value":"',
            info.category,
            '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _ownerOrRevert(uint256 tokenId) internal view returns (address owner) {
        owner = _ownerOf(tokenId);
        if (owner == address(0)) revert TicketNotFound();
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address from)
    {
        address current = _ownerOf(tokenId);
        if (current != address(0) && to != address(0)) {
            if (_tickets[tokenId].checkedIn) revert AlreadyCheckedIn();
            if (!eventsContract.transfersAllowed(_tickets[tokenId].eventId)) revert TransfersDisabled();
        }
        from = super._update(to, tokenId, auth);
        if (current != address(0) && to != address(0) && current != to) {
            emit TicketTransferred(tokenId, current, to);
        }
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {
        revert DirectPaymentsDisabled();
    }
}
