"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Hash,
  Lock,
  Pin,
  Plus,
  Send,
  Shield,
  Trash2,
  Users,
  Volume2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, modalPanelCls } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { AuthorChip, SocialAvatar } from "@/components/social/author-chip";
import {
  useChannelMessages,
  useChannels,
  useCommunities,
  useCommunityMembers,
  useSocialAction,
} from "@/lib/hooks/social";
import { COMMUNITY_NAME_MAX, MESSAGE_MAX } from "@/lib/social/rules";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Channel, Community, SocialAuthor } from "@/lib/social/types";

/**
 * Communities and their channels.
 *
 * Two levels, one screen: pick a community, pick a channel, read the room. The
 * access rules are the server's (see communityAccess) — this only renders what
 * came back, so a locked channel shows a "request access" affordance because
 * the server said `canRead: false`, never because the client decided.
 *
 * Note what is deliberately absent: nothing here joins you to anything. Opening
 * a community is a read. Posting into it is what makes you a member.
 */
export function CommunitiesPanel({
  meId,
  openCommunity,
  openChannel,
}: {
  meId: string | null;
  openCommunity?: string | null;
  openChannel?: string | null;
}) {
  const communities = useCommunities();
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (openCommunity) setActiveCommunity(openCommunity);
    if (openChannel) setActiveChannel(openChannel);
  }, [openCommunity, openChannel]);

  const community = communities.find((c) => c.id === activeCommunity) ?? null;

  if (!community) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-muted)]">
            Rooms for the conversations that don&apos;t belong in a feed.
          </p>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {communities.map((c) => (
            <CommunityCard key={c.id} community={c} onOpen={() => setActiveCommunity(c.id)} />
          ))}
        </div>

        {creating && <CreateCommunityDialog onClose={() => setCreating(false)} />}
      </div>
    );
  }

  return (
    <CommunityView
      community={community}
      meId={meId}
      activeChannel={activeChannel}
      setActiveChannel={setActiveChannel}
      onBack={() => {
        setActiveCommunity(null);
        setActiveChannel(null);
      }}
    />
  );
}

