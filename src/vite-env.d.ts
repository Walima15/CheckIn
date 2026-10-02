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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
