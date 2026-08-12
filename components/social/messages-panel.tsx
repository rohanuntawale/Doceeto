"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Paperclip,
  Pin,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { AuthorChip, SocialAvatar } from "@/components/social/author-chip";
import {
  uploadMedia,
  useConversations,
  useMessages,
  useSocialAction,
} from "@/lib/hooks/social";
import { MESSAGE_MAX, formatBytes } from "@/lib/social/rules";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ConversationSummary, MessageAttachment } from "@/lib/social/types";

/**
 * Direct messages: thread list beside a conversation.
 *
 * One pane on a phone, two side by side from `lg:` — the list is a navigation
 * step on a small screen and context on a large one, and trying to make it
 * behave the same on both makes it wrong on one.
 */
export function MessagesPanel({
  meId,
  openWith,
  onOpened,
}: {
  meId: string | null;
  /** A conversation to open on mount — set when arriving from a notification. */
  openWith?: string | null;
  onOpened?: () => void;
}) {
  const conversations = useConversations();
  const { run } = useSocialAction();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (openWith) {
      setActiveId(openWith);
      onOpened?.();
    }
  }, [openWith, onOpened]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // Opening a thread clears only YOUR badge — the other side's is untouched.
  useEffect(() => {
    if (!active || active.unreadCount === 0) return;
    void run("markConversationRead", { conversationId: active.id }).catch(() => {});
  }, [active, run]);

  const visible = conversations.filter((c) => !c.archived);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className={cn("overflow-hidden", activeId && "hidden lg:block")}>
        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No conversations yet"
              desc="You can message a colleague once you follow each other."
              icon={<MessageSquare className="h-6 w-6" />}
            />
          </div>
        ) : (
          <ul className="max-h-[65dvh] divide-y divide-[var(--border)] overflow-y-auto">
            {visible.map((conversation) => (
              <li key={conversation.id}>
                <ThreadRow
                  conversation={conversation}
                  active={conversation.id === activeId}
                  onOpen={() => setActiveId(conversation.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {active ? (
        <Thread
          conversation={active}
          meId={meId}
          onBack={() => setActiveId(null)}
          onDeleted={() => setActiveId(null)}
        />
      ) : (
        <Card className="hidden place-items-center p-10 lg:grid">
          <p className="text-sm text-[var(--text-muted)]">
            Pick a conversation to read it.
          </p>
        </Card>
      )}
    </div>
  );
}

function ThreadRow({
  conversation,
  active,
  onOpen,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onOpen: () => void;
}) {
  const other = conversation.others[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        active ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]",
      )}
    >
      {other && <SocialAvatar author={other} className="h-10 w-10" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {conversation.pinned && <Pin className="h-3 w-3 shrink-0 text-tan" />}
          <span className="truncate text-sm font-medium text-[var(--text)]">
            {other?.name ?? "Conversation"}
          </span>
        </span>
        <span className="block truncate text-xs text-[var(--text-muted)]">
          {conversation.lastMessage?.content || "No messages yet"}
        </span>
      </span>
      {conversation.unreadCount > 0 && (
        <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-terracotta px-1.5 text-[11px] font-semibold tabular-nums text-on-accent">
          {conversation.unreadCount}
        </span>
      )}
    </button>
  );
}

function Thread({
  conversation,
  meId,
  onBack,
  onDeleted,
}: {
  conversation: ConversationSummary;
  meId: string | null;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const messages = useMessages(conversation.id);
  const { run } = useSocialAction();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<{ id: string; name: string; size: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const other = conversation.others[0];

  // Follow the conversation down as it grows, the way a chat should.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const media = await uploadMedia(file);
        setPending((prev) => [...prev, { id: media.id, name: media.name || file.name, size: media.size }]);
      }
    } catch (err) {
      toast.push({ title: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content && !pending.length) return;
    setDraft("");
    const attachmentIds = pending.map((p) => p.id);
    setPending([]);
    try {
      await run("sendMessage", { conversationId: conversation.id, content, attachmentIds });
    } catch (err) {
      setDraft(content);
      toast.push({ title: (err as Error).message, tone: "error" });
    }
  }

  return (
    <Card className="flex max-h-[70dvh] flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {other && (
          <div className="min-w-0 flex-1">
            <AuthorChip author={other} size="sm" />
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-label={conversation.pinned ? "Unpin" : "Pin"}
          onClick={() =>
            run("setConversationFlag", {
              conversationId: conversation.id,
              flag: "pinned",
              value: !conversation.pinned,
            })
          }
        >
          <Pin className={cn("h-4 w-4", conversation.pinned && "text-tan")} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Delete conversation"
          onClick={async () => {
            try {
              await run("deleteConversation", { conversationId: conversation.id });
              onDeleted();
            } catch (err) {
              toast.push({ title: (err as Error).message, tone: "error" });
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            Say hello.
          </p>
        )}
        {messages.map((message) => {
          const mine = message.sender.id === meId;
          return (
            <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-card px-3 py-2",
                  mine
                    ? "bg-terracotta text-on-accent"
                    : "bg-[var(--surface)] text-[var(--text)]",
                )}
              >
                {message.content && (
                  <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                )}
                {message.attachments.map((a) => (
                  <Attachment key={a.mediaId} attachment={a} />
                ))}
                <p className={cn("mt-1 text-[10px]", mine ? "text-on-accent/70" : "text-[var(--text-faint)]")}>
                  {timeAgo(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] px-3 py-2">
          {pending.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]"
            >
              {p.name} · {formatBytes(p.size)}
              <button
                type="button"
                onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t border-[var(--border)] p-2.5">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Attach a file"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MESSAGE_MAX))}
          placeholder="Write a message…"
          className="h-9 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta"
        />
        <Button size="sm" type="submit" disabled={!draft.trim() && !pending.length} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void attach(e.target.files);
            e.target.value = "";
          }}
        />
      </form>
    </Card>
  );
}

function Attachment({ attachment }: { attachment: MessageAttachment }) {
  if (attachment.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={attachment.url}
        alt=""
        loading="lazy"
        className="mt-1.5 max-h-64 rounded-lg object-cover"
      />
    );
  }
  return (
    <a
      href={attachment.url}
      className="mt-1.5 flex items-center gap-2 rounded-lg bg-black/10 px-2.5 py-1.5 text-xs underline-offset-2 hover:underline"
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{attachment.name}</span>
      <span className="shrink-0 opacity-70">{formatBytes(attachment.size)}</span>
    </a>
  );
}
