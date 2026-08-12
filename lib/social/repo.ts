import "server-only";
import fs from "node:fs";
import path from "node:path";
import { sql, one, tx } from "@/lib/postgres/client";
import { DomainError } from "@/lib/db/shared";
import { AVATAR_COLORS } from "@/lib/catalog";
import { NURSE_SERVICES } from "@/lib/nurse";
import {
  COMMENT_PREVIEW,
  FEED_PAGE_SIZE,
  STORY_LIMIT,
  STORY_TTL_MS,
  dayKey,
  engagementEventId,
  extensionOf,
  formatBytes,
  mediaUrl,
  type MediaKind,
} from "@/lib/social/rules";
import type {
  EngagementMetric,
  EngagementSummary,
  FeedPage,
  FollowCounts,
  FollowStatus,
  Post,
  PostComment,
  SocialAuthor,
  SocialNotification,
  Story,
  StoryGroup,
} from "@/lib/social/types";

/**
 * The social layer's data access — feed, stories, follow graph, notifications,
 * moderation and engagement. Direct messages and communities live next door in
 * lib/social/chat-repo.ts and share the helpers exported from here.
 *
 * Talks to Postgres directly rather than through the `db` selector in
 * lib/db/index.ts, and that is deliberate. The selector exists so the core
 * product runs with no database at all (the file store); this module needs
 * composite primary keys, partial indexes, `ON CONFLICT DO NOTHING` and array
 * containment to be correct rather than merely working, and re-implementing
 * all of that against a JSON file would produce a second, subtly different set
 * of rules. So: social is Postgres-only, and the API routes say so plainly
 * with a 503 when DATABASE_URL is unset.
 */

export { DomainError };

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

// ── Schema ──────────────────────────────────────────────────

/**
 * Apply the social schema once per process, before the first query.
 *
 * The core schema runs from `setup()`, which only happens on an explicit seed.
 * Waiting for someone to re-run that is how a deploy ships a feature whose
 * tables don't exist yet, so this installs itself instead: the DDL is
 * idempotent, so the cost is one no-op statement per cold start.
 *
 * The promise — not a boolean — is what is cached, so ten requests arriving
 * together on a cold start await the same migration rather than racing to run
 * it ten times.
 */
const g = globalThis as unknown as { __doceetoSocialSchema?: Promise<void> };

export function ensureSchema(): Promise<void> {
  return (g.__doceetoSocialSchema ??= (async () => {
    const ddl = fs.readFileSync(
      path.join(process.cwd(), "lib", "social", "schema.sql"),
      "utf8",
    );
    await sql(ddl);
  })().catch((err) => {
    // A failed migration must not be remembered as done — clear the cache so
    // the next request retries rather than every later query failing on a
    // missing table with a confusing error.
    g.__doceetoSocialSchema = undefined;
    throw err;
  }));
}

/** Whether the social layer can run at all. */
export const socialEnabled = (): boolean => Boolean(process.env.DATABASE_URL);

// ── Author hydration ────────────────────────────────────────

/** Stable monogram colour for an account with no photo. */
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Service id → short label. Keyed as plain strings: `skills` comes back from
 *  the database as text, and an id retired from the catalogue must fall
 *  through to itself rather than fail to compile. */
const NURSE_LABELS = new Map<string, string>(NURSE_SERVICES.map((s) => [s.id, s.short]));

interface AuthorRow {
  id: string;
  name: string;
  role: SocialAuthor["role"];
  user_avatar: string | null;
  full_name: string | null;
  specialty: string | null;
  cadre: string | null;
  skills: string[] | null;
  verified: boolean | null;
  avatar_color: string | null;
  doctor_avatar: string | null;
}

function toAuthor(row: AuthorRow): SocialAuthor {
  const cadre = row.cadre === "nurse" ? "nurse" : row.cadre === "doctor" ? "doctor" : undefined;
  // A nurse is found by what she can do, a doctor by their specialty, and a
  // patient by neither — so the one line under the name is built per cadre
  // rather than being a single column somebody has to keep filled in.
  const headline =
    cadre === "nurse"
      ? (row.skills ?? []).map((s) => NURSE_LABELS.get(s) ?? s).slice(0, 3).join(" · ") ||
        "Home care nurse"
      : row.specialty ||
        (row.role === "ops" ? "Doceeto operations" : row.role === "patient" ? "Patient" : "");

  return {
    id: row.id,
    name: row.full_name || row.name,
    role: row.role,
    cadre,
    headline,
    avatarUrl: row.doctor_avatar || row.user_avatar || undefined,
    avatarColor: row.avatar_color || colorFor(row.id),
    verified: Boolean(row.verified),
  };
}

/**
 * Hydrate a set of user ids into author projections in ONE query.
 *
 * Every read path funnels through here. Fetching the author per post is the
 * single easiest way to turn a thirty-post feed into thirty-one round trips,
 * and it happens by accident the moment someone writes the obvious loop.
 *
 * The LEFT JOIN onto `doctors` is what makes the projection right: a
 * registered provider's doctor row and their account share an id, so the
 * professional name, specialty, photo and verification badge come from the
 * same fetch as the account, and a patient simply has no doctor row.
 */
export async function hydrateAuthors(
  ids: Iterable<string>,
): Promise<Map<string, SocialAuthor>> {
  const unique = [...new Set([...ids].filter(Boolean))];
  const out = new Map<string, SocialAuthor>();
  if (!unique.length) return out;

  const rows = await sql<AuthorRow>(
    `SELECT u.id,
            u.name,
            u.role,
            u.avatar_url    AS user_avatar,
            d.full_name,
            d.specialty,
            d.cadre,
            d.skills,
            d.verified,
            d.avatar_color,
            d.avatar_url    AS doctor_avatar
       FROM users u
       LEFT JOIN doctors d ON d.id = u.id
      WHERE u.id = ANY($1)`,
    [unique],
  );
  for (const row of rows) out.set(row.id, toAuthor(row));
  return out;
}

