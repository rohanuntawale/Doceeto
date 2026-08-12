"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  Compass,
  Bookmark,
  Flame,
  Loader2,
  MessageSquare,
  Newspaper,
  Users,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Composer } from "@/components/social/composer";
import { StoryRail } from "@/components/social/story-rail";
import { PostCard } from "@/components/social/post-card";
import { ShareSheet } from "@/components/social/share-sheet";
import { PeoplePanel } from "@/components/social/people-panel";
import { MessagesPanel } from "@/components/social/messages-panel";
import { CommunitiesPanel } from "@/components/social/communities-panel";
import { NotificationsPanel } from "@/components/social/notifications-panel";
import { EngagementPanel } from "@/components/social/engagement-panel";
import { useImpressions } from "@/components/social/use-impressions";
import {
  socialAction,
  useFeed,
  useGraph,
  useNotifications,
  usePost,
  useSavedPosts,
} from "@/lib/hooks/social";
import { rank, type FeedTab } from "@/lib/social/ranking";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { cn } from "@/lib/utils/cn";
import type { Post, SocialAuthor } from "@/lib/social/types";

type Section = "feed" | "people" | "messages" | "communities" | "alerts" | "stats";

const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: "feed", label: "Feed", icon: Newspaper },
    { id: "people", label: "People", icon: UserRound },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "communities", label: "Communities", icon: Users },
    { id: "alerts", label: "Alerts", icon: Bell },
    { id: "stats", label: "Stats", icon: BarChart3 },
  ];

const FEED_TABS: { id: FeedTab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: "discover", label: "For you", icon: Compass },
    { id: "following", label: "Following", icon: Users },
    { id: "trending", label: "Trending", icon: Flame },
    { id: "saved", label: "Saved", icon: Bookmark },
  ];

export default function NetworkPage() {
  // useSearchParams needs a Suspense boundary to keep the route statically
  // analysable — without it the whole page opts into dynamic rendering.
  return (
    <Suspense fallback={<div className="h-40" />}>
      <Network />
    </Suspense>
  );
}

function Network() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useCurrentDoctor();
  const { unread } = useNotifications();

  const [section, setSection] = useState<Section>(
    (params.get("tab") as Section) || "feed",
  );
  const [tab, setTab] = useState<FeedTab>("discover");
  const [sharing, setSharing] = useState<Post | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(params.get("thread"));

  /** A permalink (?post=…) opens that one post above the feed. */
  const permalinkId = params.get("post");
  const permalink = usePost(permalinkId);

  const meAuthor: SocialAuthor | null = useMemo(
    () =>
      me
        ? {
            id: me.id,
            name: me.fullName,
            role: me.cadre === "nurse" ? "nurse" : "doctor",
            cadre: me.cadre,
            headline: me.specialty,
            avatarUrl: me.avatarUrl,
            avatarColor: me.avatarColor,
            verified: me.verified,
          }
        : null,
    [me],
  );

  return (
    <>
      <PageHeader
        label="Network"
        title="Your professional feed"
        action={
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors",
                  section === id
                    ? "bg-terracotta text-on-accent"
                    : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {id === "alerts" && unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-status-critical px-1 text-[10px] font-semibold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        }
      />

      {section === "feed" && (
        <FeedSection
          me={meAuthor}
          tab={tab}
          setTab={setTab}
          permalink={permalink}
          onClearPermalink={() => router.replace("/doctor/network")}
          onShare={setSharing}
        />
      )}

      {section === "people" && (
        <PeoplePanel
          onMessage={async (userId) => {
            try {
              const conv = await socialAction<{ id: string }>("startConversation", { userId });
              setOpenThread(conv.id);
              setSection("messages");
            } catch {
              // The gate's own message already surfaced through the button that
              // called this; nothing useful to add here.
            }
          }}
        />
      )}

      {section === "messages" && (
        <MessagesPanel
          meId={me?.id ?? null}
          openWith={openThread}
          onOpened={() => setOpenThread(null)}
        />
      )}

      {section === "communities" && (
        <CommunitiesPanel
          meId={me?.id ?? null}
          openCommunity={params.get("community")}
          openChannel={params.get("channel")}
        />
      )}

      {section === "alerts" && (
        <NotificationsPanel
          onOpen={(link) => {
            // Deep links are in-app routes; pushing keeps the back button
            // behaving the way a notification should.
            router.push(link);
            const url = new URL(link, window.location.origin);
            const target = url.searchParams.get("tab") as Section | null;
            if (target) setSection(target);
          }}
        />
      )}

      {section === "stats" && <EngagementPanel />}

      <ShareSheet post={sharing} onClose={() => setSharing(null)} />
    </>
  );
}

function FeedSection({
  me,
  tab,
  setTab,
  permalink,
  onClearPermalink,
  onShare,
}: {
  me: SocialAuthor | null;
  tab: FeedTab;
  setTab: (tab: FeedTab) => void;
  permalink: Post | null;
  onClearPermalink: () => void;
  onShare: (post: Post) => void;
}) {
  const { posts, hasMore, isLoading, error, loadMore } = useFeed();
  const saved = useSavedPosts();
  const following = useGraph("following");
  const observe = useImpressions();
  const [loadingMore, setLoadingMore] = useState(false);

  const followingIds = useMemo(
    () => new Set(following.map((f) => f.id)),
    [following],
  );

  /**
   * Ranking runs here, over the page already fetched — which is why switching
   * tabs is instant and costs no request. The Saved tab reads from its own
   * query rather than the feed page, since a bookmark from three weeks ago
   * would otherwise have to still be in the current page to appear.
   */
  const ordered = useMemo(
    () =>
      rank(tab === "saved" ? saved : posts, tab, {
        followingIds,
        currentUserId: me?.id ?? null,
        currentUserSpecialty: me?.headline,
        now: Date.now(),
      }),
    [tab, posts, saved, followingIds, me],
  );

  return (
    <div className="space-y-4">
      <StoryRail me={me} />
      <Composer me={me} />

      {permalink && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="label">Shared post</p>
            <Button size="sm" variant="ghost" onClick={onClearPermalink}>
              Back to feed
            </Button>
          </div>
          <PostCard post={permalink} meId={me?.id ?? null} onShare={onShare} />
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FEED_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              tab === id
                ? "bg-[rgb(var(--c-espresso-700))] text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="p-4">
          <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
        </Card>
      )}

      {isLoading && posts.length === 0 && (
        <div className="grid place-items-center py-12 text-[var(--text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!isLoading && ordered.length === 0 && (
        <EmptyState
          title={
            tab === "saved"
              ? "Nothing saved yet"
              : tab === "following"
                ? "Your following feed is quiet"
                : "No posts yet"
          }
          desc={
            tab === "saved"
              ? "Bookmark a post and it will wait for you here."
              : tab === "following"
                ? "Follow a few colleagues, or switch to For you."
                : "Be the first — share a case or a question above."
          }
          icon={<Newspaper className="h-6 w-6" />}
        />
      )}

      <div className="space-y-4">
        {ordered.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            meId={me?.id ?? null}
            onShare={onShare}
            innerRef={observe(post.id)}
          />
        ))}
      </div>

      {tab !== "saved" && hasMore && (
        <div className="grid place-items-center pt-2">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              try {
                await loadMore();
              } finally {
                setLoadingMore(false);
              }
            }}
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
