"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  title: string;
  desc?: string;
  tone: ToastTone;
}

const ToastCtx = createContext<{
  push: (t: Omit<Toast, "id">) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((x) => x.id !== id));

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[1100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="popover pointer-events-auto flex animate-fade-up items-start gap-3 rounded-card p-3.5"
          >
            <div className="mt-0.5 shrink-0">
              {t.tone === "success" && (
                <CheckCircle2 className="h-4 w-4 text-status-ok" />
              )}
              {t.tone === "error" && (
                <AlertTriangle className="h-4 w-4 text-terracotta" />
              )}
              {t.tone === "info" && <Info className="h-4 w-4 text-salmon" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-cream">{t.title}</p>
              {t.desc && (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {t.desc}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className={cn(
                "shrink-0 rounded p-1 text-[var(--text-faint)] transition-colors hover:text-cream",
              )}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
