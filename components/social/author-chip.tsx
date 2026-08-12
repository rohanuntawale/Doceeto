"use client";

import { BadgeCheck } from "lucide-react";
import { initials, timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { SocialAuthor } from "@/lib/social/types";

/**
 * A person's face, everywhere in the network.
 *
 * Mirrors components/ui/doctor-avatar.tsx — photo when there is one, monogram
 * on their accent colour when there isn't — but takes a SocialAuthor, so the
 * feed, the DM list and the community roster all render a person identically
 * without any of them reaching for a Doctor row.
 */
export function SocialAvatar({
  author,
  className,
}: {
  author: SocialAuthor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold text-on-accent",
        className,
      )}
      style={author.avatarUrl ? undefined : { background: author.avatarColor }}
    >
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(author.name.replace(/^Dr\.?\s+/i, ""))
      )}
    </span>
  );
}

/**
 * Name, verification and one line of context.
 *
 * The verified tick is only ever rendered from the server's `verified` flag —
 * it is ops sign-off, and on a clinical network it is the difference between
 * "someone claiming to be a cardiologist" and one who has been checked.
 */
export function AuthorChip({
  author,
  at,
  onOpen,
  size = "md",
  trailing,
}: {
  author: SocialAuthor;
  /** ISO timestamp rendered as "4h ago" beside the headline. */
  at?: string;
  onOpen?: (author: SocialAuthor) => void;
  size?: "sm" | "md";
  trailing?: React.ReactNode;
}) {
  const avatarCls = size === "sm" ? "h-8 w-8 text-[10px]" : "h-11 w-11";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={onOpen ? () => onOpen(author) : undefined}
        className={cn("shrink-0", onOpen && "cursor-pointer")}
        aria-label={onOpen ? `Open ${author.name}'s profile` : undefined}
        disabled={!onOpen}
      >
        <SocialAvatar author={author} className={avatarCls} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpen ? () => onOpen(author) : undefined}
            disabled={!onOpen}
            className={cn(
              "truncate text-left font-medium text-[var(--text)]",
              size === "sm" ? "text-[13px]" : "text-sm",
              onOpen && "hover:underline",
            )}
          >
            {author.name}
          </button>
          {author.verified && (
            <BadgeCheck
              className="h-3.5 w-3.5 shrink-0 text-terracotta"
              aria-label="Verified by Doceeto"
            />
          )}
        </div>
        <p className="truncate text-xs text-[var(--text-muted)]">
          {author.headline}
          {at && author.headline ? " · " : ""}
          {at ? timeAgo(at) : ""}
        </p>
      </div>

      {trailing}
    </div>
  );
}
