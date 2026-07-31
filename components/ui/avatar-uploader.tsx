"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { fileToAvatarDataUrl } from "@/lib/utils/image";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

/**
 * Wraps any avatar visual (photo or monogram chip) and makes it an upload
 * control: tap → pick → the file is cropped/downscaled in the browser →
 * `onPhoto` persists the resulting data-URL wherever the caller keeps it
 * (the server for live accounts, localStorage in demo mode).
 *
 * The camera badge is always visible so the affordance is discoverable —
 * an avatar that is secretly a button is a button nobody presses.
 */
export function AvatarUploader({
  onPhoto,
  label = "Change profile photo",
  className,
  badgeClassName,
  children,
}: {
  onPhoto: (dataUrl: string) => Promise<void> | void;
  label?: string;
  className?: string;
  /** Position/size overrides for the camera badge. */
  badgeClassName?: string;
  children: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function onPick(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await onPhoto(dataUrl);
      toast.push({ tone: "success", title: "Profile photo updated" });
    } catch (err) {
      toast.push({
        tone: "error",
        title: "Couldn't set that photo",
        desc: err instanceof Error ? err.message : "Please try another image.",
      });
    } finally {
      setBusy(false);
      // Same file re-picked next time must still fire onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      aria-label={label}
      title={label}
      disabled={busy}
      className={cn(
        "group relative shrink-0 rounded-full focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-terracotta/60",
        className,
      )}
    >
      {children}
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full",
          "border border-[var(--border)] bg-espresso-800 text-cream shadow",
          "transition-colors group-hover:bg-terracotta group-hover:text-on-accent",
          badgeClassName,
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        // The input lives inside the button; without this, its own click
        // bubbles back up and re-opens the picker.
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </button>
  );
}