/**
 * A placeholder for an id with no account behind it.
 *
 * Deleting an account cascades its posts away, so this should be unreachable —
 * but a feed that throws because one row lost its author is a worse outcome
 * than a feed with one greyed-out name in it.
 */
const UNKNOWN_AUTHOR = (id: string): SocialAuthor => ({
  id,
  name: "Former member",
  role: "patient",
  headline: "",
  avatarColor: colorFor(id),
  verified: false,
});

export const authorOf = (map: Map<string, SocialAuthor>, id: string): SocialAuthor =>
  map.get(id) ?? UNKNOWN_AUTHOR(id);

// ── Blocking ────────────────────────────────────────────────

/**
 * Everyone this user is in a blocked relationship with, IN EITHER DIRECTION.
 *
 * Symmetric on purpose. A block stored one way but enforced one way means the
 * person who was blocked still sees the blocker's posts, still appears in
 * their DM list, and can still be messaged — which is not what anybody means
 * by "block". Only the direction that decides who may *undo* it stays
 * one-sided, and that is read from the table directly.
 *
 * Every read path in this module and in chat-repo.ts calls this: feed,
 * stories, conversation list, DM read, DM send, channel messages, people
 * search. Missing one is how a blocked account leaks back into view.
 */
export async function blockedIds(userId: string): Promise<Set<string>> {
  const rows = await sql<{ other: string }>(
    `SELECT blocked_id AS other FROM social_blocks WHERE blocker_id = $1
     UNION
     SELECT blocker_id AS other FROM social_blocks WHERE blocked_id = $1`,
    [userId],
  );
  return new Set(rows.map((r) => r.other));
}

export async function setBlock(
  blockerId: string,
  blockedId: string,
  blocked: boolean,
): Promise<void> {
  if (blockerId === blockedId) throw new DomainError("You cannot block yourself.");
  if (!blocked) {
    // Only the blocker can lift it — the WHERE clause is the check.
    await sql(`DELETE FROM social_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [
      blockerId,
      blockedId,
    ]);
    return;
  }
  await tx(async (c) => {
    await c.query(
      `INSERT INTO social_blocks (blocker_id, blocked_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [blockerId, blockedId],
    );
    // Blocking severs the follow graph BOTH ways. Leaving the rows would mean
    // the block hides the posts while the follower counts still claim a
    // relationship, and unblocking would silently restore a connection neither
    // person re-consented to.
    await c.query(
      `DELETE FROM social_follows
        WHERE (follower_id = $1 AND following_id = $2)
           OR (follower_id = $2 AND following_id = $1)`,
      [blockerId, blockedId],
    );
  });
}

export async function listBlocked(userId: string): Promise<SocialAuthor[]> {
  const rows = await sql<{ blocked_id: string }>(
    `SELECT blocked_id FROM social_blocks WHERE blocker_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  const authors = await hydrateAuthors(rows.map((r) => r.blocked_id));
  return rows.map((r) => authorOf(authors, r.blocked_id));
}

// ── Media ───────────────────────────────────────────────────

export async function putMedia(input: {
  ownerId: string;
  mime: string;
  kind: MediaKind;
  fileName: string | null;
  bytes: Buffer;
}): Promise<{ id: string; url: string; kind: MediaKind; name: string; size: number }> {
  const id = uid("media");
  await sql(
    `INSERT INTO social_media (id, owner_id, mime, kind, file_name, byte_size, bytes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, input.ownerId, input.mime, input.kind, input.fileName, input.bytes.length, input.bytes],
  );
  return {
    id,
    url: mediaUrl(id),
    kind: input.kind,
    name: input.fileName ?? "",
    size: input.bytes.length,
  };
}

export async function getMedia(
  id: string,
): Promise<{ mime: string; bytes: Buffer; fileName: string | null; kind: string } | null> {
  return one<{ mime: string; bytes: Buffer; fileName: string | null; kind: string }>(
    `SELECT mime, bytes, file_name AS "fileName", kind FROM social_media WHERE id = $1`,
    [id],
  );
}

/** Media ids the caller actually owns — an attachment can't be someone else's. */
async function ownedMedia(ownerId: string, ids: string[]): Promise<Map<string, MediaRow>> {
  const out = new Map<string, MediaRow>();
  if (!ids.length) return out;
  const rows = await sql<MediaRow>(
    `SELECT id, mime, kind, file_name, byte_size
       FROM social_media WHERE id = ANY($1) AND owner_id = $2`,
    [ids, ownerId],
  );
  for (const row of rows) out.set(row.id, row);
  return out;
}

interface MediaRow {
  id: string;
  mime: string;
  kind: MediaKind;
  file_name: string | null;
  byte_size: number;
}

// ── Posts ───────────────────────────────────────────────────

interface PostRow {
  id: string;
  author_id: string;
  content: string;
  type: Post["type"];
  image_ids: string[];
  video: { mediaId: string; duration?: string } | null;
  document: { mediaId: string; title: string; type: string; size: string } | null;
  poll: { question: string; options: string[] } | null;
  milestone: Post["milestone"] | null;
  specialty: string | null;
  tags: string[];
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: Date;
  updated_at: Date | null;
}

const iso = (d: Date | string | null | undefined): string =>
  d ? new Date(d).toISOString() : "";

/**
 * Turn post rows into the shape the client renders, attaching everything that
 * is specific to THIS reader in three batched queries rather than per post:
 * which ones they liked, which they bookmarked, how they voted, and the newest
 * comments. An anonymous reader skips all four.
 */
