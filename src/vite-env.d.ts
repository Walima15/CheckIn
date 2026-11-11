/// <reference types="vite/client" />

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
  providers?: EthereumProvider[];
  isAvalanche?: boolean;
}

interface Window {
  ethereum?: EthereumProvider;
}

interface ImportMetaEnv {
  readonly VITE_CHECKIN_EVENTS_CONTRACT?: string;
  readonly VITE_CHECKIN_TICKETS_CONTRACT?: string;
  readonly VITE_CHECKIN_REWARDS_CONTRACT?: string;
  readonly VITE_AVALANCHE_TESTNET_RPC?: string;
  readonly VITE_DEPLOY_BLOCK?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_USE_EMULATOR?: string;
  readonly VITE_FIRESTORE_EMULATOR_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
