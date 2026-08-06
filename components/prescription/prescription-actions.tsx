"use client";

/**
 * What you can do with a prescription once you have it: share it, save it,
 * copy the link.
 *
 * Three exits, in the order people actually reach for them here:
 *  • WhatsApp — how a prescription travels in India. It goes to a son in
 *    another city, or to the chemist downstairs. The message carries the FULL
 *    text, not just a link, so the person receiving it can act on it without
 *    opening anything; the link follows for the printable copy.
 *  • Save a copy — the browser's print dialog, which offers "Save as PDF" on
 *    every desktop and phone this app targets. Called "Save as PDF" rather
 *    than "Print" because saving is what people come here to do.
 *  • Copy link — for email, a portal, or pasting into any other app.
 *
 * On phones with the Web Share sheet, sharing routes through it instead, so
 * WhatsApp, Telegram, mail and Files all appear without us picking for them.
 */
import { useState } from "react";
import { Download, Link2, Check, Share2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { rxShareText, whatsappUrl } from "@/lib/prescriptions/rules";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import type { Prescription } from "@/lib/types/domain";

/** The public URL for this prescription. Absolute — it is going into a message. */
export function shareUrlOf(rx: Prescription): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/rx/${rx.shareToken}`;
}

export function PrescriptionActions({
  rx,
  className,
}: {
  rx: Prescription;
  className?: string;
}) {
  const toast = useToast();
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  const url = () => shareUrlOf(rx);
  const text = () => rxShareText(rx, url());

  /**
   * The native share sheet when the device has one, WhatsApp directly when it
   * does not. Not a preference — on a desktop browser there is no share sheet
   * at all, and a dead button is worse than an opinionated one.
   */
  async function share() {
    const payload = { title: `Prescription ${rx.code}`, text: text() };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // Cancelled, or the sheet refused the payload — fall through to
        // WhatsApp rather than leaving the tap with nothing to show for it.
      }
    }
    window.open(whatsappUrl(text()), "_blank", "noopener,noreferrer");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.push({ tone: "success", title: t("rx.linkCopied"), desc: t("rx.linkCopiedDesc") });
    } catch {
      toast.push({ tone: "error", title: t("rx.copyFailed"), desc: url() });
    }
  }

  return (
    <div className={cn("no-print grid grid-cols-3 gap-2", className)}>
      <Action onClick={share} icon={<Share2 className="h-4 w-4" />} primary>
        {t("rx.share")}
      </Action>
      <Action onClick={() => window.print()} icon={<Download className="h-4 w-4" />}>
        {t("rx.save")}
      </Action>
      <Action
        onClick={copy}
        icon={copied ? <Check className="h-4 w-4 text-status-ok" /> : <Link2 className="h-4 w-4" />}
      >
        {copied ? t("rx.copied") : t("rx.copyLink")}
      </Action>
    </div>
  );
}

function Action({
  children,
  icon,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Stacked icon over label: three equal targets that stay legible at
        // 320px, where a row of icon+text buttons would either wrap or clip.
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c-terracotta))]",
        primary
          ? "border-terracotta bg-terracotta text-on-accent hover:bg-terracotta-700"
          : "border-[var(--border)] text-cream hover:border-terracotta/50 hover:bg-white/5",
      )}
    >
      {icon}
      <span className="leading-none">{children}</span>
    </button>
  );
}