async function decoratePosts(rows: PostRow[], viewerId: string | null): Promise<Post[]> {
  if (!rows.length) return [];
  const postIds = rows.map((r) => r.id);

  const [comments, liked, saved, votes, tallies] = await Promise.all([
    // The newest few per post, in one query. LATERAL rather than a window
    // function so the planner can stop after COMMENT_PREVIEW rows per post
    // instead of ranking every comment the post ever received.
    sql<{ id: string; post_id: string; author_id: string; body: string; created_at: Date }>(
      `SELECT c.* FROM social_posts p
         JOIN LATERAL (
           SELECT id, post_id, author_id, body, created_at
             FROM social_post_comments
            WHERE post_id = p.id
            ORDER BY created_at DESC
            LIMIT ${COMMENT_PREVIEW}
         ) c ON TRUE
        WHERE p.id = ANY($1)`,
      [postIds],
    ),
    viewerId
      ? sql<{ post_id: string }>(
          `SELECT post_id FROM social_post_likes WHERE user_id = $1 AND post_id = ANY($2)`,
          [viewerId, postIds],
        )
      : Promise.resolve([]),
    viewerId
      ? sql<{ item_id: string }>(
          `SELECT item_id FROM social_saved_items
            WHERE user_id = $1 AND item_type = 'post' AND item_id = ANY($2)`,
          [viewerId, postIds],
        )
      : Promise.resolve([]),
    viewerId
      ? sql<{ post_id: string; option_index: number }>(
          `SELECT post_id, option_index FROM social_poll_votes
            WHERE user_id = $1 AND post_id = ANY($2)`,
          [viewerId, postIds],
        )
      : Promise.resolve([]),
    // Poll tallies are COUNTED, never stored on the post — so a vote cannot be
    // pre-loaded by a crafted payload and the numbers cannot drift.
    sql<{ post_id: string; option_index: number; votes: string }>(
      `SELECT post_id, option_index, count(*) AS votes
         FROM social_poll_votes WHERE post_id = ANY($1)
        GROUP BY post_id, option_index`,
      [postIds],
    ),
  ]);

  const authorIds = new Set<string>();
  for (const r of rows) authorIds.add(r.author_id);
  for (const c of comments) authorIds.add(c.author_id);
  const authors = await hydrateAuthors(authorIds);

  const commentsByPost = new Map<string, PostComment[]>();
  for (const c of comments) {
    const list = commentsByPost.get(c.post_id) ?? [];
    list.push({
      id: c.id,
      author: authorOf(authors, c.author_id),
      text: c.body,
      createdAt: iso(c.created_at),
    });
    commentsByPost.set(c.post_id, list);
  }

  const likedSet = new Set(liked.map((r) => r.post_id));
  const savedSet = new Set(saved.map((r) => r.item_id));
  const myVote = new Map(votes.map((v) => [v.post_id, v.option_index]));
  const tallyByPost = new Map<string, Map<number, number>>();
  for (const t of tallies) {
    const m = tallyByPost.get(t.post_id) ?? new Map<number, number>();
    m.set(t.option_index, Number(t.votes));
    tallyByPost.set(t.post_id, m);
  }

  return rows.map((row) => {
    const post: Post = {
      id: row.id,
      author: authorOf(authors, row.author_id),
      content: row.content,
      type: row.type,
      images: (row.image_ids ?? []).map(mediaUrl),
      tags: row.tags ?? [],
      likeCount: row.like_count,
      commentCount: row.comment_count,
      shareCount: row.share_count,
      // Oldest-first inside the card, though they were fetched newest-first.
      comments: (commentsByPost.get(row.id) ?? []).slice().reverse(),
      isLiked: likedSet.has(row.id),
      isBookmarked: savedSet.has(row.id),
      createdAt: iso(row.created_at),
      updatedAt: row.updated_at ? iso(row.updated_at) : undefined,
      specialty: row.specialty ?? undefined,
    };
    if (row.video) post.video = { url: mediaUrl(row.video.mediaId), duration: row.video.duration };
    if (row.document) {
      post.document = {
        title: row.document.title,
        type: row.document.type,
        size: row.document.size,
        url: mediaUrl(row.document.mediaId),
      };
    }
    if (row.milestone) post.milestone = row.milestone;
    if (row.poll) {
      const tally = tallyByPost.get(row.id) ?? new Map<number, number>();
      const total = [...tally.values()].reduce((a, b) => a + b, 0);
      post.poll = {
        question: row.poll.question,
        totalVotes: total,
        options: row.poll.options.map((text, i) => {
          const votes = tally.get(i) ?? 0;
          return {
            text,
            votes,
            percentage: total ? Math.round((votes / total) * 100) : 0,
          };
        }),
        // The reader's OWN choice, and nobody else's — the voters map never
        // leaves the server.
        userVoted: myVote.has(row.id) ? (myVote.get(row.id) as number) : null,
      };
    }
    return post;
  });
}

/**
 * The post columns, as a list rather than a string.
 *
 * A list because two queries need them PREFIXED with the table alias, and
 * deriving that by splitting a formatted SQL string on ", " silently mangles
 * any column that happened to sit at the end of a line.
 */
const POST_FIELDS = [
  "id",
  "author_id",
  "content",
  "type",
  "image_ids",
  "video",
  "document",
  "poll",
  "milestone",
  "specialty",
  "tags",
  "like_count",
  "comment_count",
  "share_count",
  "created_at",
  "updated_at",
] as const;

const POST_COLUMNS = POST_FIELDS.join(", ");
const postColumnsOn = (alias: string) => POST_FIELDS.map((c) => `${alias}.${c}`).join(", ");

/**
 * A page of the feed.
 *
 * KEYSET PAGINATION, not OFFSET, and ORDER BY from the first line rather than
 * bolted on later. `LIMIT 100` with no ORDER BY — which is what this was
 * ported from — returns an arbitrary hundred rows that happen to be cheap to
 * reach, sorted in memory afterwards; it looks fine until the table outgrows a
 * page and posts start disappearing from the middle of the feed. Seeking on
 * (created_at, id) also survives new posts arriving mid-scroll, which OFFSET
 * does not: an OFFSET page shifts under the reader and repeats a row.
 */
