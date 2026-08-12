"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { SocialAvatar } from "@/components/social/author-chip";
import { uploadMedia, useSocialAction, useStories } from "@/lib/hooks/social";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { SocialAuthor, StoryGroup } from "@/lib/social/types";

/**
 * The 24-hour story rail.
 *
 * "Your story" is always the first tile, whether or not there is one to show —
 * an empty rail with a single "+" still tells a new doctor what this row is
 * for, which an empty rail does not. The server does the rest of that work: a
 * reader who follows nobody is shown everybody's stories rather than a blank
 * space (see listStories).
 */
export function StoryRail({ me }: { me: SocialAuthor | null }) {
  const groups = useStories();
  const { run } = useSocialAction();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<StoryGroup | null>(null);

  const mine = groups.find((g) => g.isMine);
  const others = groups.filter((g) => !g.isMine);

  async function add(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const media = await uploadMedia(file);
      await run("createStory", { mediaId: media.id, content: "" });
      toast.push({ title: "Story added — it's live for 24 hours", tone: "success" });
    } catch (err) {
      toast.push({ title: (err as Error).message, tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => (mine ? setViewing(mine) : fileInput.current?.click())}
          className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
        >
          <span className="relative">
            <span
              className={cn(
                "grid h-16 w-16 place-items-center rounded-full p-[2px]",
                mine ? "bg-gradient-to-tr from-terracotta to-tan" : "bg-[var(--surface)]",
              )}
            >
              <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[var(--bg)] p-[2px]">
                {me ? (
                  <SocialAvatar author={me} className="h-full w-full text-sm" />
                ) : (
                  <span className="h-full w-full rounded-full bg-[var(--surface)]" />
                )}
              </span>
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-[var(--bg)] bg-terracotta text-on-accent">
              <Plus className="h-3.5 w-3.5" />
            </span>
          </span>
          <span className="w-full truncate text-center text-[11px] text-[var(--text-muted)]">
            {uploading ? "Adding…" : "Your story"}
          </span>
        </button>

        {others.map((group) => (
          <button
            key={group.author.id}
            type="button"
            onClick={() => setViewing(group)}
            className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-tr from-terracotta to-tan p-[2px]">
              <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-[var(--bg)] p-[2px]">
                <SocialAvatar author={group.author} className="h-full w-full text-sm" />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] text-[var(--text-muted)]">
              {group.author.name.replace(/^Dr\.?\s+/i, "")}
            </span>
          </button>
        ))}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        hidden
        onChange={(e) => {
          void add(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {viewing && (
        <StoryViewer
          group={viewing}
          onClose={() => setViewing(null)}
          onAdd={viewing.isMine ? () => fileInput.current?.click() : undefined}
        />
      )}
    </>
  );
}

/** Six seconds a card, tap either side to step, Escape to leave. */
const STORY_MS = 6000;

function StoryViewer({
  group,
  onClose,
  onAdd,
}: {
  group: StoryGroup;
  onClose: () => void;
  onAdd?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const story = group.stories[index];

  useEffect(() => {
    // Videos run to their own length; only stills are on a timer.
    if (!story || story.mediaType === "video") return;
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1 < group.stories.length ? i + 1 : -1));
    }, STORY_MS);
    return () => clearTimeout(timer);
  }, [story, group.stories.length]);

  // -1 is the sentinel for "past the last one" — closing from inside the
  // effect above would set state on an unmounting component.
  useEffect(() => {
    if (index === -1) onClose();
  }, [index, onClose]);

  if (!story) return null;

  return (
    <Modal open onClose={onClose} className="bg-black/80">
      {/* The backdrop closes on click, so the panel has to stop the bubble —
          otherwise tapping "next" would also dismiss the viewer. */}
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md">
        <div className="flex gap-1 px-1 pb-2">
          {group.stories.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-0.5 flex-1 rounded-full",
                i <= index ? "bg-white" : "bg-white/30",
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 px-1 pb-2">
          <SocialAvatar author={group.author} className="h-8 w-8 text-[10px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{group.author.name}</p>
            <p className="text-[11px] text-white/70">{timeAgo(story.createdAt)}</p>
          </div>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="rounded-full bg-white/15 px-3 py-1 text-xs text-white"
            >
              Add
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative overflow-hidden rounded-card bg-black">
          {story.mediaType === "video" ? (
            <video
              key={story.id}
              src={story.url}
              autoPlay
              playsInline
              controls={false}
              onEnded={() => setIndex((i) => (i + 1 < group.stories.length ? i + 1 : -1))}
              className="max-h-[70dvh] w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.url} alt="" className="max-h-[70dvh] w-full object-contain" />
          )}

          {/* Tap zones, the way every story viewer works. */}
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="absolute inset-y-0 left-0 w-1/3"
          />
          <button
            type="button"
            aria-label="Next"
            onClick={() => setIndex((i) => (i + 1 < group.stories.length ? i + 1 : -1))}
            className="absolute inset-y-0 right-0 w-1/3"
          />
        </div>

        {story.content && <p className="px-1 pt-2 text-sm text-white/90">{story.content}</p>}
      </div>
    </Modal>
  );
}
