import { useEffect, useState, type FormEvent } from "react";
import { Wallet } from "lucide-react";
import { validateDisplayName } from "@/services/account";
import {
  claimBlockMessage,
  CORE_LINKS,
  coreDownloadTarget,
  type CoreDevice,
  type WalletKind,
} from "@/services/coreWallet";
import { Button, Field, inputClass, Panel } from "@/components/ui";

const installCopy: Record<CoreDevice, { body: string; label: string }> = {
  desktop: {
    body: "Install the Core browser extension from the official Core site.",
    label: "Install the Core extension",
  },
  ios: {
    body: "Install the Core app from the App Store.",
    label: "Download Core for iPhone",
  },
  android: {
    body: "Install the Core app from Google Play.",
    label: "Download Core for Android",
  },
};

export function SignUpOptions({
  purpose,
  hasCore,
  hasOtherWallet,
  otherWalletName,
  device,
  connecting = false,
  error,
  accountName,
  connectedKind = null,
  connectedWalletName,
  onConnectCore,
  onConnectOther,
  onCreateAccount,
}: {
  purpose: "signup" | "claim";
  hasCore: boolean;
  hasOtherWallet: boolean;
  otherWalletName?: string | null;
  device?: CoreDevice;
  connecting?: boolean;
  error?: string | null;
  accountName?: string | null;
  connectedKind?: WalletKind | null;
  connectedWalletName?: string | null;
  onConnectCore: () => void;
  onConnectOther?: () => void;
  onCreateAccount?: (displayName: string) => void;
}) {
  const [guideOpen, setGuideOpen] = useState(!hasCore);
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState("");
  const [detected, setDetected] = useState<CoreDevice>("desktop");

  useEffect(() => {
    if (device) return;
    setDetected(coreDownloadTarget(navigator.userAgent));
  }, [device]);

  const platform = device ?? detected;
  const install = installCopy[platform];
  const notice = localError || error;

  function submitAccount(event: FormEvent) {
    event.preventDefault();
    try {
      const displayName = validateDisplayName(name);
      setLocalError("");
      onCreateAccount?.(displayName);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Enter a display name.");
    }
  }

  return (
    <div>
      {purpose === "signup" ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Sign up</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Join CheckIn</h1>
          <p className="mt-3 text-muted">
            Core Wallet is the recommended way to sign up. You can connect it in one step, use another wallet, or create a CheckIn account with no wallet at all.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Core Wallet required</p>
          <h2 className="mt-2 font-display text-2xl font-bold">Claim rewards with Core Wallet</h2>
          <p className="mt-3 text-muted">{claimBlockMessage(connectedKind, connectedWalletName)}</p>
        </div>
      )}

      <div className="mt-6 grid gap-4">
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold">Core Wallet</h2>
                <p className="text-sm text-muted">{hasCore ? "Installed in this browser." : "Not detected in this browser yet."}</p>
              </div>
            </div>
            {purpose === "signup" ? (
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">Recommended</span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={onConnectCore} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect Core Wallet"}
            </Button>
            <Button variant="secondary" onClick={() => setGuideOpen(true)} disabled={connecting}>
              Create a Core Wallet
            </Button>
          </div>

          {guideOpen ? (
            <ol className="mt-6 grid gap-4 border-t border-line pt-5">
              <li className="flex gap-3">
                <StepMark n="1" />
                <div>
                  <p className="font-semibold">Install Core</p>
                  <p className="mt-1 text-sm text-muted">{install.body}</p>
                  <a className="mt-3 inline-flex rounded-full border border-line bg-bg px-4 py-2 text-sm font-semibold" href={CORE_LINKS[platform]} target="_blank" rel="noreferrer">
                    {install.label}
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <StepMark n="2" />
                <div>
                  <p className="font-semibold">Create a wallet in Core</p>
                  <p className="mt-1 text-sm text-muted">
                    Open Core and create a wallet. You can do this quickly with email or Google. CheckIn never asks for your seed phrase or that login.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <StepMark n="3" />
                <div>
                  <p className="font-semibold">Come back and connect</p>
                  <p className="mt-1 text-sm text-muted">
                    Return to CheckIn and click Connect Core Wallet. That button talks to Core specifically, even when another wallet is installed in the same browser.
                  </p>
                </div>
              </li>
            </ol>
          ) : null}
        </Panel>

        {purpose === "signup" ? (
          <>
            <Panel>
              <h2 className="font-display text-xl font-bold">Another wallet</h2>
              <p className="mt-1 text-sm text-muted">
                {hasOtherWallet
                  ? `${otherWalletName ?? "Another browser wallet"} is available. You can sign up with it instead of Core.`
                  : "Use MetaMask or another injected EVM wallet if you have one installed."}
              </p>
              <Button className="mt-4" variant="secondary" onClick={onConnectOther} disabled={connecting}>
                Connect another wallet
              </Button>
              {!hasOtherWallet ? <p className="mt-2 text-xs text-muted">No other browser wallet was detected. You can still create a CheckIn account.</p> : null}
            </Panel>

            <Panel>
              <h2 className="font-display text-xl font-bold">CheckIn account</h2>
              <p className="mt-1 text-sm text-muted">Create a regular CheckIn account without connecting a wallet. You can connect one later.</p>
              {accountName ? (
                <p className="mt-4 font-semibold">Signed in as {accountName}</p>
              ) : (
                <form className="mt-4 grid gap-3" onSubmit={submitAccount}>
                  <Field label="Display name" hint="2–32 characters. Stored on this device.">
                    <input
                      className={inputClass}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      autoComplete="nickname"
                    />
                  </Field>
                  <Button type="submit" variant="secondary" disabled={connecting}>
                    Create account
                  </Button>
                </form>
              )}
            </Panel>
          </>
        ) : null}
      </div>

      {notice ? (
        <p className="mt-4 text-sm text-accent" role="alert">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function StepMark({ n }: { n: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-white">
      {n}
    </span>
  );
}
