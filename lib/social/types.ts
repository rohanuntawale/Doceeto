/**
 * Shapes for the social layer, shared by the server and the browser.
 *
 * Kept free of any `server-only` import on purpose: the API routes, the pure
 * ranking module and the React components all speak these, so one definition
 * has to compile in every runtime.
 *
 * The rule that shapes almost everything here: **ids never reach the browser
 * on their own.** Every read path hydrates an author, sender or participant id
 * into a `SocialAuthor` before responding, because a client that receives a
 * bare id has no choice but to fetch the user itself — once per post — and
 * that is how a feed becomes a hundred requests.
 */

import type { Cadre } from "@/lib/types/domain";

/**
 * The ONLY projection of a person that leaves the server through this module.
 *
 * Not a trimmed user record — an explicitly built one. Blanking `password_hash`
 * off a row and returning the rest is how email addresses, phone numbers and
 * Google ids end up in a feed response; there is no field here that isn't
 * already public on a profile page.
 */
export interface SocialAuthor {
  id: string;
  name: string;
  role: "patient" | "doctor" | "nurse" | "ops";
  /** Doctor or nurse, for provider accounts. Absent for patients. */
  cadre?: Cadre;
  /** One line under the name — specialty for a doctor, services for a nurse. */
  headline: string;
  avatarUrl?: string;
  /** Deterministic monogram colour, so a photo-less author still has a face. */
  avatarColor: string;
  /** Ops-verified provider. Patients see this badge; it is never self-set. */
  verified: boolean;
}

export type PostType =
  | "text"
  | "image"
  | "video"
  | "poll"
  | "milestone"
  | "document"
  | "event";

export interface PollOption {
  text: string;
  votes: number;
  /** Whole-number share of `totalVotes`, computed on read. */
  percentage: number;
}

export interface Poll {
  question: string;
  options: PollOption[];
  totalVotes: number;
  /**
   * The REQUESTER's own choice, injected per-response. There is no field for
   * everyone else's — who voted for what is a row in social_poll_votes and
   * never leaves the server in bulk.
   */
  userVoted: number | null;
}

export interface Milestone {
  title: string;
  description: string;
  icon?: string;
}

export interface PostVideo {
  /** Serve URL, /api/social/media/{id}. */
  url: string;
  duration?: string;
}

export interface PostDocument {
  title: string;
  /** Uppercased extension — "PDF", "DOCX". */
  type: string;
  url: string;
  /** Human-readable, e.g. "1.4 MB". */
  size: string;
}

export interface PostComment {
  id: string;
  author: SocialAuthor;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  author: SocialAuthor;
  content: string;
  type: PostType;
  /** Serve URLs, already resolved from media ids. */
  images: string[];
  video?: PostVideo;
  document?: PostDocument;
  poll?: Poll;
  milestone?: Milestone;
  /** Clinical specialty this was posted under, for filtering. */
  specialty?: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  /** The newest few, for the card. The rest load on demand. */
  comments: PostComment[];
  /** Per-requester state — false for anonymous readers. */
  isLiked: boolean;
  isBookmarked: boolean;
  createdAt: string;
  updatedAt?: string;
}

/** A page of posts plus the cursor for the next one. */
export interface FeedPage {
  posts: Post[];
  /** Opaque keyset cursor; null when this was the last page. */
  nextCursor: string | null;
}

export interface Story {
  id: string;
  author: SocialAuthor;
  url: string;
  mediaType: "image" | "video";
  content: string;
  createdAt: string;
}

/** One author's stories, grouped for the rail. */
export interface StoryGroup {
  author: SocialAuthor;
  stories: Story[];
  /** True when every story in the group is the requester's own. */
  isMine: boolean;
}

export interface FollowStatus {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

// ── Direct messaging ────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  /** Everyone EXCEPT the requester — the client already knows who it is. */
  others: SocialAuthor[];
  type: "direct" | "group";
  source?: string;
  lastMessage?: { content: string; senderId: string; at: string };
  unreadCount: number;
  archived: boolean;
  pinned: boolean;
  createdAt: string;
}

export interface MessageAttachment {
  mediaId: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "video" | "document" | "audio";
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  sender: SocialAuthor;
  content: string;
  type: "text" | "attachment" | "system";
  attachments: MessageAttachment[];
  createdAt: string;
}

// ── Communities ─────────────────────────────────────────────

export interface Community {
  id: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  joinPolicy: "open" | "request";
  memberCount: number;
  /** Curated communities the platform owns; nobody can rename or delete one. */
  isSystem: boolean;
  /** Requester's standing, resolved by the one shared access resolver. */
  isMember: boolean;
  isAdmin: boolean;
  isPending: boolean;
  createdAt: string;
}

export interface Channel {
  id: string;
  communityId: string;
  name: string;
  type: "text" | "voice";
  description: string;
  visibility: "public" | "private";
  /** Requester's standing on a private channel. */
  canRead: boolean;
  isPending: boolean;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  sender: SocialAuthor;
  content: string;
  type: "text" | "attachment" | "audio" | "system";
  attachments: MessageAttachment[];
  pinned: boolean;
  isBookmarked: boolean;
  inBriefcase: boolean;
  createdAt: string;
}

// ── Notifications ───────────────────────────────────────────

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "message"
  | "mention"
  | "community_invite"
  | "community_join"
  | "system";

export interface SocialNotification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
  sender?: SocialAuthor;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

// ── Engagement ──────────────────────────────────────────────

/** A metric and how it moved against the previous seven days. */
export interface EngagementMetric {
  current: number;
  previous: number;
  /** Percentage change; 100 when there is a current value and no previous. */
  trendPct: number;
}

export interface EngagementSummary {
  profileViews: EngagementMetric;
  postImpressions: EngagementMetric;
  searchAppearances: EngagementMetric;
  followerGrowth: EngagementMetric;
  /** Most recent distinct people who opened this profile. */
  recentViewers: (SocialAuthor & { viewedAt: string })[];
  uniqueViewers: number;
}
