# CheckIn

CheckIn is a testnet MVP for event tickets, QR check-in, proof of attendance, and reward points on the Avalanche C-Chain.

**Avalanche Testnet. Testnet AVAX only — no real funds are required.**

The app never asks for a seed phrase or private key. Wallet actions open Core Wallet (or another injected EVM wallet) so you can approve or reject them yourself.

## Project structure

```
contracts/          Solidity: events, ERC-721 tickets, rewards
test/               Hardhat tests for the full attendee journey
scripts/            Deploy, seed demo events, export ABIs
src/                React + TypeScript app
src/config/         Avalanche Fuji settings and deployed addresses
src/contracts/abi/  Contract ABIs used by the frontend
server/             Small local API for display names and page views
data/               Sample events and the local metadata file
```

The blockchain is the source of truth for ticket ownership, purchases, check-in, proof of attendance, and points. The local server only stores an optional display name and off-chain page-view counts.

## 1. Installation

Use Node.js 20 or 22 if you can. This project also ran on Node 25, which prints a Hardhat warning.

```bash
cd CheckIn
npm install
```

On Windows PowerShell:

```powershell
copy .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

## 2. Environment variables

`.env.example` lists every variable. Leave them blank until you deploy.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `PRIVATE_KEY` | Hardhat only | Deployer key for Fuji. Use a dedicated testnet wallet. |
| `AVALANCHE_TESTNET_RPC` | Hardhat | Fuji C-Chain RPC. |
| `VITE_CHECKIN_EVENTS_CONTRACT` | Frontend | Optional override for the events contract. |
| `VITE_CHECKIN_TICKETS_CONTRACT` | Frontend | Optional override for the ticket contract. |
| `VITE_CHECKIN_REWARDS_CONTRACT` | Frontend | Optional override for the rewards contract. |
| `VITE_AVALANCHE_TESTNET_RPC` | Frontend | Read-only Fuji RPC. |
| `VITE_DEPLOY_BLOCK` | Frontend | Optional start block for history queries. |

Do not commit `.env`. Do not put a private key in any `VITE_` variable. The frontend reads the chain through the public RPC and sends transactions only through the browser wallet.

## 3. Compile and test

```bash
npm run contracts:compile
npm run contracts:test
npm run contracts:abi
```

`contracts:test` compiles as well. The ABI export copies the contract ABIs into `src/contracts/abi/` for the app.

## 4. Deploy to Avalanche Testnet

1. Create a dedicated testnet wallet and put testnet AVAX in it (see the faucet section).
2. Put that wallet's private key in `.env` as `PRIVATE_KEY`. This key is only for Hardhat. Never paste it into the CheckIn website.
3. Deploy:

```bash
npm run contracts:deploy
```

This deploys `CheckInEvents`, `CheckInRewards`, and `CheckInTickets` to Fuji (chain ID 43113), links them, and renounces the one-time wiring owner. It writes:

- `deployments/fuji.json`
- `src/config/deployed.json`

The second file is what the website reads. Restart the frontend after it changes.

Optional demo events, owned by the deployer wallet:

```bash
npm run contracts:seed
```

Run it again only if you set `SEED_FORCE=1`. Those events are marked Demo. To check them in, the organizer must be that deployer wallet.

## 5. Avalanche testnet configuration

| Setting | Value |
| --- | --- |
| Network | Avalanche Testnet (Fuji) |
| Chain ID | 43113 (`0xA869`) |
| Currency | Testnet AVAX |
| RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| Explorer | `https://testnet.snowtrace.io` |

The site adds this network to the wallet when you click **Switch to Avalanche Testnet**. It does not switch you to Avalanche Mainnet.

## 6. Core Wallet