export async function listFeed(opts: {
  viewerId: string | null;
  cursor?: string | null;
  limit?: number;
  authorId?: string | null;
}): Promise<FeedPage> {
  const limit = Math.min(FEED_PAGE_SIZE, Math.max(1, opts.limit ?? FEED_PAGE_SIZE));
  const hidden = opts.viewerId ? [...(await blockedIds(opts.viewerId))] : [];

  // "<created_at>|<id>" from the last row of the previous page.
  const [cursorAt, cursorId] = (opts.cursor ?? "").split("|");
  const hasCursor = Boolean(cursorAt && cursorId);

  const rows = await sql<PostRow>(
    `SELECT ${POST_COLUMNS}
       FROM social_posts
      WHERE ($1::text[] IS NULL OR NOT (author_id = ANY($1)))
        AND ($2::text IS NULL OR author_id = $2)
        AND ($3::boolean IS FALSE OR (created_at, id) < ($4::timestamptz, $5::text))
      ORDER BY created_at DESC, id DESC
      LIMIT $6`,
    [
      hidden.length ? hidden : null,
      opts.authorId ?? null,
      hasCursor,
      hasCursor ? cursorAt : null,
      hasCursor ? cursorId : null,
      limit + 1, // one extra row is how we know whether there IS a next page
    ],
  );

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    posts: await decoratePosts(page, opts.viewerId),
    nextCursor: rows.length > limit && last ? `${iso(last.created_at)}|${last.id}` : null,
  };
}

/** One post, for a permalink or a notification's deep link. */
export async function getPost(id: string, viewerId: string | null): Promise<Post | null> {
  const row = await one<PostRow>(`SELECT ${POST_COLUMNS} FROM social_posts WHERE id = $1`, [id]);
  if (!row) return null;
  if (viewerId) {
    const hidden = await blockedIds(viewerId);
    if (hidden.has(row.author_id)) return null;
  }
  const [post] = await decoratePosts([row], viewerId);
  return post ?? null;
}

/** The reader's bookmarks, newest-saved first. */
export async function listSaved(viewerId: string): Promise<Post[]> {
  const rows = await sql<PostRow>(
    `SELECT ${postColumnsOn("p")}
       FROM social_saved_items s
       JOIN social_posts p ON p.id = s.item_id
      WHERE s.user_id = $1 AND s.item_type = 'post'
      ORDER BY s.created_at DESC
      LIMIT 100`,
    [viewerId],
  );
  return decoratePosts(rows, viewerId);
}

export async function createPost(input: {
  authorId: string;
  content: string;
  imageIds: string[];
  videoId: string | null;
  documentId: string | null;
  poll: { question: string; options: string[] } | null;
  milestone: { title: string; description: string; icon?: string } | null;
  specialty: string | null;
  tags: string[];
}): Promise<Post> {
  // Attachments are resolved against what this author actually uploaded, so a
  // post can never reference somebody else's media by guessing an id.
  const media = await ownedMedia(input.authorId, [
    ...input.imageIds,
    ...(input.videoId ? [input.videoId] : []),
    ...(input.documentId ? [input.documentId] : []),
  ]);

  const images = input.imageIds.filter((id) => media.get(id)?.kind === "image");
  const videoRow = input.videoId ? media.get(input.videoId) : undefined;
  const docRow = input.documentId ? media.get(input.documentId) : undefined;
  const video = videoRow?.kind === "video" ? { mediaId: videoRow.id } : null;
  const document =
    docRow?.kind === "document"
      ? {
          mediaId: docRow.id,
          title: docRow.file_name || "Document",
          type: extensionOf(docRow.file_name || ""),
          size: formatBytes(docRow.byte_size),
        }
      : null;

  const type = images.length
    ? "image"
    : video
      ? "video"
      : input.poll
        ? "poll"
        : input.milestone
          ? "milestone"
          : document
            ? "document"
            : "text";

  if (!input.content && !images.length && !video && !document && !input.poll && !input.milestone) {
    throw new DomainError("There is nothing to post yet.");
  }

  const id = uid("post");
  await sql(
    `INSERT INTO social_posts
       (id, author_id, content, type, image_ids, video, document, poll, milestone, specialty, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      input.authorId,
      input.content,
      type,
      images,
      video ? JSON.stringify(video) : null,
      document ? JSON.stringify(document) : null,
      input.poll ? JSON.stringify(input.poll) : null,
      input.milestone ? JSON.stringify(input.milestone) : null,
      input.specialty,
      input.tags,
    ],
  );
  const post = await getPost(id, input.authorId);
  if (!post) throw new DomainError("The post could not be saved.", 500);
  return post;
}

export async function deletePost(postId: string, actorId: string): Promise<void> {
  const row = await one<{ author_id: string }>(
    `SELECT author_id FROM social_posts WHERE id = $1`,
    [postId],
  );
  if (!row) throw new DomainError("That post no longer exists.", 404);
  if (row.author_id !== actorId) throw new DomainError("That isn't your post.", 403);
  await sql(`DELETE FROM social_posts WHERE id = $1`, [postId]);
}

/**
 * Toggle a like and return the new state.
 *
 * The counter moves inside the same transaction as the child row, and — this
 * is the part that matters — it is moved by `like_count = like_count + 1`,
 * computed by the database from the value it holds at commit time. Reading the
 * count into the application and writing back count+1 is the classic lost
 * update: two doctors liking within the same millisecond, one like vanishes.
 *
 * `ON CONFLICT DO NOTHING` plus `rowCount` is what makes the toggle honest —
 * a double-tap that inserts nothing must not bump the counter either.
 */
export async function toggleLike(
  postId: string,
  userId: string,
): Promise<{ liked: boolean; likeCount: number; authorId: string }> {
  return tx(async (c) => {
    const post = await c.query<{ author_id: string }>(
      `SELECT author_id FROM social_posts WHERE id = $1`,
      [postId],
    );
    if (!post.rows.length) throw new DomainError("That post no longer exists.", 404);

    const inserted = await c.query(
      `INSERT INTO social_post_likes (post_id, user_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [postId, userId],
    );
    const liked = (inserted.rowCount ?? 0) > 0;
    if (!liked) {
      await c.query(`DELETE FROM social_post_likes WHERE post_id = $1 AND user_id = $2`, [
        postId,
        userId,
      ]);
    }
    const updated = await c.query<{ like_count: number }>(
      `UPDATE social_posts SET like_count = GREATEST(0, like_count + $2) WHERE id = $1
       RETURNING like_count`,
      [postId, liked ? 1 : -1],
    );
    return {
      liked,
      likeCount: updated.rows[0]?.like_count ?? 0,
      authorId: post.rows[0].author_id,
    };
  });
}

