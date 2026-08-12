"use client";

import { Bell, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { SocialAvatar } from "@/components/social/author-chip";
import { useNotifications, useSocialAction } from "@/lib/hooks/social";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { SocialNotification } from "@/lib/social/types";

/**
 * Notifications.
 *
 * A community invite renders its accept/decline INLINE, from
 * `metadata.inviteId` — that is what the metadata field is for. A notification
 * that can only say "you were invited" and then makes you go and find the
 * community is a worse version of an email.
 */
export function NotificationsPanel({ onOpen }: { onOpen: (link: string) => void }) {
  const { notifications, unread } = useNotifications();
  const { run } = useSocialAction();
  const toast = useToast();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">
          {unread ? `${unread} unread` : "You're all caught up."}
        </p>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={() => run("markNotifications", {})}>
            <Check className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          desc="Likes, comments, follows, mentions and invitations land here."
          icon={<Bell className="h-6 w-6" />}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {notifications.map((n) => (
              <li key={n.id}>
                <Row
                  notification={n}
                  onOpen={() => {
                    void run("markNotifications", { notificationId: n.id });
                    if (n.link) onOpen(n.link);
                  }}
                  onRespond={async (response) => {
                    try {
                      await run("respondToInvite", {
                        inviteId: String(n.metadata?.inviteId ?? ""),
                        response,
                      });
                      void run("markNotifications", { notificationId: n.id });
                      toast.push({
                        title: response === "accept" ? "Joined" : "Declined",
                        tone: "success",
                      });
                    } catch (err) {
                      toast.push({ title: (err as Error).message, tone: "error" });
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Row({
  notification,
  onOpen,
  onRespond,
}: {
  notification: SocialNotification;
  onOpen: () => void;
  onRespond: (response: "accept" | "decline") => void;
}) {
  const invite =
    notification.type === "community_invite" && Boolean(notification.metadata?.inviteId);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3",
        !notification.read && "bg-terracotta/[0.06]",
      )}
    >
      {notification.sender ? (
        <SocialAvatar author={notification.sender} className="mt-0.5 h-9 w-9 text-[10px]" />
      ) : (
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[var(--text-muted)]">
          <Bell className="h-4 w-4" />
        </span>
      )}

      {/* The accept/decline pair sits OUTSIDE the tappable row rather than
          inside it: a button nested in a button is invalid markup, and the
          browser resolves it by making one of them unreliable. */}
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <p className="text-sm text-[var(--text)]">{notification.title}</p>
          {notification.content && (
            <p className="truncate text-xs text-[var(--text-muted)]">{notification.content}</p>
          )}
          <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
            {timeAgo(notification.createdAt)}
          </p>
        </button>

        {invite && (
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => onRespond("accept")}>
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRespond("decline")}>
              Decline
            </Button>
          </div>
        )}
      </div>

      {!notification.read && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-terracotta" aria-label="Unread" />
      )}
    </div>
  );
}