function CommunityCard({
  community,
  onOpen,
}: {
  community: Community;
  onOpen: () => void;
}) {
  const { run } = useSocialAction();
  const toast = useToast();

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-terracotta/15 text-terracotta">
          {community.visibility === "private" ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Users className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-serif text-base text-[var(--text)]">{community.name}</h3>
            {community.isSystem && (
              <Shield className="h-3.5 w-3.5 shrink-0 text-tan" aria-label="Doceeto community" />
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {community.memberCount} {community.memberCount === 1 ? "member" : "members"}
            {community.isAdmin && " · admin"}
          </p>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-2 flex-1 text-sm text-[var(--text-muted)]">
        {community.description}
      </p>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={onOpen} className="flex-1">
          Open
        </Button>
        {!community.isMember && (
          <Button
            size="sm"
            disabled={community.isPending}
            onClick={async () => {
              try {
                const res = await run<{ pending: boolean }>("joinCommunity", {
                  communityId: community.id,
                });
                toast.push({
                  title: res.pending ? "Request sent" : `Joined ${community.name}`,
                  tone: "success",
                });
              } catch (err) {
                toast.push({ title: (err as Error).message, tone: "error" });
              }
            }}
          >
            {community.isPending ? "Requested" : "Join"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function CommunityView({
  community,
  meId,
  activeChannel,
  setActiveChannel,
  onBack,
}: {
  community: Community;
  meId: string | null;
  activeChannel: string | null;
  setActiveChannel: (id: string | null) => void;
  onBack: () => void;
}) {
  const { channels, error } = useChannels(community.id);
  const members = useCommunityMembers(community.isMember ? community.id : null);
  const { run } = useSocialAction();
  const toast = useToast();
  const [showMembers, setShowMembers] = useState(false);

  // Land on the first readable text channel — `general`, in practice.
  useEffect(() => {
    if (activeChannel || !channels.length) return;
    const first = channels.find((c) => c.type === "text" && c.canRead);
    if (first) setActiveChannel(first.id);
  }, [channels, activeChannel, setActiveChannel]);

  if (error) {
    return (
      <div className="space-y-4">
        <BackBar name={community.name} onBack={onBack} />
        <EmptyState
          title="This community is private"
          desc={error.message}
          icon={<Lock className="h-6 w-6" />}
          action={
            !community.isPending && (
              <Button
                onClick={() =>
                  run("joinCommunity", { communityId: community.id }).then(() =>
                    toast.push({ title: "Request sent", tone: "success" }),
                  )
                }
              >
                Ask to join
              </Button>
            )
          }
        />
      </div>
    );
  }

  const channel = channels.find((c) => c.id === activeChannel) ?? null;

  return (
    <div className="space-y-4">
      <BackBar
        name={community.name}
        onBack={onBack}
        action={
          community.isMember && (
            <Button size="sm" variant="ghost" onClick={() => setShowMembers(true)}>
              <Users className="h-4 w-4" />
              {community.memberCount}
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {channels.map((c) => (
              <li key={c.id}>
                <ChannelRow
                  channel={c}
                  active={c.id === activeChannel}
                  onOpen={() => (c.canRead ? setActiveChannel(c.id) : requestAccess(c))}
                />
              </li>
            ))}
          </ul>
        </Card>

        {channel && channel.canRead ? (
          channel.type === "voice" ? (
            <Card className="grid place-items-center p-10 text-center">
              <div>
                <Volume2 className="mx-auto h-6 w-6 text-[var(--text-faint)]" />
                <p className="mt-2 font-serif text-lg text-[var(--text)]">#{channel.name}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Voice rooms are coming. For now, use a text channel.
                </p>
              </div>
            </Card>
          ) : (
            <ChannelView channel={channel} community={community} meId={meId} />
          )
        ) : (
          <Card className="grid place-items-center p-10">
            <p className="text-sm text-[var(--text-muted)]">Pick a channel.</p>
          </Card>
        )}
      </div>

      {showMembers && (
        <MembersDialog
          community={community}
          members={members}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );

  async function requestAccess(c: Channel) {
    try {
      await run("requestChannelAccess", { channelId: c.id });
      toast.push({ title: "Access requested", tone: "success" });
    } catch (err) {
      toast.push({ title: (err as Error).message, tone: "error" });
    }
  }
}

function BackBar({
  name,
  onBack,
  action,
}: {
  name: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to communities"
        className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <h2 className="min-w-0 flex-1 truncate font-serif text-lg text-[var(--text)]">{name}</h2>
      {action}
    </div>
  );
}

function ChannelRow({
  channel,
  active,
  onOpen,
}: {
  channel: Channel;
  active: boolean;
  onOpen: () => void;
}) {
  const Icon = channel.type === "voice" ? Volume2 : channel.visibility === "private" ? Lock : Hash;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition-colors",
        active ? "bg-[var(--surface)] text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
        !channel.canRead && "opacity-70",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{channel.name}</span>
      {!channel.canRead && (
        <span className="shrink-0 text-[10px]">{channel.isPending ? "requested" : "locked"}</span>
      )}
    </button>
  );
}

function ChannelView({
  channel,
  community,
  meId,
}: {
  channel: Channel;
  community: Community;
  meId: string | null;
}) {
  const { messages } = useChannelMessages(channel.id);
  const members = useCommunityMembers(community.isMember ? community.id : null);
  const { run } = useSocialAction();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    try {
      await run("sendChannelMessage", {
        channelId: channel.id,
        content,
        // Mentions travel as IDS, matched from the roster by the name typed
        // after "@" — the server then re-checks each one against membership,
        // so a stale or crafted id reaches nobody.
        mentions: mentionedIds(content, members.members),
      });
    } catch (err) {
      setDraft(content);
      toast.push({ title: (err as Error).message, tone: "error" });
    }
  }

  return (
    <Card className="flex max-h-[65dvh] flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <Hash className="h-4 w-4 text-[var(--text-muted)]" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">
          {channel.name}
        </p>
        {channel.description && (
          <p className="hidden truncate text-xs text-[var(--text-muted)] sm:block">
            {channel.description}
          </p>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            Nothing here yet. Start the conversation.
          </p>
        )}
        {messages.map((message) => (
          <div key={message.id} className="group flex gap-2.5">
            <SocialAvatar author={message.sender} className="mt-0.5 h-8 w-8 text-[10px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-[13px] font-medium text-[var(--text)]">
                  {message.sender.name}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                  {timeAgo(message.createdAt)}
                </span>
                {message.pinned && <Pin className="h-3 w-3 shrink-0 text-tan" />}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-muted)]">
                {message.content}
              </p>
            </div>

            <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {community.isAdmin && (
                <IconButton
                  icon={Pin}
                  label={message.pinned ? "Unpin" : "Pin"}
                  onClick={() => run("toggleChannelPin", { messageId: message.id })}
                />
              )}
              {message.sender.id === meId && (
                <IconButton
                  icon={Trash2}
                  label="Delete"
                  onClick={() => run("deleteChannelMessage", { messageId: message.id })}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-[var(--border)] p-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MESSAGE_MAX))}
          placeholder={`Message #${channel.name}`}
          className="h-9 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta"
        />
        <Button size="sm" type="submit" disabled={!draft.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}

/**
 * Turn "@Name" in the draft into user ids from the roster.
 *
 * The ids are the payload; the text is only what the reader sees. The server
 * validates every id against the community's members, so the worst a bad match
 * here can do is notify nobody — never the wrong person.
 */
function mentionedIds(content: string, roster: { id: string; name: string }[]): string[] {
  if (!content.includes("@")) return [];
  const lower = content.toLowerCase();
  return roster.filter((m) => lower.includes(`@${m.name.toLowerCase()}`)).map((m) => m.id);
}

function IconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-full text-[var(--text-faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function MembersDialog({
  community,
  members,
  onClose,
}: {
  community: Community;
  members: { members: SocialAuthor[]; pending: SocialAuthor[] };
  onClose: () => void;
}) {
  const { run } = useSocialAction();
  const toast = useToast();

  return (
    <Modal open onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={modalPanelCls}>
        <h2 className="font-serif text-lg text-[var(--text)]">{community.name}</h2>

        {members.pending.length > 0 && (
          <>
            <p className="label mt-4">Requests</p>
            <ul className="mt-1.5 space-y-1">
              {members.pending.map((person) => (
                <li key={person.id} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">
                    {person.name}
                  </span>
                  <Button
                    size="sm"
                    onClick={() =>
                      run("handleJoinRequest", {
                        communityId: community.id,
                        userId: person.id,
                        action: "approve",
                      }).then(() => toast.push({ title: "Approved", tone: "success" }))
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      run("handleJoinRequest", {
                        communityId: community.id,
                        userId: person.id,
                        action: "reject",
                      })
                    }
                  >
                    Decline
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="label mt-4">Members</p>
        <ul className="mt-1.5 max-h-64 space-y-1 overflow-y-auto">
          {members.members.map((person) => (
            <li key={person.id} className="py-1">
              <AuthorChip author={person} size="sm" />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between">
          {community.isMember && !community.isAdmin && (
            <Button
              variant="ghost"
              onClick={() =>
                run("leaveCommunity", { communityId: community.id }).then(() => {
                  toast.push({ title: `Left ${community.name}`, tone: "info" });
                  onClose();
                })
              }
            >
              Leave
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateCommunityDialog({ onClose }: { onClose: () => void }) {
  const { run } = useSocialAction();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await run("createCommunity", {
        name,
        description,
        visibility: isPrivate ? "private" : "public",
        joinPolicy: isPrivate ? "request" : "open",
      });
      toast.push({ title: `${name} created`, tone: "success" });
      onClose();
    } catch (err) {
      toast.push({ title: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose}>
      <form onSubmit={create} onClick={(e) => e.stopPropagation()} className={modalPanelCls}>
        <h2 className="font-serif text-lg text-[var(--text)]">New community</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          It gets a #general and a voice room to start with.
        </p>

        <label className="label mt-4 block">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, COMMUNITY_NAME_MAX))}
          required
          className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-terracotta"
        />

        <label className="label mt-3 block">What is it for?</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          rows={3}
          className="mt-1 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)] outline-none focus:border-terracotta"
        />

        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="accent-[rgb(var(--c-terracotta))]"
          />
          Private, people have to ask to join
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || busy}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