export async function addComment(
  postId: string,
  authorId: string,
  body: string,
): Promise<{ comment: PostComment; postAuthorId: string; commentCount: number }> {
  const id = uid("cmt");
  const result = await tx(async (c) => {
    const post = await c.query<{ author_id: string }>(
      `SELECT author_id FROM social_posts WHERE id = $1`,
      [postId],
    );
    if (!post.rows.length) throw new DomainError("That post no longer exists.", 404);
    const row = await c.query<{ created_at: Date }>(
      `INSERT INTO social_post_comments (id, post_id, author_id, body)
       VALUES ($1,$2,$3,$4) RETURNING created_at`,
      [id, postId, authorId, body],
    );
    const updated = await c.query<{ comment_count: number }>(
      `UPDATE social_posts SET comment_count = comment_count + 1 WHERE id = $1
       RETURNING comment_count`,
      [postId],
    );
    return {
      createdAt: iso(row.rows[0].created_at),
      postAuthorId: post.rows[0].author_id,
      commentCount: updated.rows[0]?.comment_count ?? 0,
    };
  });

  const authors = await hydrateAuthors([authorId]);
  return {
    comment: {
      id,
      author: authorOf(authors, authorId),
      text: body,
      createdAt: result.createdAt,
    },
    postAuthorId: result.postAuthorId,
    commentCount: result.commentCount,
  };
}

export async function listComments(postId: string, viewerId: string): Promise<PostComment[]> {
  const hidden = await blockedIds(viewerId);
  const rows = await sql<{ id: string; author_id: string; body: string; created_at: Date }>(
    `SELECT id, author_id, body, created_at FROM social_post_comments
      WHERE post_id = $1 ORDER BY created_at ASC LIMIT 200`,
    [postId],
  );
  const visible = rows.filter((r) => !hidden.has(r.author_id));
  const authors = await hydrateAuthors(visible.map((r) => r.author_id));
  return visible.map((r) => ({
    id: r.id,
    author: authorOf(authors, r.author_id),
    text: r.body,
    createdAt: iso(r.created_at),
  }));
}

export async function sharePost(postId: string): Promise<number> {
  const row = await one<{ share_count: number }>(
    `UPDATE social_posts SET share_count = share_count + 1 WHERE id = $1 RETURNING share_count`,
    [postId],
  );
  if (!row) throw new DomainError("That post no longer exists.", 404);
  return row.share_count;
}

export async function toggleSave(postId: string, userId: string): Promise<boolean> {
  const inserted = await sql(
    `INSERT INTO social_saved_items (user_id, item_id, item_type) VALUES ($1,$2,'post')
     ON CONFLICT DO NOTHING RETURNING item_id`,
    [userId, postId],
  );
  if (inserted.length) return true;
  await sql(
    `DELETE FROM social_saved_items WHERE user_id = $1 AND item_id = $2 AND item_type = 'post'`,
    [userId, postId],
  );
  return false;
}

/**
 * Cast a poll vote.
 *
 * "One vote per person" is the primary key of social_poll_votes, so the second
 * attempt fails in the database rather than depending on a read that another
 * request could have interleaved with. Checking `voters[userId]` first — which
 * is what the shape this was ported from required — lets two simultaneous
 * requests both read "no vote yet" and both write one.
 */
export async function votePoll(
  postId: string,
  userId: string,
  optionIndex: number,
): Promise<Post> {
  const row = await one<{ poll: { options: string[] } | null }>(
    `SELECT poll FROM social_posts WHERE id = $1`,
    [postId],
  );
  if (!row?.poll) throw new DomainError("That post has no poll.", 404);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= row.poll.options.length) {
    throw new DomainError("That isn't one of the options.");
  }
  const inserted = await sql(
    `INSERT INTO social_poll_votes (post_id, user_id, option_index) VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING RETURNING post_id`,
    [postId, userId, optionIndex],
  );
  if (!inserted.length) throw new DomainError("You have already voted on this poll.");

  const post = await getPost(postId, userId);
  if (!post) throw new DomainError("That post no longer exists.", 404);
  return post;
}

// ── Stories ─────────────────────────────────────────────────

export async function createStory(input: {
  authorId: string;
  mediaId: string;
  content: string;
}): Promise<void> {
  const media = await ownedMedia(input.authorId, [input.mediaId]);
  const row = media.get(input.mediaId);
  if (!row || (row.kind !== "image" && row.kind !== "video")) {
    throw new DomainError("A story needs a photo or a video.");
  }
  await sql(
    `INSERT INTO social_stories (id, author_id, media_id, media_type, content)
     VALUES ($1,$2,$3,$4,$5)`,
    [uid("story"), input.authorId, input.mediaId, row.kind, input.content],
  );
}

