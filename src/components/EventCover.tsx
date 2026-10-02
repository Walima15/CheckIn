import { useState } from "react";
import { categoryGradient, cx } from "@/utils/format";

export function EventCover({
  src,
  category,
  name,
  className,
}: {
  src?: string;
  category: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(!src);
  if (failed) {
    return (
      <div className={cx("bg-gradient-to-br", categoryGradient(category), className)} role="img" aria-label={name}>
        <div className="flex h-full items-end p-4 text-sm font-semibold text-white/90">{category}</div>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      className={cx("h-full w-full object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
