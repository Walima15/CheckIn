import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Rewards from "@/pages/Rewards";
import { loadRewardSummary } from "@/services/contracts";

const connectCore = vi.fn();

let walletState: {
  address: string | null;
  walletKind: "core" | "other" | null;
  walletLabel: string | null;
  walletReady: boolean;
  hasCore: boolean;
  hasOtherWallet: boolean;
  otherWalletName: string | null;
  connecting: boolean;
  error: string | null;
  connectCore: typeof connectCore;
};

vi.mock("@/hooks/WalletContext", () => ({
  useWallet: () => walletState,
}));

vi.mock("@/services/contracts", () => ({
  loadRewardSummary: vi.fn(),
  findProofTx: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  connectCore.mockReset();
  connectCore.mockImplementation(() => Promise.resolve());
  vi.mocked(loadRewardSummary).mockReset();
  walletState = {
    address: null,
    walletKind: null,
    walletLabel: null,
    walletReady: true,
    hasCore: false,
    hasOtherWallet: false,
    otherWalletName: null,
    connecting: false,
    error: null,
    connectCore,
  };
});

describe("reward claims require Core Wallet", () => {
  it("opens Core onboarding instead of loading rewards when no wallet is connected", () => {
    render(<Rewards />);

    expect(screen.getByRole("heading", { name: "Claim rewards with Core Wallet" })).toBeTruthy();
    expect(screen.getByText(/claimed to a Core Wallet/i)).toBeTruthy();
    expect(screen.getByText(/email or Google/i)).toBeTruthy();
    expect(screen.queryByText("Total points")).toBeNull();
    expect(loadRewardSummary).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Connect Core Wallet" }));
    expect(connectCore).toHaveBeenCalledOnce();
  });

  it("blocks a claim from a non-Core wallet such as MetaMask", () => {
    walletState = {
      ...walletState,
      address: "0x00000000000000000000000000000000000000aa",
      walletKind: "other",
      walletLabel: "MetaMask",
      hasCore: true,
      hasOtherWallet: true,
      otherWalletName: "MetaMask",
    };

    render(<Rewards />);

    expect(screen.getByText(/You're connected with MetaMask/)).toBeTruthy();
    expect(screen.getByText(/claimed to a Core Wallet/i)).toBeTruthy();
    expect(screen.queryByText("Total points")).toBeNull();
    expect(loadRewardSummary).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Create account" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Connect another wallet" })).toBeNull();
  });

  it("loads the existing rewards once Core is connected", async () => {
    walletState = {
      ...walletState,
      address: "0x00000000000000000000000000000000000000bb",
      walletKind: "core",
      walletLabel: "Core Wallet",
      hasCore: true,
    };
    vi.mocked(loadRewardSummary).mockResolvedValue({
      points: 80n,
      checkInCount: 1n,
      history: [],
      achievements: [],
      proofs: [],
    });

    render(<Rewards />);

    expect(await screen.findByText("Total points")).toBeTruthy();
    expect(screen.getByText("80")).toBeTruthy();
    expect(loadRewardSummary).toHaveBeenCalledWith("0x00000000000000000000000000000000000000bb");
    expect(screen.queryByRole("heading", { name: "Claim rewards with Core Wallet" })).toBeNull();
  });
});
