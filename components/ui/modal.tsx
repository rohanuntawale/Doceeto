"use client";

/**
 * A centred dialog, rendered through a portal onto <body>.
 *
 * The portal is the point. Both shells wrap their content in
 * `<main className="relative z-10">`, which opens a stacking context — a
 * dialog rendered inside it can ask for any z-index it likes and still paint
 * *below* the shell's floating dock (a root-level sibling at z-40), because
 * the whole of <main> sits at z-10. Escaping to <body> puts the dialog in the
 * root stacking context where its z-index actually counts.
 *
 * Also handles the things every dialog should do and these used to skip:
 * Escape to close, click-outside to close, and locking the page behind it.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

/** Shared panel styling, so every dialog is the same object. */
export const modalPanelCls =
  "max-h-[90vh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-t-card border border-[var(--border)] bg-espresso-800 p-5 shadow-card sm:rounded-card";

export function Modal({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** The panel itself — usually a <form> carrying `modalPanelCls`. */
  children: React.ReactNode;
  /** Extra classes for the backdrop. */
  className?: string;
}) {
  // createPortal needs a real document, so wait for the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind scrolling while the dialog owns the screen.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
