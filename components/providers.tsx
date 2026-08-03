"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { RealtimeBridge } from "@/components/realtime-bridge";
import { SiteDownGate } from "@/components/site-down-gate";

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

  return (
    <QueryClientProvider client={client}>
      <RealtimeBridge />
      <SiteDownGate />
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