/**
 * The story rail: the last 24 hours, from people the reader follows, grouped
 * by author with their own group first.
 *
 * THE DEGENERATE CASE MATTERS MOST. A doctor who signed up an hour ago follows
 * nobody, so a strict follow filter hands them an empty rail on the screen
 * that is supposed to show them the place is alive — and an empty rail is a
 * strong signal to close the tab. When the reader follows nobody, they see
 * everybody.
 *
 * Expiry is a WHERE clause, not a sweeper job: nothing here depends on cron
 * having run, so a missed job costs disk, not correctness.
 */
export async function listStories(viewerId: string): Promise<StoryGroup[]> {
  const [follows, hidden] = await Promise.all([
    sql<{ following_id: string }>(
      `SELECT following_id FROM social_follows WHERE follower_id = $1`,
      [viewerId],
    ),
    blockedIds(viewerId),
  ]);
  const following = follows.map((f) => f.following_id);
  const scoped = following.length ? [...following, viewerId] : null;

  const rows = await sql<{
    id: string;
    author_id: string;
    media_id: string;
    media_type: "image" | "video";
    content: string;
    created_at: Date;
  }>(
    `SELECT id, author_id, media_id, media_type, content, created_at
       FROM social_stories
      WHERE created_at > now() - ($1::bigint * interval '1 millisecond')
        AND ($2::text[] IS NULL OR author_id = ANY($2))
        AND ($3::text[] IS NULL OR NOT (author_id = ANY($3)))
      ORDER BY created_at DESC
      LIMIT ${STORY_LIMIT}`,
    [STORY_TTL_MS, scoped, hidden.size ? [...hidden] : null],
  );

  const authors = await hydrateAuthors(rows.map((r) => r.author_id));
  const groups = new Map<string, StoryGroup>();
  for (const row of rows) {
    const story: Story = {
      id: row.id,
      author: authorOf(authors, row.author_id),
      url: mediaUrl(row.media_id),
      mediaType: row.media_type,
      content: row.content,
      createdAt: iso(row.created_at),
    };
    const group = groups.get(row.author_id) ?? {
      author: story.author,
      stories: [],
      isMine: row.author_id === viewerId,
    };
    group.stories.push(story);
    groups.set(row.author_id, group);
  }
  // Own group first — it is the one with an action attached to it ("add").
  return [...groups.values()].sort((a, b) => Number(b.isMine) - Number(a.isMine));
}

// ── Follow graph ────────────────────────────────────────────

export async function setFollow(
  followerId: string,
  followingId: string,
  follow: boolean,
): Promise<void> {
  if (followerId === followingId) throw new DomainError("You cannot follow yourself.");
  if (!follow) {
    await sql(`DELETE FROM social_follows WHERE follower_id = $1 AND following_id = $2`, [
      followerId,
      followingId,
    ]);
    return;
  }
  const target = await one<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [followingId]);
  if (!target) throw new DomainError("That account no longer exists.", 404);
  const blocked = await blockedIds(followerId);
  if (blocked.has(followingId)) throw new DomainError("You cannot follow that account.", 403);
  await sql(
    `INSERT INTO social_follows (follower_id, following_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [followerId, followingId],
  );
}

/** Both directions in one round trip — the DM gate asks for this constantly. */
export async function followStatus(a: string, b: string): Promise<FollowStatus> {
  const rows = await sql<{ follower_id: string }>(
    `SELECT follower_id FROM social_follows
      WHERE (follower_id = $1 AND following_id = $2)
         OR (follower_id = $2 AND following_id = $1)`,
    [a, b],
  );
  const isFollowing = rows.some((r) => r.follower_id === a);
  const isFollowedBy = rows.some((r) => r.follower_id === b);
  return { isFollowing, isFollowedBy, isMutual: isFollowing && isFollowedBy };
}

export const areMutual = async (a: string, b: string): Promise<boolean> =>
  (await followStatus(a, b)).isMutual;

export async function followCounts(userId: string): Promise<FollowCounts> {
  const row = await one<{ followers: string; following: string }>(
    `SELECT (SELECT count(*) FROM social_follows WHERE following_id = $1) AS followers,
            (SELECT count(*) FROM social_follows WHERE follower_id  = $1) AS following`,
    [userId],
  );
  return { followers: Number(row?.followers ?? 0), following: Number(row?.following ?? 0) };
}

export async function followingIdsOf(userId: string): Promise<string[]> {
  const rows = await sql<{ following_id: string }>(
    `SELECT following_id FROM social_follows WHERE follower_id = $1`,
    [userId],
  );
  return rows.map((r) => r.following_id);
}

/** One side of the graph, hydrated, with the reader's own status on each. */
export async function listGraph(
  userId: string,
  direction: "followers" | "following",
  viewerId: string,
): Promise<(SocialAuthor & FollowStatus)[]> {
  const rows = await sql<{ other: string }>(
    direction === "followers"
      ? `SELECT follower_id AS other FROM social_follows WHERE following_id = $1 ORDER BY created_at DESC LIMIT 200`
      : `SELECT following_id AS other FROM social_follows WHERE follower_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [userId],
  );
  const hidden = await blockedIds(viewerId);
  const ids = rows.map((r) => r.other).filter((id) => !hidden.has(id));
  return withFollowStatus(ids, viewerId);
}

/**
 * Attach the reader's relationship to a list of people in one query, so a
 * roster of fifty can render fifty correct Follow buttons without fifty
 * requests.
 */
export async function withFollowStatus(
  ids: string[],
  viewerId: string,
): Promise<(SocialAuthor & FollowStatus)[]> {
  if (!ids.length) return [];
  const [authors, edges] = await Promise.all([
    hydrateAuthors(ids),
    sql<{ follower_id: string; following_id: string }>(
      `SELECT follower_id, following_id FROM social_follows
        WHERE (follower_id = $1 AND following_id = ANY($2))
           OR (following_id = $1 AND follower_id = ANY($2))`,
      [viewerId, ids],
    ),
  ]);
  const iFollow = new Set(edges.filter((e) => e.follower_id === viewerId).map((e) => e.following_id));
  const followsMe = new Set(
    edges.filter((e) => e.following_id === viewerId).map((e) => e.follower_id),
  );
  return ids.map((id) => {
    const isFollowing = iFollow.has(id);
    const isFollowedBy = followsMe.has(id);
    return {
      ...authorOf(authors, id),
      isFollowing,
      isFollowedBy,
      isMutual: isFollowing && isFollowedBy,
    };
  });
}

