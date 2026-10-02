import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("CheckIn", function () {
  async function deployFixture() {
    const [owner, organizer, buyer, other] = await ethers.getSigners();

    const events = await ethers.deployContract("CheckInEvents");
    const rewards = await ethers.deployContract("CheckInRewards");
    const tickets = await ethers.deployContract("CheckInTickets", [
      await events.getAddress(),
      await rewards.getAddress(),
    ]);

    await events.setTicketsContract(await tickets.getAddress());
    await rewards.setTicketsContract(await tickets.getAddress());

    return { events, rewards, tickets, owner, organizer, buyer, other };
  }

  async function createEvent(
    events: Awaited<ReturnType<typeof deployFixture>>["events"],
    organizer: Awaited<ReturnType<typeof deployFixture>>["organizer"],
    overrides: Record<string, unknown> = {},
  ) {
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const input = {
      name: "Zambia Web3 Builders Meetup",
      description: "A demo builders meetup.",
      imageURI: "",
      startTime: now + 3600,
      endTime: now + 7200,
      venue: "Lusaka Innovation Hub",
      location: "Lusaka, Zambia",
      category: "Web3",
      priceWei: ethers.parseEther("0.01"),
      maxSupply: 100,
      bonusPoints: 15,
      transfersAllowed: true,
      demo: true,
      ...overrides,
    };
    const tx = await events.connect(organizer).createEvent(input);
    await tx.wait();
    return (await events.nextEventId()) - 1n;
  }

  it("runs the buy, check-in, proof, and reward journey", async function () {
    const { events, rewards, tickets, organizer, buyer } = await loadFixture(deployFixture);
    const price = ethers.parseEther("0.01");
    const eventId = await createEvent(events, organizer);
    const before = await ethers.provider.getBalance(organizer.address);

    const tx = await tickets.connect(buyer).buyTicket(eventId, { value: price });
    await expect(tx).to.emit(tickets, "TicketPurchased").and.to.emit(rewards, "RewardIssued");

    const ticketId = 1n;
    expect(await tickets.ownerOf(ticketId)).to.equal(buyer.address);
    expect(await rewards.points(buyer.address)).to.equal(10n);
    expect(await rewards.hasAchievement(buyer.address, "First Ticket")).to.equal(true);

    const after = await ethers.provider.getBalance(organizer.address);
    expect(after - before).to.equal(price);
    expect(await ethers.provider.getBalance(await tickets.getAddress())).to.equal(0n);

    await expect(tickets.connect(organizer).checkIn(ticketId))
      .to.emit(tickets, "TicketCheckedIn")
      .and.to.emit(rewards, "ProofOfAttendanceCreated");

    const proof = await rewards.getProof(ticketId);
    expect(proof.valid).to.equal(true);
    expect(proof.attendee).to.equal(buyer.address);
    expect(proof.organizer).to.equal(organizer.address);
    expect(proof.eventId).to.equal(eventId);

    expect(await rewards.points(buyer.address)).to.equal(100n);
    expect(await rewards.hasAchievement(buyer.address, "First Check-in")).to.equal(true);
    expect(await rewards.hasAchievement(buyer.address, "Explorer")).to.equal(true);

    const stored = await events.eventInfo(eventId);
    expect(stored.sold).to.equal(1n);
    expect(stored.checkedIn).to.equal(1n);
    expect(stored.revenueWei).to.equal(price);
    expect(await tickets.tokenURI(ticketId)).to.include("data:application/json;base64,");

    await tickets.connect(organizer).issueBonus(ticketId, 20);
    expect(await rewards.points(buyer.address)).to.equal(120n);
  });

  it("rejects bad purchases, duplicate check-ins, and unauthorized actions", async function () {
    const { events, rewards, tickets, organizer, buyer, other } = await loadFixture(deployFixture);
    const price = ethers.parseEther("0.01");
    const eventId = await createEvent(events, organizer, { maxSupply: 1 });

    await expect(
      tickets.connect(buyer).buyTicket(eventId, { value: price + 1n }),
    ).to.be.revertedWithCustomError(tickets, "IncorrectPayment");

    await tickets.connect(buyer).buyTicket(eventId, { value: price });
    await expect(tickets.connect(other).buyTicket(eventId, { value: price })).to.be.revertedWithCustomError(
      events,
      "SoldOut",
    );

    await expect(tickets.connect(buyer).checkIn(1n)).to.be.revertedWithCustomError(tickets, "NotOrganizer");
    await tickets.connect(organizer).checkIn(1n);
    await expect(tickets.connect(organizer).checkIn(1n)).to.be.revertedWithCustomError(tickets, "AlreadyCheckedIn");
    await expect(tickets.connect(buyer).issueBonus(1n, 10)).to.be.revertedWithCustomError(tickets, "NotOrganizer");
    await tickets.connect(organizer).issueBonus(1n, 10);
    await expect(tickets.connect(organizer).issueBonus(1n, 10)).to.be.revertedWithCustomError(
      rewards,
      "BonusAlreadyIssued",
    );

    const update = {
      name: "Hijacked",
      description: "nope",
      imageURI: "",
      startTime: 10,
      endTime: 20,
      venue: "Venue",
      location: "Location",
      category: "Web3",
      priceWei: price,
      maxSupply: 1,
      bonusPoints: 0,
      active: true,
      transfersAllowed: true,
    };
    await expect(events.connect(buyer).updateEvent(eventId, update)).to.be.revertedWithCustomError(
      events,
      "NotOrganizer",
    );
    await expect(events.connect(buyer).recordSale(eventId, price)).to.be.revertedWithCustomError(events, "NotTickets");
  });

  it("blocks transfers after check-in and when the event disables them", async function () {
    const { events, tickets, organizer, buyer, other } = await loadFixture(deployFixture);
    const price = ethers.parseEther("0.01");
    const openEvent = await createEvent(events, organizer);
    await tickets.connect(buyer).buyTicket(openEvent, { value: price });

    await expect(tickets.connect(buyer).transferFrom(buyer.address, other.address, 1n)).to.emit(
      tickets,
      "TicketTransferred",
    );
    expect(await tickets.ownerOf(1n)).to.equal(other.address);

    await tickets.connect(organizer).checkIn(1n);
    await expect(tickets.connect(other).transferFrom(other.address, buyer.address, 1n)).to.be.revertedWithCustomError(
      tickets,
      "AlreadyCheckedIn",
    );

    const locked = await createEvent(events, organizer, { transfersAllowed: false, priceWei: 0, bonusPoints: 0 });
    await tickets.connect(buyer).buyTicket(locked, { value: 0 });
    const lockedId = 2n;
    await expect(
      tickets.connect(buyer).transferFrom(buyer.address, other.address, lockedId),
    ).to.be.revertedWithCustomError(tickets, "TransfersDisabled");
    await expect(tickets.connect(organizer).issueBonus(lockedId, 5)).to.be.revertedWithCustomError(
      tickets,
      "NotCheckedIn",
    );
  });
});
