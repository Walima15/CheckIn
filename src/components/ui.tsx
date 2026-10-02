import { useEffect } from "react";
import { cx } from "@/utils/format";

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const variants = {
    primary: "bg-accent text-white hover:brightness-110",
    secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
    ghost: "text-ink hover:bg-surface-2",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none ring-accent focus:ring-2";

export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title === "CheckIn" ? title : `${title} · CheckIn`;
  }, [title]);
  return null;
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cx("rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6", className)}>{children}</section>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel className="text-center">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Panel>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Valid"
      ? "bg-good/15 text-good"
      : status === "Checked In" || status === "VALID"
        ? "bg-good/15 text-good"
        : status === "Used" || status === "CHECKED IN"
          ? "bg-warn/15 text-warn"
          : "bg-surface-2 text-muted";
  return <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>{status}</span>;
}
