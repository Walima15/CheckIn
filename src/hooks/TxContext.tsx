import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { TransactionReceipt, TransactionResponse } from "ethers";
import { addresses } from "@/config/network";
import { txUrl } from "@/config/network";
import { parseTxError } from "@/services/errors";
import { fujiProvider } from "@/services/provider";
import { emitChainUpdate } from "@/hooks/useChainTick";
import { formatAvax, shortAddress } from "@/utils/format";
import { Button } from "@/components/ui";

export type TxRequest = {
  title: string;
  type: string;
  amountAvax: string;
  to?: string;
  summary?: { label: string; value: string }[];
  estimateGas: () => Promise<bigint>;
  send: () => Promise<TransactionResponse>;
  onSuccess?: (receipt: TransactionReceipt) => void;
};

type TxContextValue = {
  openTx: (request: TxRequest) => void;
};

const TxContext = createContext<TxContextValue | null>(null);

type Status = "review" | "waiting" | "processing" | "success" | "failed";

export function TxProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<TxRequest | null>(null);
  const [status, setStatus] = useState<Status>("review");
  const [gas, setGas] = useState<bigint | null>(null);
  const [fee, setFee] = useState<bigint | null>(null);
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");
  const [estimating, setEstimating] = useState(false);

  function close() {
    if (status === "waiting" || status === "processing") return;
    setRequest(null);
  }

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setStatus("review");
    setHash("");
    setError("");
    setGas(null);
    setFee(null);
    setEstimating(true);
    request
      .estimateGas()
      .then(async (units) => {
        if (cancelled) return;
        setGas(units);
        const feeData = await fujiProvider.getFeeData();
        const price = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
        setFee(units * price);
      })
      .catch((err) => {
        if (!cancelled) setError(parseTxError(err));
      })
      .finally(() => {
        if (!cancelled) setEstimating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  async function confirm() {
    if (!request) return;
    setError("");
    setStatus("waiting");
    try {
      const tx = await request.send();
      setHash(tx.hash);
      setStatus("processing");
      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) throw new Error("Transaction reverted on Avalanche.");
      setStatus("success");
      emitChainUpdate();
      request.onSuccess?.(receipt);
    } catch (err) {
      setStatus("failed");
      setError(parseTxError(err));
    }
  }

  const value = useMemo(() => ({ openTx: setRequest }), []);
  const destination = request?.to || addresses.tickets;

  return (
    <TxContext.Provider value={value}>
      {children}
      {request ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-card" role="dialog" aria-modal="true">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Avalanche Testnet</p>
                <h2 className="mt-1 font-display text-2xl font-bold">{request.title}</h2>
              </div>
              {status !== "waiting" && status !== "processing" ? (
                <button className="text-sm text-muted" onClick={close} type="button">
                  Close
                </button>
              ) : null}
            </div>

            <p className="mb-4 text-sm text-muted">Testnet AVAX only — No real funds are required.</p>

            <dl className="space-y-3 rounded-2xl border border-line bg-bg p-4 text-sm">
              <Row label="Network" value="Avalanche Testnet" />
              <Row label="Transaction type" value={request.type} />
              <Row label="Estimated gas" value={estimating ? "Estimating…" : gas ? gas.toString() : "Unavailable"} />
              <Row label="Estimated network fee" value={fee !== null ? `${formatAvax(fee, 6)} AVAX` : "—"} />
              <Row label="Amount of testnet AVAX" value={`${request.amountAvax} AVAX`} />
              <Row label="Destination contract" value={shortAddress(destination)} />
              {request.summary?.map((item) => (
                <Row key={item.label} label={item.label} value={item.value} />
              ))}
            </dl>

            {status === "waiting" ? <Notice>Confirm the transaction in Core Wallet.</Notice> : null}
            {status === "processing" ? <Notice>Transaction is being confirmed on Avalanche.</Notice> : null}
            {status === "success" ? (
              <Notice>
                Transaction confirmed.
                {hash ? (
                  <a className="mt-2 block font-semibold text-accent" href={txUrl(hash)} target="_blank" rel="noreferrer">
                    View on Avalanche Explorer
                  </a>
                ) : null}
              </Notice>
            ) : null}
            {error ? <p className="mt-4 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">{error}</p> : null}
            {hash && status !== "success" ? (
              <a className="mt-3 block text-sm text-accent" href={txUrl(hash)} target="_blank" rel="noreferrer">
                {hash}
              </a>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              {status === "review" ? (
                <Button onClick={confirm} disabled={estimating || Boolean(error && !gas)}>
                  Confirm transaction
                </Button>
              ) : null}
              {status === "success" || status === "failed" ? (
                <Button variant="secondary" onClick={close}>
                  Done
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </TxContext.Provider>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-xl border border-line bg-surface-2 px-3 py-3 text-sm">{children}</div>;
}

export function useTx() {
  const value = useContext(TxContext);
  if (!value) throw new Error("useTx must be used inside TxProvider");
  return value;
}
