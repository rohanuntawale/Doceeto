"use client";

import { useRef, useState } from "react";
import { Award, BarChart3, FileText, ImagePlus, Loader2, Video, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SocialAvatar } from "@/components/social/author-chip";
import { uploadMedia, useSocialAction } from "@/lib/hooks/social";
import {
  MAX_IMAGES,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POST_MAX,
  formatBytes,
} from "@/lib/social/rules";
import { cn } from "@/lib/utils/cn";
import type { SocialAuthor } from "@/lib/social/types";

type Extra = "poll" | "milestone" | null;

interface Attachment {
  id: string;
  url: string;
  kind: "image" | "video" | "document" | "audio";
  name: string;
  size: number;
}

/**
 * Write a post.
 *
 * Attachments upload AS THEY ARE PICKED, not on submit. The author keeps
 * typing while the bytes go up, and "Post" then sends a few ids and returns
 * immediately — which is what makes posting a 16MB video feel like posting
 * text. The cost is an orphaned media row when a draft is abandoned, which is
 * a cheap thing to be wrong about.
 *
 * The post's TYPE is never sent. The server derives it from what is actually
 * attached, so this component cannot produce a "milestone" with no milestone
 * in it — see inferPostType in lib/social/rules.ts.
 */
export function Composer({ me }: { me: SocialAuthor | null }) {
  const { run } = useSocialAction();
  const toast = useToast();
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [extra, setExtra] = useState<Extra>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDesc, setMilestoneDesc] = useState("");

  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);

  const images = attachments.filter((a) => a.kind === "image");
  const video = attachments.find((a) => a.kind === "video");
  const document_ = attachments.find((a) => a.kind === "document");

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, MAX_IMAGES)) {
        const media = await uploadMedia(file);
        setAttachments((prev) => {
          // One video and one document per post; images stack up to the cap.
          const kept =
            media.kind === "image"
              ? prev.filter((a) => a.kind === "image").slice(0, MAX_IMAGES - 1)
              : prev.filter((a) => a.kind !== media.kind);
          return [...kept, media];
        });
      }
    } catch (err) {
      toast.push({ title: (err as Error).message, tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  const pollReady =
    extra === "poll" &&
    pollQuestion.trim().length > 0 &&
    pollOptions.filter((o) => o.trim()).length >= POLL_MIN_OPTIONS;

  const canPost =
    !posting &&
    !uploading &&
    (content.trim().length > 0 ||
      attachments.length > 0 ||
      pollReady ||
      (extra === "milestone" && milestoneTitle.trim().length > 0));

  async function submit() {
    if (!canPost) return;
    setPosting(true);
    try {
      await run("createPost", {
        content: content.trim(),
        imageIds: images.map((a) => a.id),
        videoId: video?.id ?? null,
        documentId: document_?.id ?? null,
        poll: pollReady
          ? { question: pollQuestion.trim(), options: pollOptions.map((o) => o.trim()).filter(Boolean) }
          : null,
        milestone:
          extra === "milestone" && milestoneTitle.trim()
            ? { title: milestoneTitle.trim(), description: milestoneDesc.trim() }
            : null,
      });
      setContent("");
      setAttachments([]);
      setExtra(null);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setMilestoneTitle("");
      setMilestoneDesc("");
      toast.push({ title: "Posted", tone: "success" });
    } catch (err) {
      // The content filter's rejection arrives here as a plain message — the
      // draft is deliberately kept so nobody loses what they wrote to it.
      toast.push({ title: (err as Error).message, tone: "error" });
    } finally {
      setPosting(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex gap-3">
        {me && <SocialAvatar author={me} className="mt-0.5 h-10 w-10" />}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, POST_MAX))}
          rows={content ? 4 : 2}
          placeholder="Share a case, a question, or something you learned this week…"
          className="min-h-[52px] w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
        />
      </div>

      {attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="relative overflow-hidden rounded-card border border-[var(--border)]"
            >
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="h-24 w-24 object-cover" />
              ) : (
                <div className="flex h-24 w-40 flex-col justify-center gap-1 bg-[var(--surface)] px-3">
                  {a.kind === "video" ? (
                    <Video className="h-4 w-4 text-terracotta" />
                  ) : (
                    <FileText className="h-4 w-4 text-terracotta" />
                  )}
                  <p className="truncate text-[11px] text-[var(--text)]">{a.name || a.kind}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{formatBytes(a.size)}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                aria-label="Remove attachment"
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {extra === "poll" && (
        <div className="mt-3 space-y-2 rounded-card border border-[var(--border)] p-3">
          <Field
            value={pollQuestion}
            onChange={setPollQuestion}
            placeholder="Ask your colleagues a question…"
          />
          {pollOptions.map((option, i) => (
            <Field
              key={i}
              value={option}
              onChange={(v) =>
                setPollOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)))
              }
              placeholder={`Option ${i + 1}`}
            />
          ))}
          {pollOptions.length < POLL_MAX_OPTIONS && (
            <button
              type="button"
              onClick={() => setPollOptions((prev) => [...prev, ""])}
              className="text-xs text-terracotta hover:underline"
            >
              + Add option
            </button>
          )}
        </div>
      )}

      {extra === "milestone" && (
        <div className="mt-3 space-y-2 rounded-card border border-tan/30 bg-tan/10 p-3">
          <Field
            value={milestoneTitle}
            onChange={setMilestoneTitle}
            placeholder="What are you celebrating?"
          />
          <Field
            value={milestoneDesc}
            onChange={setMilestoneDesc}
            placeholder="A line about it (optional)"
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[var(--border)] pt-3">
        <Tool icon={ImagePlus} label="Photo" onClick={() => imageInput.current?.click()} />
        <Tool icon={Video} label="Video" onClick={() => videoInput.current?.click()} />
        <Tool icon={FileText} label="File" onClick={() => docInput.current?.click()} />
        <Tool
          icon={BarChart3}
          label="Poll"
          active={extra === "poll"}
          onClick={() => setExtra((v) => (v === "poll" ? null : "poll"))}
        />
        <Tool
          icon={Award}
          label="Milestone"
          active={extra === "milestone"}
          onClick={() => setExtra((v) => (v === "milestone" ? null : "milestone"))}
        />

        <div className="flex-1" />
        {content.length > POST_MAX - 300 && (
          <span className="mr-2 text-xs tabular-nums text-[var(--text-muted)]">
            {POST_MAX - content.length}
          </span>
        )}
        <Button size="sm" onClick={submit} disabled={!canPost}>
          {posting || uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {uploading ? "Uploading…" : "Post"}
        </Button>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={docInput}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        hidden
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
    </Card>
  );
}

function Field({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta"
    />
  );
}

function Tool({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-terracotta/15 text-terracotta"
          : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
