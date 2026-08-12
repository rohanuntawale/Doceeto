"use client";

/**
 * Client data layer for the network.
 *
 * Same shape as lib/hooks/data.ts — React Query over the surface-tagged
 * `apiFetch`, refreshed by the SSE bridge and backed by a slow poll — but with
 * its OWN query keys, all prefixed `social-`. That prefix is what keeps the
 * two apart: the bridge invalidates by key, so a consult being accepted must
 * not refetch the feed, and a new post must not refetch the doctor roster.
 *
 * The keys here are the same strings the write endpoint emits in `emitChange`.
 * If you add an action, add its key to both places or the screen will sit on
 * stale data until the poll catches it.
 */

import { useCallback, useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type {
  Channel,
  ChannelMessage,
  Community,
  ConversationSummary,
  DirectMessage,
  EngagementSummary,
  FeedPage,
  FollowCounts,
  FollowStatus,
  Post,
  PostComment,
  SocialAuthor,
  SocialNotification,
  StoryGroup,
} from "@/lib/social/types";

/**
 * Slower than the core app's 4s. The feed is a place people read, not a live
 * operational surface — a consult request going unnoticed for four seconds
 * matters, a post arriving fifteen seconds late does not. Pushes over SSE do
 * the real work; this only bounds how stale a screen can get if one is missed.
 */
const POLL_MS = 20_000;

export const SOCIAL_KEYS = {
  feed: "social-feed",
  post: "social-post",
  stories: "social-stories",
  graph: "social-graph",
  notifications: "social-notifications",
  conversations: "social-conversations",
  messages: "social-messages",
  communities: "social-communities",
  channels: "social-channels",
  channelMessages: "social-channel-messages",
  engagement: "social-engagement",
  moderation: "social-moderation",
} as const;

/** Every key the SSE bridge should recognise as ours. */
export const SOCIAL_ENTITY_KEYS: string[] = Object.values(SOCIAL_KEYS);

// ── Transport ───────────────────────────────────────────────

async function read<T>(entity: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ entity, ...params }).toString();
  const res = await apiFetch(`/api/social?${qs}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // The message the server wrote is the one worth showing — "join to see
    // who's here" is more use than "403". The extra flags ride along so a
    // caller can branch on `restricted` or `code`.
    throw Object.assign(new Error(data?.error ?? `Request failed (${res.status})`), {
      status: res.status,
      ...(data ?? {}),
    });
  }
  return data as T;
}

/** Run a write. Throws the server's own message so a toast can show it. */
export async function socialAction<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const res = await apiFetch("/api/social/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(data?.error ?? "That didn't work."), {
      status: res.status,
      ...(data ?? {}),
    });
  }
  return data as T;
}

/** Upload one attachment and get its id back. */
export async function uploadMedia(file: File): Promise<{
  id: string;
  url: string;
  kind: "image" | "video" | "document" | "audio";
  name: string;
  size: number;
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch("/api/social/media", { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "That file couldn't be uploaded.");
  return data;
}

/** Standard options — the network is a read-heavy surface, so keep it cheap. */
function feedQuery<T>(key: unknown[], fn: () => Promise<T>, enabled = true) {
  return { queryKey: key, queryFn: fn, refetchInterval: POLL_MS, enabled };
}

// ── Feed ────────────────────────────────────────────────────

/**
 * One page of the feed.
 *
 * Deliberately a single page rather than infinite scroll: the four tabs rank
 * client-side over what has been fetched (see lib/social/ranking.ts), so the
 * ranking is only honest across a set the client actually holds. `loadMore`
 * appends the next keyset page into the same cache entry, which keeps that
 * true as the reader scrolls.
 */
export function useFeed() {
  const qc = useQueryClient();
  const query = useQuery(
    feedQuery<FeedPage>([SOCIAL_KEYS.feed], () => read<FeedPage>("feed")),
  );

  const loadMore = useCallback(async () => {
    const current = qc.getQueryData<FeedPage>([SOCIAL_KEYS.feed]);
    if (!current?.nextCursor) return;
    const next = await read<FeedPage>("feed", { cursor: current.nextCursor });
    qc.setQueryData<FeedPage>([SOCIAL_KEYS.feed], {
      posts: [...current.posts, ...next.posts],
      nextCursor: next.nextCursor,
    });
  }, [qc]);

  return {
    posts: query.data?.posts ?? [],
    hasMore: Boolean(query.data?.nextCursor),
    isLoading: query.isLoading,
    error: query.error as Error | null,
    loadMore,
  };
}

export function usePost(postId: string | null) {
  const query = useQuery(
    feedQuery<Post>(
      [SOCIAL_KEYS.post, postId],
      () => read<Post>("post", { postId: postId ?? "" }),
      Boolean(postId),
    ),
  );
  return query.data ?? null;
}

export function useSavedPosts() {
  const query = useQuery(feedQuery<Post[]>([SOCIAL_KEYS.feed, "saved"], () => read("saved")));
  return query.data ?? [];
}

export function useComments(postId: string | null) {
  const query = useQuery(
    feedQuery<PostComment[]>(
      [SOCIAL_KEYS.post, postId, "comments"],
      () => read("comments", { postId: postId ?? "" }),
      Boolean(postId),
    ),
  );
  return query.data ?? [];
}

export function useStories() {
  const query = useQuery(feedQuery<StoryGroup[]>([SOCIAL_KEYS.stories], () => read("stories")));
  return query.data ?? [];
}

// ── Graph & people ──────────────────────────────────────────

export function useSuggestions() {
  const query = useQuery(
    feedQuery<(SocialAuthor & FollowStatus)[]>([SOCIAL_KEYS.graph, "suggestions"], () =>
      read("suggestions"),
    ),
  );
  return query.data ?? [];
}

export function useGraph(direction: "followers" | "following", userId?: string) {
  const query = useQuery(
    feedQuery<(SocialAuthor & FollowStatus)[]>([SOCIAL_KEYS.graph, direction, userId ?? "me"], () =>
      read(direction, userId ? { userId } : {}),
    ),
  );
  return query.data ?? [];
}

export function useFollowCounts(userId?: string) {
  const query = useQuery(
    feedQuery<FollowCounts>([SOCIAL_KEYS.graph, "counts", userId ?? "me"], () =>
      read("followCounts", userId ? { userId } : {}),
    ),
  );
  return query.data ?? { followers: 0, following: 0 };
}

/** People search. Idle until the query is worth sending. */
export function usePeopleSearch(query: string) {
  const q = query.trim();
  const result = useQuery({
    queryKey: [SOCIAL_KEYS.graph, "search", q],
    queryFn: () => read<{ people: (SocialAuthor & FollowStatus)[]; total: number }>("searchPeople", { q }),
    enabled: q.length >= 2,
    // A search result is a snapshot of a typed query, not live state — polling
    // it would re-run the search every twenty seconds for no one's benefit.
    refetchInterval: false,
  });
  return { people: result.data?.people ?? [], total: result.data?.total ?? 0, isLoading: result.isFetching };
}

export function useBlocked() {
  const query = useQuery(
    feedQuery<SocialAuthor[]>([SOCIAL_KEYS.moderation, "blocked"], () => read("blocked")),
  );
  return query.data ?? [];
}

// ── Notifications ───────────────────────────────────────────

export function useNotifications() {
  const query = useQuery(
    feedQuery<{ notifications: SocialNotification[]; unread: number }>(
      [SOCIAL_KEYS.notifications],
      () => read("notifications"),
    ),
  );
  return { notifications: query.data?.notifications ?? [], unread: query.data?.unread ?? 0 };
}

// ── Messaging ───────────────────────────────────────────────

export function useConversations() {
  const query = useQuery(
    feedQuery<ConversationSummary[]>([SOCIAL_KEYS.conversations], () => read("conversations")),
  );
  return query.data ?? [];
}

export function useMessages(conversationId: string | null) {
  const query = useQuery(
    feedQuery<{ messages: DirectMessage[]; nextCursor: string | null }>(
      [SOCIAL_KEYS.messages, conversationId],
      () => read("messages", { conversationId: conversationId ?? "" }),
      Boolean(conversationId),
    ),
  );
  return query.data?.messages ?? [];
}

export function useMessageableUsers() {
  const query = useQuery(
    feedQuery<SocialAuthor[]>([SOCIAL_KEYS.conversations, "messageable"], () =>
      read("messageable"),
    ),
  );
  return query.data ?? [];
}

// ── Communities ─────────────────────────────────────────────

export function useCommunities() {
  const query = useQuery(
    feedQuery<Community[]>([SOCIAL_KEYS.communities], () => read("communities")),
  );
  return query.data ?? [];
}

export function useChannels(communityId: string | null) {
  const query = useQuery(
    feedQuery<Channel[]>(
      [SOCIAL_KEYS.channels, communityId],
      () => read("channels", { communityId: communityId ?? "" }),
      Boolean(communityId),
    ),
  );
  return { channels: query.data ?? [], error: query.error as Error | null };
}

export function useChannelMessages(channelId: string | null) {
  const query = useQuery(
    feedQuery<ChannelMessage[]>(
      [SOCIAL_KEYS.channelMessages, channelId],
      () => read("channelMessages", { channelId: channelId ?? "" }),
      Boolean(channelId),
    ),
  );
  return { messages: query.data ?? [], error: query.error as Error | null };
}

export function useCommunityMembers(communityId: string | null) {
  const query = useQuery(
    feedQuery<{ members: SocialAuthor[]; pending: SocialAuthor[] }>(
      [SOCIAL_KEYS.communities, communityId, "members"],
      () => read("communityMembers", { communityId: communityId ?? "" }),
      Boolean(communityId),
    ),
  );
  return query.data ?? { members: [], pending: [] };
}

// ── Engagement ──────────────────────────────────────────────

export function useEngagement() {
  const query = useQuery(
    feedQuery<EngagementSummary>([SOCIAL_KEYS.engagement], () => read("engagement")),
  );
  return query.data ?? null;
}

// ── Writes ──────────────────────────────────────────────────

/**
 * One mutation for every action.
 *
 * The server already names which keys went stale and pushes that over SSE, so
 * this only has to invalidate locally for the author's own screen — the person
 * who just acted should not wait for a round trip through the event bus to see
 * their own like register.
 */
export function useSocialAction() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload?: Record<string, unknown> }) =>
      socialAction(action, payload),
    onSettled: () => invalidateSocial(qc),
  });
  return useMemo(
    () => ({
      // Generic in the RESULT so a caller can read what the action returned
      // (the new like count, whether a join went straight through) without
      // casting at every call site.
      run: <T = unknown,>(action: string, payload?: Record<string, unknown>): Promise<T> =>
        mutation.mutateAsync({ action, payload }) as Promise<T>,
      isPending: mutation.isPending,
    }),
    [mutation],
  );
}

function invalidateSocial(qc: QueryClient) {
  for (const key of SOCIAL_ENTITY_KEYS) qc.invalidateQueries({ queryKey: [key] });
}
