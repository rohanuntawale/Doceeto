"use client";

import { cn } from "@/lib/utils/cn";

/**
 * "Continue with Google".
 *
 * A plain link, not a fetch: OAuth is a full-page journey to Google and back,
 * so the browser has to navigate. The ROLE travels in the query string because
 * Google will tell us who someone is but never what they are here — a patient
 * account and a doctor account are different things, decided by which button
 * was pressed.
 */
export function GoogleButton({
  role,
  next,
  label,
  className,
}: {
  role: "patient" | "doctor";
  /** Where to land afterwards; ignored unless it belongs to that role's app. */
  next?: string;
  label?: string;
  className?: string;
}) {
  const href =
    `/api/auth/google/start?role=${role}` +
    (next ? `&next=${encodeURIComponent(next)}` : "");

  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--border)]",
        "bg-cream px-4 text-sm font-medium text-espresso transition-colors hover:brightness-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60",
        className,
      )}
    >
      <GoogleMark />
      {label ?? "Continue with Google"}
    </a>
  );
}

/** Google's mark, inlined — their brand guidelines require the four colours. */
function GoogleMark() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** The "or" rule between the Google button and the password form. */
export function AuthDivider({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--border)]" />
      <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}
