/**
 * Feed ranking — four tabs, one pure function each.
 *
 * No imports beyond types, no clock, no fetch. `now` is a parameter, so a
 * test can prove that a three-day-old post with a hundred likes ranks below a
 * two-hour-old one with fifteen without mocking anything.
 *
 * WHERE THIS RUNS. Today it runs in the browser over the page the feed already
 * fetched, which is why switching tabs is instant and costs no request. That
 * is honest at this size and dishonest at scale: "trending" can only rank what
 * was fetched, so once the corpus outgrows a page, move the call server-side
 * into the feed read. The formulas do not change — that is the point of
 * keeping them here, taking data rather than reading it.
 */

import type { Post } from "@/lib/social/types";

export type FeedTab = "following" | "trending" | "discover" | "saved";

export interface RankContext {
  /** Accounts the reader follows. Their own id need not be in it. */
  followingIds: ReadonlySet<string>;
  currentUserId: string | null;
  /** The reader's own specialty, for the "people like me" signal. */
  currentUserSpecialty?: string;
  now: number;
}

/** Hours since a post was written; never negative, even on a skewed clock. */
function ageHours(post: Post, now: number): number {
  const t = new Date(post.createdAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now - t) / 3_600_000);
}

/**
 * One number for "how much did people do about this".
 *
 * Weighted, not summed: a like costs a tap and a comment costs a thought, and
 * a share is someone putting their own name behind it. Flat counting would let
 * a post with fifty reflex likes outrank one that started a conversation.
 */
function engagementOf(post: Post): number {
  return post.likeCount + 2 * post.commentCount + 3 * post.shareCount;
}

const hasMedia = (post: Post): boolean =>
  post.type === "image" || post.type === "video" || post.images.length > 0 || Boolean(post.video);

/** Posts are de-duplicated by id before anything else — see the note in rank(). */
function dedupe(posts: Post[]): Post[] {
  const seen = new Set<string>();
  const out: Post[] = [];
  for (const post of posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    out.push(post);
  }
  return out;
}

const newestFirst = (a: Post, b: Post) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

/**
 * TRENDING — velocity, not lifetime totals.
 *
 * The exponent is the whole design. Dividing by age alone makes a post with a
 * thousand likes stay on top for a week; raising it to 1.5 means the
 * denominator grows faster than any plausible engagement lead, so a post that
 * is climbing NOW overtakes one that finished climbing yesterday. The +2 keeps
 * a post from dividing by nearly zero in its first minutes and pinning itself
 * to the top on two likes.
 */
function trendingScore(post: Post, now: number): number {
  return (engagementOf(post) + (hasMedia(post) ? 1 : 0) + 1) / Math.pow(ageHours(post, now) + 2, 1.5);
}

/**
 * DISCOVER — relevance to this reader.
 *
 * The two negative terms are what make it a discovery tab rather than a second
 * home feed: something already liked or bookmarked has been seen, and the
 * reader's own post tells them nothing they don't know. Both are penalties
 * rather than filters, so a genuinely hot post can still surface.
 */
function discoverScore(post: Post, ctx: RankContext): number {
  const engagement = engagementOf(post);
  const followed = ctx.followingIds.has(post.author.id);
  // Same field, loosely: a paediatrician's feed should lean paediatric.
  const sameField = Boolean(
    ctx.currentUserSpecialty &&
      post.author.headline.toLowerCase().includes(ctx.currentUserSpecialty.toLowerCase()),
  );
  const seen = post.isLiked || post.isBookmarked;
  const mine = ctx.currentUserId != null && post.author.id === ctx.currentUserId;

  return (
    // log, not raw: one viral post shouldn't outweigh every relevance signal
    // combined — it dampens the blowout without ignoring it.
    1.0 * Math.log1p(engagement) +
    // ~36h half-life. Slower than trending's decay on purpose: relevance keeps
    // longer than heat.
    2.0 * Math.exp(-ageHours(post, ctx.now) / 36) +
    1.2 * (followed ? 1 : 0) +
    0.6 * (sameField ? 1 : 0) +
    0.5 * (hasMedia(post) ? 1 : 0) -
    0.4 * (seen ? 1 : 0) -
    1.0 * (mine ? 1 : 0)
  );
}

/**
 * Greedy author diversification.
 *
 * Sorting by score alone lets one prolific account own the whole first screen,
 * which reads as a broken feed even when every individual post deserved its
 * place. Each pick re-scores the remainder with a penalty for how often that
 * author has already appeared, so the second post by someone has to beat the
 * best post by everyone else by a clear margin — and the tenth has to be
 * extraordinary.
 */
const DIVERSITY_PENALTY = 0.6;

function diversify(scored: { post: Post; score: number }[]): Post[] {
  const pool = [...scored];
  const picked = new Map<string, number>();
  const out: Post[] = [];

  while (pool.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const seenTimes = picked.get(pool[i].post.author.id) ?? 0;
      const value = pool[i].score - DIVERSITY_PENALTY * seenTimes;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }
    const [chosen] = pool.splice(bestIndex, 1);
    picked.set(chosen.post.author.id, (picked.get(chosen.post.author.id) ?? 0) + 1);
    out.push(chosen.post);
  }
  return out;
}

/** Anything older than this is not "trending" by any reading of the word. */
const TRENDING_MAX_AGE_HOURS = 30 * 24;

/**
 * Order `posts` for one tab.
 *
 * De-duplication comes first and is not optional: the same post arrives both
 * from the fetched page and from a live push, and a feed that renders it twice
 * looks broken in a way users report as data loss.
 */
export function rank(posts: Post[], tab: FeedTab, ctx: RankContext): Post[] {
  const unique = dedupe(posts);

  switch (tab) {
    // Chronological, deliberately. This tab's promise is "everything from the
    // people I chose, in order" — any scoring at all breaks that contract.
    case "following": {
      const mine = ctx.currentUserId;
      return unique
        .filter((p) => ctx.followingIds.has(p.author.id) || p.author.id === mine)
        .sort(newestFirst);
    }

    case "trending":
      return unique
        .filter((p) => ageHours(p, ctx.now) <= TRENDING_MAX_AGE_HOURS)
        .map((post) => ({ post, score: trendingScore(post, ctx.now) }))
        .sort((a, b) => b.score - a.score)
        .map((s) => s.post);

    case "discover":
      return diversify(unique.map((post) => ({ post, score: discoverScore(post, ctx) })));

    case "saved":
      return unique.filter((p) => p.isBookmarked).sort(newestFirst);
  }
}

/** Exported for tests and for a future server-side move. */
export const _internals = {
  ageHours,
  engagementOf,
  trendingScore,
  discoverScore,
  diversify,
};