/**
 * People to follow.
 *
 * Colleagues first — same specialty, since that is who a doctor actually wants
 * in their feed — then anyone else with an account, newest first so the people
 * who just joined are not invisible. Blocked accounts and people already
 * followed are excluded in SQL rather than filtered afterwards, so the limit
 * returns a full page instead of whatever survives.
 */
export async function suggestPeople(
  viewerId: string,
  limit = 12,
): Promise<(SocialAuthor & FollowStatus)[]> {
  const hidden = [...(await blockedIds(viewerId))];
  const rows = await sql<{ id: string }>(
    `WITH me AS (SELECT specialty, cadre FROM doctors WHERE id = $1)
     SELECT u.id
       FROM users u
       JOIN doctors d ON d.id = u.id
      WHERE u.id <> $1
        AND u.role IN ('doctor','nurse')
        AND NOT (u.id = ANY($2))
        AND NOT EXISTS (
          SELECT 1 FROM social_follows f
           WHERE f.follower_id = $1 AND f.following_id = u.id
        )
      ORDER BY (d.specialty = (SELECT specialty FROM me)) DESC,
               d.verified DESC,
               u.created_at DESC
      LIMIT $3`,
    [viewerId, hidden, limit],
  );
  return withFollowStatus(rows.map((r) => r.id), viewerId);
}

/**
 * People search.
 *
 * Returns a `total` alongside the page. A bare `LIMIT 20` with no count reads
 * to the user as "those are all the results", which is a lie the interface has
 * no way to detect — so the caller gets the number and can say "20 of 63".
 */
export async function searchPeople(
  viewerId: string,
  query: string,
  limit = 20,
): Promise<{ people: (SocialAuthor & FollowStatus)[]; total: number }> {
  const hidden = [...(await blockedIds(viewerId))];
  const like = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const rows = await sql<{ id: string; total: string }>(
    `SELECT u.id, count(*) OVER () AS total
       FROM users u
       LEFT JOIN doctors d ON d.id = u.id
      WHERE u.id <> $1
        AND NOT (u.id = ANY($2))
        AND u.role <> 'ops'
        AND (u.name ILIKE $3 OR d.full_name ILIKE $3 OR d.specialty ILIKE $3)
      ORDER BY d.verified DESC NULLS LAST, u.name ASC
      LIMIT $4`,
    [viewerId, hidden, like, limit],
  );
  return {
    people: await withFollowStatus(rows.map((r) => r.id), viewerId),
    total: Number(rows[0]?.total ?? 0),
  };
}

// ── Notifications ───────────────────────────────────────────

/**
 * Create a notification and never, ever throw.
 *
 * A notification is a side effect of an action, not part of it. If this fails,
 * the like still happened, the comment still exists and the invite is still
 * pending — so a failure here is logged and swallowed. Letting it propagate
 * would mean a full notifications table could stop people liking posts.
 *
 * Self-notification is dropped at the door rather than at each call site: it
 * is the same mistake in every feature, and one guard is more reliable than
 * eight.
 */
export async function notify(input: {
  userId: string;
  type: SocialNotification["type"];
  title: string;
  content?: string;
  link?: string;
  senderId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (input.senderId && input.senderId === input.userId) return;
    await sql(
      `INSERT INTO social_notifications (id, user_id, type, title, content, link, sender_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        uid("ntf"),
        input.userId,
        input.type,
        input.title,
        input.content ?? "",
        input.link ?? null,
        input.senderId ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
  } catch (err) {
    console.error("social notification failed (ignored):", (err as Error)?.message);
  }
}

export async function listNotifications(
  userId: string,
  limit = 50,
): Promise<{ notifications: SocialNotification[]; unread: number }> {
  const rows = await sql<{
    id: string;
    type: SocialNotification["type"];
    title: string;
    content: string;
    link: string | null;
    sender_id: string | null;
    metadata: Record<string, unknown> | null;
    read: boolean;
    created_at: Date;
  }>(
    `SELECT id, type, title, content, link, sender_id, metadata, read, created_at
       FROM social_notifications WHERE user_id = $1
      ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  const unreadRow = await one<{ count: string }>(
    `SELECT count(*) FROM social_notifications WHERE user_id = $1 AND NOT read`,
    [userId],
  );
  const authors = await hydrateAuthors(rows.map((r) => r.sender_id).filter(Boolean) as string[]);
  return {
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      content: r.content,
      link: r.link ?? undefined,
      sender: r.sender_id ? authorOf(authors, r.sender_id) : undefined,
      metadata: r.metadata ?? undefined,
      read: r.read,
      createdAt: iso(r.created_at),
    })),
    unread: Number(unreadRow?.count ?? 0),
  };
}

/**
 * Mark one or all as read.
 *
 * `WHERE user_id = $1` is the ownership check — a crafted id belonging to
 * somebody else simply matches nothing. And "all" is ONE statement: looping an
 * UPDATE per row, which is what this replaces, means a hundred round trips to
 * clear a hundred notifications, and a half-cleared list if any of them fails.
 */
