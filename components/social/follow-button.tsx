"use client";

import { useState } from "react";
import { Check, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useSocialAction } from "@/lib/hooks/social";
import type { FollowStatus } from "@/lib/social/types";

/**
 * Follow / Following, with the state shown optimistically.
 *
 * Optimistic because the tap is the whole interaction: waiting a round trip
 * before the label changes makes a working button feel broken, and people tap
 * it again. The local state is reverted if the write fails, and the query
 * invalidation that follows replaces it with the truth either way.
 *
 * "Follows you" is worth its own label rather than being folded into the
 * button: it tells the reader that one more tap opens a DM, which is the
 * mutual-follow gate made visible instead of discovered by hitting a 403.
 */
export function FollowButton({
  userId,
  status,
  size = "sm",
}: {
  userId: string;
  status: FollowStatus;
  size?: "sm" | "md";
}) {
  const { run } = useSocialAction();
  const toast = useToast();
  const [following, setFollowing] = useState(status.isFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      await run("setFollow", { userId, follow: next });
    } catch (err) {
      setFollowing(!next);
      toast.push({ title: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {status.isFollowedBy && !following && (
        <span className="hidden text-[11px] text-[var(--text-muted)] sm:inline">Follows you</span>
      )}
      <Button
        size={size}
        variant={following ? "outline" : "primary"}
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
      >
        {following ? (
          <>
            {status.isFollowedBy ? <Users className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {status.isFollowedBy ? "Mutual" : "Following"}
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" />
            Follow
          </>
        )}
      </Button>
    </div>
  );
}
