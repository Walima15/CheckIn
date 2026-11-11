# Supabase to Firebase

CheckIn did not use Supabase. Before this change there was no Supabase client, `supabase/` project, migration, generated types, RLS policy, Auth user, Storage bucket, realtime channel, edge function, or `SUPABASE_` environment variable. The off-chain database was a JSON file, `data/store.json`, read and written by `server/index.mjs`.

Firebase replaces that file. Firestore (Native mode, the Standard rules and Web SDK surface) is the database. The Firebase JS SDK runs in the browser. `firebase-admin` runs in the metadata server. Firebase Authentication and Cloud Storage are not used: CheckIn never had a Supabase auth or file store to replace. Wallet connection stays in Core Wallet. Avalanche Fuji contracts are unchanged.

Enterprise edition was not used. It is a MongoDB-compatible API and does not use `firestore.rules` plus the modular Web SDK this app ships. No remote Firestore database was created here because the Firebase CLI has no signed-in account. Local verification uses the Firestore emulator and project id `checkin-local`.

## Replacement map

| Previous behavior | Firebase replacement |
| --- | --- |
| `store.profiles[address] = { displayName, updatedAt }` | Document `profiles/{lowercaseAddress}` with the same two fields. `updatedAt` stays a number of milliseconds, not a timestamp. |
| `GET /api/profile/:address` and `POST /api/profiles` (at most 100 addresses) | The website reads each document with `getDoc`. The same HTTP routes still exist and read Firestore, so a direct API caller sees the same JSON. |
| `PUT /api/profile/:address` after `ethers.verifyMessage` | Unchanged HTTP route. The server checks the signature, then writes with the Admin SDK. Clients cannot write profiles. |
| `store.views[eventId] += 1` and `GET /api/analytics` | Document `views/{eventId}` field `count`. The website increments with `setDoc` + `increment(1)`. The HTTP routes still increment and list the same counters. |
| No realtime subscription | Still one-shot reads. Opening an event records one view. Nothing listens with `onSnapshot`. |
| No file storage | No Storage bucket and no `storage.rules`. |
| No login provider | No Firebase Auth. The signed message is the write check. |
| Empty file on first run | Empty Firestore. `scripts/seed-firestore.mjs` imports `data/store.json` when that file exists. Demo events remain on Avalanche via `scripts/seed-demo.ts`. |
| No SQL indexes | No composite index. Reads are by document id, plus one full read of `views`. `firestore.indexes.json` is empty on purpose. |

## Access rules

These rules are a prototype. They are meant to keep the data in Firestore safe for the same public reads and signed profile writes the JSON server allowed. Review them before sharing the app more widely.

- Default deny.
- `profiles`: public `get` of one lowercase address. No list. No client create, update, or delete. The server rejects a display name that is not 2–32 characters or that contains a newline, and it rejects a signature that does not recover to that address.
- `views`: public get and list. Create only `{ count: 1 }`. Update only by adding exactly 1 to `count`. No other fields. No delete. The document id is 1–78 digits, which covers every `uint256` event id.

A client cannot assign itself a role. There is no role field.

`package.json` overrides `@firebase/app` to one version. The Web SDK and `firebase-admin` otherwise load two copies, and the browser SDK then fails to start in Node tests.
