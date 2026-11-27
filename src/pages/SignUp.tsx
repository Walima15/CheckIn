import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignUpOptions } from "@/components/SignUpOptions";
import { PageTitle } from "@/components/ui";
import { useWallet } from "@/hooks/WalletContext";

export default function SignUp() {
  const wallet = useWallet();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Sign up" />
      <SignUpOptions
        purpose="signup"
        hasCore={wallet.hasCore}
        hasOtherWallet={wallet.hasOtherWallet}
        otherWalletName={wallet.otherWalletName}
        connecting={wallet.connecting}
        error={error || wallet.error}
        accountName={wallet.account?.displayName ?? null}
        onConnectCore={() => {
          setError("");
          wallet.connectCore().then(() => navigate("/")).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Could not connect Core Wallet.");
          });
        }}
        onConnectOther={() => {
          setError("");
          wallet.connectOther().then(() => navigate("/")).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Could not connect that wallet.");
          });
        }}
        onCreateAccount={(displayName) => {
          setError("");
          try {
            wallet.createAccount(displayName);
            navigate("/");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create the account.");
          }
        }}
      />
    </div>
  );
}
