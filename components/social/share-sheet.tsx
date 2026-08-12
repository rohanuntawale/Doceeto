"use client";

import { useMemo, useState } from "react";
import { Check, Link2, Loader2, Search, Users } from "lucide-react";
import { Modal, modalPanelCls } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SocialAvatar } from "@/components/social/author-chip";
import { apiFetch } from "@/lib/api/client";
import {
  socialAction,
  useCommunities,
  useConversations,
  useMessageableUsers,
} from "@/lib/hooks/social";
import { excerpt } from "@/lib/social/rules";
import { cn } from "@/lib/utils/cn";
import type { Post, SocialAuthor } from "@/lib/social/types";

/**
 * Share a post to people and communities.
 *
 * COMPOSED CLIENT-SIDE from primitives that already exist — get-or-create a
 * conversation, send a message, post into a channel. There is no "share"
 * endpoint beyond the counter, and there shouldn't be: a share is a message
 * containing a link, and giving it its own server path would mean a second
 * place where the mutual-follow gate and the community access rules have to be
 * enforced identically.
 *
 * Targets come from three sources in order of usefulness: threads you already
 * have, then everyone you *could* message, then your communities. The first
 * two are de-duplicated by user id so a recent contact doesn't appear twice.
 */
export function ShareSheet({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const conversations = useConversations();
  const messageable = useMessageableUsers();
  const communities = useCommunities();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Set<string>>(new Set());
  const [rooms, setRooms] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const targets = useMemo(() => {
    const seen = new Set<string>();
    const out: SocialAuthor[] = [];
    for (const c of conversations) {
      for (const other of c.others) {
        if (seen.has(other.id)) continue;
        seen.add(other.id);
        out.push(other);
      }
    }
    for (const person of messageable) {
      if (seen.has(person.id)) continue;
      seen.add(person.id);
      out.push(person);
    }
    const q = query.trim().toLowerCase();
    return q ? out.filter((p) => p.name.toLowerCase().includes(q)) : out;
  }, [conversations, messageable, query]);

  const myCommunities = communities.filter((c) => c.isMember);
  const total = people.size + rooms.size;

  if (!post) return null;

  const permalink = `${typeof window === "undefined" ? "" : window.location.origin}/doctor/network?post=${post.id}`;
  const body = `${excerpt(post.content || post.poll?.question || post.milestone?.title || "", 140)}\n${permalink}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(permalink);
      toast.push({ title: "Link copied", tone: "success" });
    } catch {
      toast.push({ title: "Couldn't copy the link", tone: "error" });
    }
  }

  async function send() {
    if (!total || !post) return;
    setSending(true);
    let failed = 0;
    try {
      for (const userId of people) {
        try {
          const conv = await socialAction<{ id: string }>("startConversation", { userId });
          await socialAction("sendMessage", { conversationId: conv.id, content: body });
        } catch {
          // One blocked or non-mutual recipient must not abandon the rest.
          failed++;
        }
      }
      for (const communityId of rooms) {
        try {
          // apiFetch, not fetch — every API call has to say which surface it
          // speaks for, or the server may answer as the other role signed in
          // on this browser.
          const res = await apiFetch(
            `/api/social?entity=channels&communityId=${encodeURIComponent(communityId)}`,
          );
          const channels: { id: string; type: string; canRead: boolean }[] = await res.json();
          // The first readable text channel — `general` in practice, since
          // every community is provisioned with it first.
          const channel = channels.find((c) => c.type === "text" && c.canRead);
          if (!channel) throw new Error("no channel");
          await socialAction("sendChannelMessage", { channelId: channel.id, content: body });
        } catch {
          failed++;
        }
      }
      await socialAction("sharePost", { postId: post.id });
      toast.push({
        title: failed ? `Shared to ${total - failed} of ${total}` : "Shared",
        desc: failed ? "Some recipients couldn't be reached." : undefined,
        tone: failed ? "info" : "success",
      });
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={modalPanelCls}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg text-[var(--text)]">Share</h2>
          <Button size="sm" variant="outline" onClick={copyLink}>
            <Link2 className="h-3.5 w-3.5" />
            Copy link
          </Button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta"
          />
        </div>

        {targets.length === 0 && myCommunities.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">
            Follow colleagues who follow you back to share posts with them directly.
          </p>
        )}

        {targets.length > 0 && (
          <>
            <p className="label mt-4">People</p>
            <ul className="mt-1.5 max-h-56 space-y-0.5 overflow-y-auto">
              {targets.map((person) => (
                <li key={person.id}>
                  <Row
                    selected={people.has(person.id)}
                    onToggle={() =>
                      setPeople((prev) => toggle(prev, person.id))
                    }
                    leading={<SocialAvatar author={person} className="h-8 w-8 text-[10px]" />}
                    title={person.name}
                    subtitle={person.headline}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {myCommunities.length > 0 && (
          <>
            <p className="label mt-4">Communities</p>
            <ul className="mt-1.5 max-h-44 space-y-0.5 overflow-y-auto">
              {myCommunities.map((community) => (
                <li key={community.id}>
                  <Row
                    selected={rooms.has(community.id)}
                    onToggle={() => setRooms((prev) => toggle(prev, community.id))}
                    leading={
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface)] text-[var(--text-muted)]">
                        <Users className="h-4 w-4" />
                      </span>
                    }
                    title={community.name}
                    subtitle={`${community.memberCount} members`}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={!total || sending}>
            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Send{total ? ` (${total})` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const toggle = (set: Set<string>, id: string): Set<string> => {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
};

function Row({
  selected,
  onToggle,
  leading,
  title,
  subtitle,
}: {
  selected: boolean;
  onToggle: () => void;
  leading: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--surface)]"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-[var(--text)]">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-[var(--text-muted)]">{subtitle}</span>
        )}
      </span>
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
          selected ? "border-terracotta bg-terracotta text-on-accent" : "border-[var(--border)]",
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}
