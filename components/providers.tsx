"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { isDemoMode } from "@/lib/config";
import { startDemoSimulator } from "@/lib/demo/simulator";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  // In demo mode, a self-driving simulator makes the Uber loop actually run
  // for a solo visitor (a nearby doctor auto-accepts and comes to you).
  useEffect(() => {
    if (isDemoMode) startDemoSimulator();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
