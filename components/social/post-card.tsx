"use client";

import { useState } from "react";
import {
  Award,
  Bookmark,
  Check,
  FileText,
  Flag,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trash2,
  UserMinus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AuthorChip, SocialAvatar } from "@/components/social/author-chip";
import { useSocialAction } from "@/lib/hooks/social";
import { COMMENT_MAX, excerpt } from "@/lib/social/rules";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Post, SocialAuthor } from "@/lib/social/types";

/**
 * One post.
 *
 * Every action here is OPTIMISTIC on the counter it owns and authoritative
 * nowhere: the like fills instantly, the server returns the real count, and
 * the SSE invalidation replaces the whole post shortly after. A feed where the
 * heart waits for the network reads as broken long before it reads as careful.
 */
export function PostCard({
  post,
  meId,
  onOpenAuthor,
  onShare,
  innerRef,
}: {
  post: Post;
  meId: string | null;
  onOpenAuthor?: (author: SocialAuthor) => void;
  /** Opens the share sheet; the card only bumps the counter. */
  onShare?: (post: Post) => void;
  /** Impression observer, from useImpressions(). */
  innerRef?: (node: HTMLElement | null) => void;
}) {
  const { run } = useSocialAction();
  const toast = useToast();
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.isBookmarked);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [voting, setVoting] = useState(false);
  const isMine = meId != null && post.author.id === meId;

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const result = await run<{ likeCount: number }>("toggleLike", { postId: post.id });
      setLikeCount(result.likeCount);
    } catch (err) {
      setLiked(!next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
      toast.push({ title: (err as Error).message, tone: "error" });
    }
  }

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    try {
      await run("toggleSave", { postId: post.id });
    } catch (err) {
      setSaved(!next);
      toast.push({ title: (err as Error).message, tone: "error" });
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return;
    setComment("");
    try {
      await run("addComment", { postId: post.id, text });
    } catch (err) {
      setComment(text);
      toast.push({ title: (err as Error).message, tone: "error" });
    }
  }

  async function vote(optionIndex: number) {
    if (post.poll?.userVoted != null || voting) return;
    setVoting(true);
    try {
      await run("votePoll", { postId: post.id, optionIndex });
    } catch (err) {
      toast.push({ title: (err as Error).message, tone: "error" });
    } finally {
      setVoting(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/doctor/network?post=${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.push({ title: "Link copied", tone: "success" });
    } catch {
      toast.push({ title: "Couldn't copy the link", tone: "error" });
    }
    setMenuOpen(false);
  }

  async function menuAction(action: string, payload: Record<string, unknown>, done: string) {
    setMenuOpen(false);
    try {
      await run(action, payload);
      toast.push({ title: done, tone: "success" });
    } catch (err) {
      toast.push({ title: (err as Error).message, tone: "error" });
    }
  }

  return (
    // The observed node is this wrapper, not the Card — Card is a plain
    // function component with no forwarded ref, and attaching one would
    // silently do nothing (so every impression would go uncounted).
    <div ref={innerRef}>
      <Card className="overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <AuthorChip author={post.author} at={post.createdAt} onOpen={onOpenAuthor} />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Post options"
            className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              {/* Click-away layer, so the menu closes the way every menu does. */}
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-card border border-[var(--border)] bg-espresso-800 py-1 shadow-card">
                <MenuItem icon={Link2} label="Copy link" onClick={copyLink} />
                {isMine ? (
                  <MenuItem
                    icon={Trash2}
                    label="Delete post"
                    danger
                    onClick={() =>
                      menuAction("deletePost", { postId: post.id }, "Post deleted")
                    }
                  />
                ) : (
                  <>
                    {/* Report and block sit beside each other deliberately
                        they are the two things a person needs when something
                        is wrong, and hunting for the second one is a bad
                        moment to have. */}
                    <MenuItem
                      icon={Flag}
                      label="Report post"
                      onClick={() =>
                        menuAction(
                          "report",
                          { targetType: "post", targetId: post.id, reason: "Reported from feed" },
                          "Reported. Our team will review it.",
                        )
                      }
                    />
                    <MenuItem
                      icon={UserMinus}
                      label={`Block ${post.author.name.split(" ")[0]}`}
                      danger
                      onClick={() =>
                        menuAction(
                          "setBlock",
                          { userId: post.author.id, blocked: true },
                          "Blocked. You won't see each other.",
                        )
                      }
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {post.content && (
        <p className="whitespace-pre-wrap px-4 pt-3 text-[15px] leading-relaxed text-[var(--text)] sm:px-5">
          {post.content}
        </p>
      )}

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-2.5 sm:px-5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {post.milestone && (
        <div className="mx-4 mt-3 flex items-start gap-3 rounded-card border border-tan/30 bg-tan/10 p-4 sm:mx-5">
          <Award className="mt-0.5 h-5 w-5 shrink-0 text-tan" />
          <div className="min-w-0">
            <p className="font-serif text-base text-[var(--text)]">{post.milestone.title}</p>
            {post.milestone.description && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">{post.milestone.description}</p>
            )}
          </div>
        </div>
      )}

      {post.images.length > 0 && (
        <div
          className={cn(
            "mt-3 grid gap-1",
            post.images.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {post.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              className="max-h-[520px] w-full bg-[var(--surface)] object-cover"
            />
          ))}
        </div>
      )}

      {post.video && (
        <video
          src={post.video.url}
          controls
          playsInline
          preload="metadata"
          className="mt-3 max-h-[520px] w-full bg-black"
        />
      )}

      {post.document && (
        <a
          href={post.document.url}
          className="mx-4 mt-3 flex items-center gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:brightness-110 sm:mx-5"
        >
          <FileText className="h-5 w-5 shrink-0 text-terracotta" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text)]">
              {post.document.title}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {post.document.type} · {post.document.size}
            </p>
          </div>
        </a>
      )}

      {post.poll && (
        <div className="mx-4 mt-3 rounded-card border border-[var(--border)] p-4 sm:mx-5">
          <p className="text-sm font-medium text-[var(--text)]">{post.poll.question}</p>
          <div className="mt-3 space-y-2">
            {post.poll.options.map((option, i) => {
              const voted = post.poll?.userVoted === i;
              // Results appear only after voting. Showing them first turns a
              // poll into a popularity check and skews every later answer.
              const revealed = post.poll?.userVoted != null;
              return (
                <button
                  key={option.text}
                  type="button"
                  onClick={() => vote(i)}
                  disabled={revealed || voting}
                  className={cn(
                    "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    voted
                      ? "border-terracotta text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-muted)]",
                    !revealed && "hover:border-terracotta hover:text-[var(--text)]",
                  )}
                >
                  {revealed && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 bg-terracotta/15"
                      style={{ width: `${option.percentage}%` }}
                    />
                  )}
                  <span className="relative flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 truncate">
                      {voted && <Check className="h-3.5 w-3.5 shrink-0 text-terracotta" />}
                      {option.text}
                    </span>
                    {revealed && (
                      <span className="shrink-0 tabular-nums text-xs">{option.percentage}%</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs text-[var(--text-muted)]">
            {post.poll.totalVotes} {post.poll.totalVotes === 1 ? "vote" : "votes"}
            {post.poll.userVoted == null && " · tap to vote"}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 border-t border-[var(--border)] px-2 py-1.5 sm:px-3">
        <Action
          icon={Heart}
          label={likeCount || ""}
          active={liked}
          activeCls="text-terracotta"
          filled={liked}
          onClick={toggleLike}
          aria={liked ? "Unlike" : "Like"}
        />
        <Action
          icon={MessageCircle}
          label={post.commentCount || ""}
          active={showComments}
          onClick={() => setShowComments((v) => !v)}
          aria="Comments"
        />
        <Action
          icon={Send}
          label={post.shareCount || ""}
          onClick={() => onShare?.(post)}
          aria="Share"
        />
        <div className="flex-1" />
        <Action
          icon={Bookmark}
          active={saved}
          filled={saved}
          activeCls="text-tan"
          onClick={toggleSave}
          aria={saved ? "Remove bookmark" : "Save"}
        />
      </div>

      {showComments && (
        <div className="border-t border-[var(--border)] px-4 py-3 sm:px-5">
          {post.comments.length === 0 && (
            <p className="pb-2 text-xs text-[var(--text-muted)]">
              No comments yet, start the discussion.
            </p>
          )}
          <ul className="space-y-3">
            {post.comments.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <SocialAvatar author={c.author} className="mt-0.5 h-7 w-7 text-[10px]" />
                <div className="min-w-0 flex-1 rounded-card bg-[var(--surface)] px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-medium text-[var(--text)]">
                      {c.author.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--text-muted)]">
                    {c.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {post.commentCount > post.comments.length && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Showing the latest {post.comments.length} of {post.commentCount}.
            </p>
          )}

          <form onSubmit={submitComment} className="mt-3 flex items-center gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              placeholder="Add a comment…"
              className="h-9 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta"
            />
            <Button size="sm" type="submit" disabled={!comment.trim()}>
              Post
            </Button>
          </form>
        </div>
      )}
      </Card>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  active,
  filled,
  activeCls = "text-[var(--text)]",
  onClick,
  aria,
}: {
  icon: React.ComponentType<{ className?: string; fill?: string }>;
  label?: string | number;
  active?: boolean;
  filled?: boolean;
  activeCls?: string;
  onClick: () => void;
  aria: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors",
        active ? activeCls : "text-[var(--text-muted)] hover:text-[var(--text)]",
      )}
    >
      <Icon className="h-[18px] w-[18px]" fill={filled ? "currentColor" : "none"} />
      {label !== "" && label != null && <span className="tabular-nums">{label}</span>}
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-[var(--surface)]",
        danger ? "text-status-critical" : "text-[var(--text)]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

/** Shared by the share sheet and notification previews. */
export const postPreview = (post: Post): string =>
  excerpt(post.content || post.milestone?.title || post.poll?.question || "a post", 140);