export async function markNotificationsRead(userId: string, id?: string): Promise<void> {
  if (id) {
    await sql(`UPDATE social_notifications SET read = TRUE WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ]);
    return;
  }
  await sql(`UPDATE social_notifications SET read = TRUE WHERE user_id = $1 AND NOT read`, [userId]);
}

// ── Moderation ──────────────────────────────────────────────

export async function createReport(input: {
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
}): Promise<void> {
  if (input.targetId === input.reporterId) {
    throw new DomainError("You cannot report yourself.");
  }
  await sql(
    `INSERT INTO social_reports (id, reporter_id, target_type, target_id, reason, details)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING`,
    [uid("rpt"), input.reporterId, input.targetType, input.targetId, input.reason, input.details],
  );
}

/** What this person has already reported, so the UI can say so. */
export async function myReports(
  reporterId: string,
): Promise<{ targetType: string; targetId: string }[]> {
  return sql<{ targetType: string; targetId: string }>(
    `SELECT target_type AS "targetType", target_id AS "targetId"
       FROM social_reports WHERE reporter_id = $1`,
    [reporterId],
  );
}

// ── Engagement analytics ────────────────────────────────────

/**
 * Record engagement events. Fire-and-forget, and it NEVER throws.
 *
 * These are counters on a dashboard. If the table is missing, locked or full,
 * the profile page it was recorded from must still render — analytics failing
 * closed would take down the pages it measures, which is a spectacularly bad
 * trade. Everything here is best-effort by design.
 *
 * Self-events are dropped: viewing your own profile is not a profile view, and
 * scrolling past your own post is not an impression.
 */
export async function recordEvents(
  type: "profile_view" | "post_impression" | "search_appearance",
  actorId: string,
  targets: { ownerId: string; postId?: string | null }[],
): Promise<void> {
  try {
    const day = dayKey();
    const rows = targets
      .filter((t) => t.ownerId && t.ownerId !== actorId)
      .slice(0, 200) // batches are capped; a client can't ask us to write forever
      .map((t) => ({
        id: engagementEventId(type, t.ownerId, actorId, t.postId ?? null, day),
        ownerId: t.ownerId,
        postId: t.postId ?? null,
      }));
    if (!rows.length) return;

    // One multi-row insert. The deterministic id makes DO NOTHING the whole
    // de-duplication story — no read, no race, no double count.
    await sql(
      `INSERT INTO social_engagement_events (id, type, owner_id, actor_id, post_id, day)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::date[])
       ON CONFLICT (id) DO NOTHING`,
      [
        rows.map((r) => r.id),
        rows.map(() => type),
        rows.map((r) => r.ownerId),
        rows.map(() => actorId),
        rows.map((r) => r.postId),
        rows.map(() => day),
      ],
    );
  } catch (err) {
    console.error("engagement record failed (ignored):", (err as Error)?.message);
  }
}

/** Posts belong to their authors — an impression credits the owner, not the reader. */
export async function ownersOfPosts(postIds: string[]): Promise<{ ownerId: string; postId: string }[]> {
  if (!postIds.length) return [];
  return sql<{ ownerId: string; postId: string }>(
    `SELECT author_id AS "ownerId", id AS "postId" FROM social_posts WHERE id = ANY($1)`,
    [postIds.slice(0, 200)],
  );
}

const metric = (current: number, previous: number): EngagementMetric => ({
  current,
  previous,
  // No previous activity and some now is growth, not a division by zero. A
  // flat 100% is the honest answer: the real figure is unbounded.
  trendPct: previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100),
});

const ZERO: EngagementMetric = { current: 0, previous: 0, trendPct: 0 };

/**
 * The dashboard: last 7 days against the 7 before it.
 *
 * Pulls 30 days once and splits the windows in memory rather than issuing six
 * COUNT queries — the row count per user is small and one round trip beats six.
 *
 * If any of it fails, a ZEROED payload comes back instead of a 500. A metrics
 * card that reads "0" is a minor disappointment; a metrics card that takes the
 * whole page down with it is an outage.
 */
export async function engagementSummary(userId: string): Promise<EngagementSummary> {
  const empty: EngagementSummary = {
    profileViews: ZERO,
    postImpressions: ZERO,
    searchAppearances: ZERO,
    followerGrowth: ZERO,
    recentViewers: [],
    uniqueViewers: 0,
  };

  try {
    const [events, follows, viewers] = await Promise.all([
      sql<{ type: string; created_at: Date }>(
        `SELECT type, created_at FROM social_engagement_events
          WHERE owner_id = $1 AND created_at > now() - interval '30 days'`,
        [userId],
      ),
      sql<{ created_at: Date }>(
        `SELECT created_at FROM social_follows
          WHERE following_id = $1 AND created_at > now() - interval '30 days'`,
        [userId],
      ),
      // Latest view per distinct actor — DISTINCT ON is Postgres's answer to
      // "the newest row per group" without a self-join.
      sql<{ actor_id: string; created_at: Date }>(
        `SELECT DISTINCT ON (actor_id) actor_id, created_at
           FROM social_engagement_events
          WHERE owner_id = $1 AND type = 'profile_view'
          ORDER BY actor_id, created_at DESC`,
        [userId],
      ),
    ]);

    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const windowed = (times: Date[]) => {
      let cur = 0;
      let prev = 0;
      for (const t of times) {
        const age = now - new Date(t).getTime();
        if (age <= WEEK) cur++;
        else if (age <= 2 * WEEK) prev++;
      }
      return metric(cur, prev);
    };
    const byType = (type: string) =>
      windowed(events.filter((e) => e.type === type).map((e) => e.created_at));

    const recent = [...viewers]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
    const authors = await hydrateAuthors(recent.map((v) => v.actor_id));

    return {
      profileViews: byType("profile_view"),
      postImpressions: byType("post_impression"),
      searchAppearances: byType("search_appearance"),
      // Follower growth is counted from the follow rows themselves, not from
      // events — the graph already knows exactly when each edge appeared.
      followerGrowth: windowed(follows.map((f) => f.created_at)),
      recentViewers: recent.map((v) => ({
        ...authorOf(authors, v.actor_id),
        viewedAt: iso(v.created_at),
      })),
      uniqueViewers: viewers.length,
    };
  } catch (err) {
    console.error("engagement summary failed (zeroed):", (err as Error)?.message);
    return empty;
  }
}
