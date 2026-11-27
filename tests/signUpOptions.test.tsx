import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SignUpOptions } from "@/components/SignUpOptions";
import { WalletProvider } from "@/hooks/WalletContext";
import SignUp from "@/pages/SignUp";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderOptions(props: Partial<ComponentProps<typeof SignUpOptions>> = {}) {
  const onConnectCore = vi.fn();
  const onConnectOther = vi.fn();
  const onCreateAccount = vi.fn();
  render(
    <SignUpOptions
      purpose="signup"
      hasCore
      hasOtherWallet
      otherWalletName="MetaMask"
      device="desktop"
      onConnectCore={onConnectCore}
      onConnectOther={onConnectOther}
      onCreateAccount={onCreateAccount}
      {...props}
    />,
  );
  return { onConnectCore, onConnectOther, onCreateAccount };
}

describe("sign-up options", () => {
  it("offers Core, another wallet, and a walletless account", () => {
    const { onConnectCore, onConnectOther } = renderOptions();

    fireEvent.click(screen.getByRole("button", { name: "Connect Core Wallet" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect another wallet" }));

    expect(onConnectCore).toHaveBeenCalledOnce();
    expect(onConnectOther).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
    expect(screen.getByText("Recommended")).toBeTruthy();
    expect(screen.getByText(/no wallet at all/i)).toBeTruthy();
  });

  it("does not mention rewards on the sign-up screen", () => {
    renderOptions();
    expect(document.body.textContent?.toLowerCase()).not.toContain("reward");
  });

  it("shows the Core creation guide when Core is not installed", () => {
    renderOptions({ hasCore: false, hasOtherWallet: false, otherWalletName: null });

    expect(screen.getByText(/email or Google/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Install the Core extension" });
    expect(link.getAttribute("href")).toBe("https://core.app/");
    expect(document.body.textContent?.toLowerCase()).not.toContain("reward");
  });

  it("opens the creation guide from Create a Core Wallet when Core is already installed", () => {
    renderOptions();
    expect(screen.queryByText(/email or Google/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Create a Core Wallet" }));

    expect(screen.getByText(/email or Google/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Install the Core extension" }).getAttribute("href")).toBe("https://core.app/");
  });

  it("links phones to the Core mobile apps", () => {
    renderOptions({ hasCore: false, device: "ios" });
    expect(screen.getByRole("link", { name: "Download Core for iPhone" }).getAttribute("href")).toContain("apps.apple.com");

    cleanup();
    renderOptions({ hasCore: false, device: "android" });
    expect(screen.getByRole("link", { name: "Download Core for Android" }).getAttribute("href")).toContain("play.google.com");
  });

  it("creates an account only when the display name is valid", () => {
    const { onCreateAccount } = renderOptions();

    fireEvent.change(screen.getByRole("textbox", { name: /Display name/ }), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreateAccount).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/2-32/);

    fireEvent.change(screen.getByRole("textbox", { name: /Display name/ }), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreateAccount).toHaveBeenCalledWith("Ada");
  });
});

describe("sign-up page", () => {
  it("keeps rewards copy off the page and still creates a walletless account", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <WalletProvider>
          <Routes>
            <Route path="/signup" element={<SignUp />} />
            <Route path="/" element={<p>Home screen</p>} />
          </Routes>
        </WalletProvider>
      </MemoryRouter>,
    );

    expect(document.body.textContent?.toLowerCase()).not.toContain("reward");
    expect(screen.getByRole("button", { name: "Connect Core Wallet" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect another wallet" })).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: /Display name/ }), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Home screen")).toBeTruthy();
    expect(localStorage.getItem("checkin.account")).toContain("Ada");
  });
});
