"use client";

import { useEffect, useState } from "react";

/** True after first client mount - use to gate time-relative UI so
 *  SSR and client markup don't diverge (avoids hydration warnings). */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
