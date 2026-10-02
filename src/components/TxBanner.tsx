import { useSearchParams } from "react-router-dom";
import { txUrl } from "@/config/network";

export function TxBanner() {
  const [params, setParams] = useSearchParams();
  const hash = params.get("tx");
  if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) return null;

  return (
    <div className="mb-6 rounded-2xl border border-good/30 bg-good/10 p-4 text-sm">
      <p className="font-semibold">Transaction confirmed.</p>
      <p className="mt-1 break-all text-muted">{hash}</p>
      <div className="mt-3 flex gap-4">
        <a className="font-semibold text-accent" href={txUrl(hash)} target="_blank" rel="noreferrer">
          View on Avalanche Explorer
        </a>
        <button
          className="text-muted"
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params);
            next.delete("tx");
            setParams(next, { replace: true });
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
