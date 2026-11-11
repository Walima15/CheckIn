# CheckIn

CheckIn is a testnet MVP for event tickets, QR check-in, proof of attendance, and reward points on the Avalanche C-Chain.

**Avalanche Testnet. Testnet AVAX only — no real funds are required.**

The app never asks for a seed phrase or private key. Wallet actions open Core Wallet (or another injected EVM wallet) so you can approve or reject them yourself.

## Project structure

```
contracts/          Solidity: events, ERC-721 tickets, rewards
test/               Hardhat tests for the attendee journey
test-firestore/     Firestore emulator tests for names and page views
scripts/            Deploy, seed demo events, export ABIs, seed Firestore
src/                React + TypeScript app
src/config/         Avalanche Fuji settings and deployed addresses
src/contracts/abi/  Contract ABIs used by the frontend
server/             Wallet-signed display names, writing through Firebase Admin
data/               Sample events. Optional data/store.json import for Firestore
firestore.rules     Access rules for profiles and page views
```

The blockchain is the source of truth for ticket ownership, purchases, check-in, proof of attendance, and points. Firestore stores an optional display name and off-chain page-view counts. Wallet connection stays in Core Wallet. CheckIn does not use Firebase Authentication or Cloud Storage.

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
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase web config. Public in the built site. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | Firebase web config. |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Firebase project id. Blank uses `checkin-local` for the emulator. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend | Firebase web config. The app does not upload files. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend | Firebase web config. |
| `VITE_FIREBASE_APP_ID` | Frontend | Firebase web config. |
| `VITE_FIREBASE_USE_EMULATOR` | Frontend | Set to `false` to use a real project from `npm run dev`. Dev already uses the emulator. |
| `VITE_FIRESTORE_EMULATOR_HOST` | Frontend | Emulator host and port. Default `127.0.0.1:8080`. |
| `FIREBASE_PROJECT_ID` | Metadata server | Admin SDK project. `checkin-local` for the emulator. |
| `FIRESTORE_EMULATOR_HOST` | Metadata server | Set to `127.0.0.1:8080` for local. Unset it in production. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Metadata server | Path to a service account JSON file. Do not commit the file. |
| `FIREBASE_SERVICE_ACCOUNT` | Metadata server | Service account JSON on one line. Alternative to the file path. Do not commit it. |

Do not commit `.env`. Do not put a private key in any `VITE_` variable. The frontend reads the chain through the public RPC and sends transactions only through the browser wallet. The Firebase web keys are meant to be public. The service account is not.

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

## 9. Firebase and the local app

Firestore holds two collections:

- `profiles/{walletAddress}` with `displayName` and `updatedAt`
- `views/{eventId}` with `count`

Saving a display name still asks Core Wallet to sign a message. The metadata server checks that signature and writes the profile with the Admin SDK. The website reads profiles and increments page views with the Firebase JS SDK.

Java 21 or newer is required for the emulator.

Create a Firebase project when you want a shared database:

1. In the Firebase console, create a project and create a Firestore database in Native mode (Standard).
2. Register a web app and copy its config into the `VITE_FIREBASE_*` variables.
3. Create a service account with the Cloud Datastore User role. Set `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT`. Leave `FIRESTORE_EMULATOR_HOST` empty in that environment.
4. Point the CLI at the project and deploy the rules and indexes:

```bash
npx firebase-tools use <your-project-id>
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Authentication and Storage stay off. Wallet signatures are the only identity check, and the app does not store files.

Run everything locally against the emulator:

```bash
npm run dev:all
```

- Website: [http://localhost:5173](http://localhost:5173)
- Metadata API: [http://127.0.0.1:3001](http://127.0.0.1:3001)
- Emulator UI: [http://127.0.0.1:4000](http://127.0.0.1:4000)

`npm run dev` starts only the website, which still expects the emulator on port 8080. Tickets still work from the chain if Firestore is down. Names fall back to shortened wallet addresses, and page views are skipped.

Import an old `data/store.json` file into the emulator or a real project:

```bash
npm run seed:firestore
```

With no file, that command seeds nothing. Demo events are still created on Avalanche with `npm run contracts:seed`.

Metadata tests:

```bash
npm run test:metadata
```

Production build:

```bash
npm run lint
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
| Names stay as short addresses, or page views stay at 0 | Start `npm run dev:all` so the Firestore emulator and metadata server are running. A production build needs the `VITE_FIREBASE_*` variables and deployed rules. |

## What each contract does

- `CheckInEvents.sol` stores the event, price, supply, sales, and organizer.
- `CheckInTickets.sol` mints ERC-721 tickets, takes testnet AVAX, blocks a second check-in, and blocks transfers after check-in or when the event disallows them.
- `CheckInRewards.sol` stores proof of attendance, points, and achievement flags. Only the ticket contract can write them.
