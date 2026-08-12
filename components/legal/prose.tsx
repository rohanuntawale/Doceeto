import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Info, ShieldAlert, CheckCircle2 } from "lucide-react";

/**
 * Typographic primitives for the legal documents.
 *
 * The project has no @tailwindcss/typography plugin, and a legal page is the
 * wrong place to discover that: these documents need tables, defined terms,
 * numbered clauses and warning callouts that a generic `.prose` sweep would
 * style inconsistently anyway. So the handful of elements the policies actually
 * use are declared here once, on brand tokens, and imported everywhere.
 */

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-[15px] leading-[1.75] text-[var(--text-muted)]">{children}</p>
  );
}

/** A run-in subheading inside a numbered section. */
export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-2 font-sans text-[15px] font-semibold text-cream">
      {children}
    </h3>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-2 pl-1">{children}</ul>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5 text-[15px] leading-[1.7] text-[var(--text-muted)] before:absolute before:left-0 before:top-[0.65em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-terracotta/60">
      {children}
    </li>
  );
}

/** An ordered list of clauses, lettered so it never collides with the
 *  auto-numbered section headings. */
export function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="ml-5 list-[lower-alpha] space-y-2 marker:text-[var(--text-faint)]">
      {children}
    </ol>
  );
}

export function OLI({ children }: { children: ReactNode }) {
  return (
    <li className="pl-1.5 text-[15px] leading-[1.7] text-[var(--text-muted)]">
      {children}
    </li>
  );
}

/** A defined term. Legal documents lean on these heavily; bolding them in the
 *  primary text colour makes a definition scannable in a wall of grey. */
export function T({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-cream">{children}</strong>;
}

/** Internal cross-reference. Prose links to sections rather than citing
 *  numbers, because sections are auto-numbered by position. */
export function Xref({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-terracotta underline decoration-terracotta/30 underline-offset-2 transition-colors hover:decoration-terracotta"
    >
      {children}
    </Link>
  );
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-terracotta underline decoration-terracotta/30 underline-offset-2 transition-colors hover:decoration-terracotta"
    >
      {children}
    </a>
  );
}

export function MailLink({ address }: { address: string }) {
  return (
    <a
      href={`mailto:${address}`}
      className="font-medium text-terracotta underline decoration-terracotta/30 underline-offset-2 transition-colors hover:decoration-terracotta"
    >
      {address}
    </a>
  );
}

const CALLOUT_TONE = {
  critical: {
    wrap: "border-status-critical/35 bg-status-critical/[0.07]",
    icon: "text-status-critical",
    Icon: ShieldAlert,
  },
  warn: {
    wrap: "border-status-warn/35 bg-status-warn/[0.07]",
    icon: "text-status-warn",
    Icon: AlertTriangle,
  },
  info: {
    wrap: "border-[var(--border)] bg-espresso-700/60",
    icon: "text-terracotta",
    Icon: Info,
  },
  ok: {
    wrap: "border-status-ok/30 bg-status-ok/[0.07]",
    icon: "text-status-ok",
    Icon: CheckCircle2,
  },
} as const;

/** A boxed warning. Used sparingly — a page where everything is highlighted
 *  highlights nothing, and the critical tone is reserved for the two or three
 *  statements that could actually cost someone their health. */
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof CALLOUT_TONE;
  title?: string;
  children: ReactNode;
}) {
  const { wrap, icon, Icon } = CALLOUT_TONE[tone];
  return (
    <div className={`rounded-card border p-4 md:p-5 ${wrap}`}>
      <div className="flex gap-3">
        <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} />
        <div className="min-w-0 space-y-2">
          {title ? (
            <div className="text-sm font-semibold text-cream">{title}</div>
          ) : null}
          <div className="space-y-2 text-[14.5px] leading-[1.7] text-[var(--text-muted)] [&_strong]:text-cream">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A data table. Wrapped in its own horizontal scroller so a six-column
 * retention schedule never makes the whole page scroll sideways on a phone.
 */
export function Table({
  columns,
  rows,
  caption,
}: {
  columns: string[];
  rows: ReactNode[][];
  caption?: string;
}) {
  return (
    <figure className="space-y-2">
      <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
        <table className="w-full min-w-[34rem] border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="whitespace-nowrap py-2.5 pr-4 align-bottom text-[11px] font-semibold uppercase tracking-label text-[var(--text-faint)] last:pr-0"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-[var(--border)] align-top last:border-b-0"
              >
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className={`py-3 pr-4 leading-[1.6] last:pr-0 ${
                      j === 0
                        ? "font-medium text-cream"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption ? (
        <figcaption className="text-xs text-[var(--text-faint)]">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/** Label/value rows — entity identifiers, officer contact blocks. Rows whose
 *  value is empty are dropped, so an unfilled CIN prints nothing rather than a
 *  placeholder. */
export function KeyValues({
  items,
}: {
  items: { label: string; value: ReactNode | string }[];
}) {
  const filled = items.filter(
    (i) => !(typeof i.value === "string" && i.value.trim() === ""),
  );
  if (filled.length === 0) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 rounded-card border border-[var(--border)] bg-espresso-800 p-5 sm:grid-cols-[max-content_minmax(0,1fr)]">
      {filled.map((i) => (
        <div key={i.label} className="contents">
          <dt className="text-[11px] uppercase tracking-label text-[var(--text-faint)] sm:pt-0.5">
            {i.label}
          </dt>
          <dd className="text-[14.5px] leading-relaxed text-[var(--text-muted)]">
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A postal address block. */
export function Address({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <address className="not-italic text-[14.5px] leading-[1.7] text-[var(--text-muted)]">
      {lines.map((l) => (
        <span key={l} className="block">
          {l}
        </span>
      ))}
    </address>
  );
}
