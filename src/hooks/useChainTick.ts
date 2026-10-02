import { useEffect, useState } from "react";

export function emitChainUpdate() {
  window.dispatchEvent(new Event("checkin:chain"));
}

export function useChainTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onUpdate = () => setTick((value) => value + 1);
    window.addEventListener("checkin:chain", onUpdate);
    return () => window.removeEventListener("checkin:chain", onUpdate);
  }, []);
  return tick;
}
