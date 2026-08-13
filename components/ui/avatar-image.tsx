"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A photo that degrades to a monogram instead of a broken-image icon.
 *
 * Every avatar in the app used to be written inline as
 * `avatarUrl ? <img src={avatarUrl}/> : <Monogram/>`, which handles exactly one
 * failure — no photo on file. It has no answer for a photo that IS on file and
 * doesn't load, and there are several ordinary ways for that to happen:
 *
 *   • A Google sign-in photo. `lh3.googleusercontent.com` refuses requests that
 *     arrive with a Referer header from an unexpected origin, so the avatar
 *     works in one deployment and 403s in the next. `referrerPolicy` below is
 *     the fix for that specific, common case.
 *   • A stored URL pointing at a media row that has since been deleted.
 *   • A truncated or malformed data-URL from an interrupted upload.
 *   • A whitespace-only string, which is TRUTHY — so the old check chose the
 *     <img> branch and rendered a broken icon for what is really "no photo".
 *   • Offline, or a blocked request.
 *
 * In all of them the browser draws its own broken-image glyph, which on a
 * clinical roster reads as "this profile is damaged" rather than "no photo".
 * The monogram already exists and is the honest answer to every one of them.
 */
export function AvatarImage({
  src,
  fallback,
  background,
  className,
  style,
  title,
  alt = "",
}: {
  /** May be undefined, empty, whitespace, or simply broken. All are handled. */
  src?: string | null;
  /** Shown when there is no usable photo — normally initials. */
  fallback: ReactNode;
  /** Monogram backdrop. Applied only when the fallback is showing. */
  background?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /**
   * Decorative by default: these sit beside the person's name in every layout
   * that uses them, so announcing the name twice is noise.
   */
  alt?: string;
}) {
  // Trimmed, so "   " is correctly treated as no photo at all.
  const url = typeof src === "string" ? src.trim() : "";
  const [failed, setFailed] = useState(false);

  // Reset when the source changes. React reuses a component instance when a
  // list re-orders or a key is recycled, so without this one person's broken
  // photo would keep the NEXT person's working photo hidden behind a monogram.
  useEffect(() => setFailed(false), [url]);

  const showPhoto = Boolean(url) && !failed;

  return (
    <span
      className={cn("grid shrink-0 place-items-center overflow-hidden", className)}
      style={{ ...(showPhoto ? {} : background ? { background } : {}), ...style }}
      title={title}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-cover"
          // Google's CDN rejects cross-origin requests that carry a Referer.
          // Sending none makes an avatar from a Google sign-in load reliably.
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
      )}
    </span>
  );
}