1. Install the Core extension from [https://core.app/](https://core.app/).
2. Create or import a wallet inside Core. Do this in Core, not in CheckIn.
3. Open Core settings and enable testnet mode.
4. Select the Fuji / Avalanche testnet network. If it is missing, use **Switch to Avalanche Testnet** in CheckIn.
5. Fund it from a faucet.
6. Open CheckIn and click **Connect Wallet**. Approve the connection in the extension.

If another wallet also injects `window.ethereum`, CheckIn prefers the provider that identifies itself as Core.

## 7. Testnet faucet

Request Fuji AVAX from [https://faucet.avax.network/](https://faucet.avax.network/). Core's testnet mode may also show a faucet. You need a small amount for gas, and a little more if a ticket has a price such as 0.01 AVAX.

The deployer wallet needs enough AVAX to deploy all three contracts. A normal Core wallet needs enough for creating an event, buying a ticket, and checking in.

## 8. Contract addresses

Until you deploy, the addresses in `src/config/deployed.json` are empty and the UI shows sample events that cannot be purchased.

After `npm run contracts:deploy`, copy the addresses from `deployments/fuji.json` or from the terminal output. The app loads them from `src/config/deployed.json` unless a `VITE_CHECKIN_*` variable overrides them.

Every confirmed transaction has a **View on Avalanche Explorer** link built from the real transaction hash:

`https://testnet.snowtrace.io/tx/<hash>`

## 9. Start the frontend

```bash
npm run dev:all
```

- Website: [http://localhost:5173](http://localhost:5173)
- Metadata API: [http://127.0.0.1:3001](http://127.0.0.1:3001)

`dev:all` starts both. `npm run dev` starts only the website. Display names and page views need the API; tickets still work from the chain without it.

Production build:

```bash
npm run build
npm run preview
```

## 10. End-to-end test

Use one Core wallet for a first pass, or two wallets if you want a separate organizer and attendee.

1. Deploy the contracts and start `npm run dev:all`.
2. Connect Core Wallet and switch to Avalanche Testnet.
3. Open **Create Event**. The Zambia Web3 Builders Meetup sample can be published from **Events → Preview sample**, or you can type your own event. Example: price `0.01` AVAX, supply `100`.
4. Confirm the transaction in Core. The event page should show the hash and an explorer link.
5. Open the event and click **Buy Ticket**. Review the network, gas, testnet AVAX amount, and contract, then confirm in Core.
6. Open **My Tickets**. The ticket should show a QR code and a ticket ID such as `CHK-000001`.
7. Open **Organizer → Scan** with the organizer wallet (the wallet that created the event). Type the ticket ID if the camera is unavailable.
8. Confirm the ticket shows `VALID`, then click **CHECK IN ATTENDEE** and approve the transaction.
9. The page should say check-in succeeded and that Proof of Attendance was issued.
10. Open **Rewards** with the attendee wallet. You should see points, the attendance proof, and any unlocked badges.
11. Trying to check the same ticket in again should fail in the contract.

Points on a normal check-in are 10 for the purchase, 50 for check-in, 25 for participation, plus the organizer bonus set on the event. An extra bonus can be issued once from the attendee list. These points are not a cash token.

## 11. Common errors

| What you see | What to do |
| --- | --- |
| Please switch to Avalanche Testnet | Click **Switch to Avalanche Testnet**. Chain ID must be 43113. |
| Install the Core Wallet extension | Install Core, refresh the page, then connect. |
| You rejected the transaction | Open the action again and approve it in Core. |
| Not enough testnet AVAX | Use the faucet. The wallet pays the ticket price plus gas. |
| Deploy the CheckIn contracts… | Run the deploy command and restart the frontend. |
| Only the event organizer can do that | Check in with the same wallet that created the event. Seeded demo events belong to `PRIVATE_KEY`, not whichever wallet you connected. |
| This ticket has already been checked in | Expected. A ticket can be checked in once. |
| This event is sold out | Increase the supply from the organizer edit page, or create another event. |
| Camera unavailable | Use the ticket ID field. Camera access requires `localhost` or HTTPS. |
| Hardhat Node.js warning | Prefer Node 20 or 22. The contracts still compile on newer Node if the tests pass. |
| Missing PRIVATE_KEY | Add a testnet key to `.env` before `contracts:deploy`. |
| RPC or history errors | Wait and retry. Public Fuji RPCs rate-limit large log queries. `VITE_DEPLOY_BLOCK` is set automatically in `deployed.json`. |

## What each contract does

- `CheckInEvents.sol` stores the event, price, supply, sales, and organizer.
- `CheckInTickets.sol` mints ERC-721 tickets, takes testnet AVAX, blocks a second check-in, and blocks transfers after check-in or when the event disallows them.
- `CheckInRewards.sol` stores proof of attendance, points, and achievement flags. Only the ticket contract can write them.
