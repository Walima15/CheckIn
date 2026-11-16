# Fuji deployment

Status on 16 November 2026: the contracts are **not deployed**. The throwaway deployer below has a Fuji balance of 0 AVAX. Every public faucet that could be reached asked for a login, a wallet signature, a captcha tied to a connected wallet, or a mainnet balance.

The private key is only in this environment's gitignored `.env`. It is not in git and it is not in this note.

## Deployer to fund

| | |
| --- | --- |
| Address | `0x5dbc0C4E62706d1bBfAba7D67d4Bbf823c800B76` |
| Network | Avalanche Fuji C-Chain |
| Chain ID | 43113 |
| RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| Explorer | https://testnet.snowtrace.io/address/0x5dbc0C4E62706d1bBfAba7D67d4Bbf823c800B76 |

Send **Fuji testnet AVAX** to that address. Do not send mainnet AVAX. A normal drip (0.5–2 AVAX) is enough to deploy and to publish a couple of demo events. At the time of writing, Fuji's base fee was 10 wei, so deploy gas itself is a small fraction of an AVAX.

## Contracts

`npm run contracts:fuji` writes these addresses into `deployments/fuji.json` and `src/config/deployed.json` after a funded deploy. Until then they are empty and the app stays on the sample-event UI.

| Contract | Address | Explorer |
| --- | --- | --- |
| CheckInEvents | not deployed | — |
| CheckInRewards | not deployed | — |
| CheckInTickets | not deployed | — |

CheckInTickets is constructed with the events address and the rewards address. The deploy script links both registries to the ticket contract, then renounces the one-time wiring owner.

## What blocked funding

Tried on 16 November 2026, programmatically and in a browser:

| Faucet | Result |
| --- | --- |
| [Builder Hub](https://build.avax.network/console/primary-network/faucet) `POST /api/evm-chain-faucet` | `401` `Authentication required`. The page says "Log in to Builder Hub". |
| [faucet.avax.network](https://faucet.avax.network/) and the Core faucet | Redirect to the Builder Hub faucet above. |
| [Chainlink Fuji](https://faucets.chain.link/fuji) `POST /api/faucet` | `Could not verify if you are human.` The page's Cloudflare check can be passed, and it then requires a connected wallet signature. The AVAX drip is 0.5. |
| [QuickNode Fuji](https://faucet.quicknode.com/avalanche/fuji) | Asks for a connected wallet. The page showed "Low balance for this chain and network." Their docs also require a mainnet AVAX balance. |
| [Community faucet](https://faucet-community.avax-test.network/) | HTTP 503 `no available server`. |
| Triangle Platform | Service suspended. |
| Google Cloud Web3 faucet | Avalanche Fuji is not in the network list. |

## What to do before the demo

1. Fund `0x5dbc0C4E62706d1bBfAba7D67d4Bbf823c800B76` with Fuji testnet AVAX. The Builder Hub faucet works once you are logged in. Chainlink and QuickNode also work from a wallet you control; transfer a little of that Fuji AVAX to the deployer address.
2. From this checkout, with the existing `.env` still in place, run:

```bash
npm run contracts:fuji
```

That deploys all three contracts, updates the frontend config, and tries verification on Routescan (shown on Snowtrace) and Sourcify. Paste the printed addresses back into the table above.

3. Demo from a **Core wallet you control**, not from this deployer. Fund that wallet from the same faucet, connect it, switch to Avalanche Testnet, and publish an event with **Events → Preview sample**. You are the organizer of events that wallet creates, so check-in works. Seeded events (`npm run contracts:seed`) are owned by the deployer key, which is not in the repo, so do not use those for the live check-in.

## Frontend preview

The site already targets Fuji (`src/config/network.ts`). Contract addresses come from `src/config/deployed.json`, with optional `VITE_CHECKIN_*` overrides.

```bash
npm run build
npm run preview
```

`npm run build` writes a static site to `dist/`. That folder can be published on Netlify or any static host (`npx netlify deploy --dir=dist` once the Netlify CLI is logged in). Display names and page-view counts need the local API (`npm run dev:all` or `npm run server`). Ticket purchase, check-in, and rewards talk to Fuji from the browser wallet and do not need that API.
