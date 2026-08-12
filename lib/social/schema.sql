-- ─────────────────────────────────────────────────────────────
-- Doceeto — social layer (feed, stories, follow graph, DMs,
-- communities, notifications, moderation, engagement).
--
-- Idempotent, like lib/postgres/schema.sql, and applied the same way: the
-- social repo runs this file once per process before its first query (see
-- ensureSchema in lib/social/repo.ts), so the module installs itself on any
-- database that already has `users` — no separate migration step to forget.
--
-- Shape notes, and where they deliberately differ from the brief this was
-- built from:
--
--  • REAL COLUMNS, not one jsonb `data` blob. The brief's own advice. It buys
--    foreign keys, cheap counts, and — the reason that actually matters here —
--    child tables for the things two people touch at once.
--  • LIKES, COMMENTS, VOTES, MEMBERSHIPS AND BOOKMARKS ARE ROWS. Holding them
--    as arrays inside the parent means read-modify-write: two doctors liking
--    the same post in the same second, and one like silently disappears. A row
--    with a composite primary key makes "like once" a database guarantee
--    rather than an intention.
--  • COUNTERS ARE COLUMNS, bumped in the same transaction as the child row.
--    `SELECT count(*)` per post is what turns a feed into a table scan, and
--    `likes.length` is what forces the whole array to be loaded to render "12".
--  • MEDIA IS ITS OWN TABLE, referenced by id. Feed rows stay small enough to
--    page through; the bytes are fetched once by /api/social/media/[id] and
--    cached forever by the browser (ids are random, so the URL is immutable).
--  • ids stay TEXT, matching the ids the rest of the app already uses.
--  • ON DELETE CASCADE everywhere it is true: deleting an account must not
--    leave its likes, memberships or messages behind as orphans.
-- ─────────────────────────────────────────────────────────────

-- ── Media ────────────────────────────────────────────────────
-- Uploaded bytes, kept out of the rows that reference them so a feed page
-- costs kilobytes rather than megabytes. `owner_id` is who uploaded it, which
-- is the only thing that lets a stale blob be attributed later.
CREATE TABLE IF NOT EXISTS social_media (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('image','video','document','audio')),
  -- The original filename, kept only for documents — it is what the reader
  -- sees and what the file downloads as.
  file_name   TEXT,
  byte_size   INTEGER NOT NULL,
  bytes       BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_media_owner_idx ON social_media(owner_id);

-- ── Posts ────────────────────────────────────────────────────
-- `type` is inferred server-side from what was actually attached (see
-- inferPostType in lib/social/rules.ts) rather than trusted from the client,
-- so a text post can't claim to be a milestone.
CREATE TABLE IF NOT EXISTS social_posts (
  id            TEXT PRIMARY KEY,
  author_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL DEFAULT 'text'
                CHECK (type IN ('text','image','video','poll','milestone','document','event')),
  -- Attachments, each an array of social_media ids (or a small descriptor for
  -- video/document, which carry a title and duration beside the id).
  image_ids     TEXT[] NOT NULL DEFAULT '{}',
  video         JSONB,
  document      JSONB,
  -- The poll QUESTION and OPTION LABELS only. Who voted for what lives in
  -- social_poll_votes — a `voters` map inside the row would be both a
  -- read-modify-write race and a privacy leak the moment the row is returned.
  poll          JSONB,
  milestone     JSONB,
  specialty     TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  -- Denormalized counters, moved by the same transaction that inserts or
  -- deletes the child row. Never recomputed on read.
  like_count    INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  share_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ
);
-- The feed's only ordering. (created_at, id) rather than created_at alone so
-- keyset pagination has a total order to seek on and can never repeat or skip
-- a row when two posts share a timestamp.
CREATE INDEX IF NOT EXISTS social_posts_recent_idx ON social_posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS social_posts_author_idx ON social_posts(author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_post_likes (
  post_id     TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS social_post_likes_user_idx ON social_post_likes(user_id);

CREATE TABLE IF NOT EXISTS social_post_comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_post_comments_post_idx ON social_post_comments(post_id, created_at);

-- One row per voter per poll — the primary key IS the "already voted" rule.
CREATE TABLE IF NOT EXISTS social_poll_votes (
  post_id       TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_index  INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- Bookmarks. `item_type` leaves room for saving something other than a post
-- later without a second table.
CREATE TABLE IF NOT EXISTS social_saved_items (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  item_type   TEXT NOT NULL DEFAULT 'post',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id, item_type)
);
CREATE INDEX IF NOT EXISTS social_saved_items_user_idx ON social_saved_items(user_id, created_at DESC);

-- ── Stories ──────────────────────────────────────────────────
-- Ephemeral by READ, not by delete: the query asks for the last 24 hours, so
-- nothing depends on a sweeper job having run. A cleanup job can reclaim the
-- bytes whenever it likes without changing what anyone sees.
CREATE TABLE IF NOT EXISTS social_stories (
  id          TEXT PRIMARY KEY,
  author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id    TEXT NOT NULL REFERENCES social_media(id) ON DELETE CASCADE,
  media_type  TEXT NOT NULL CHECK (media_type IN ('image','video')),
  content     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_stories_recent_idx ON social_stories(created_at DESC);

-- ── Follow graph ─────────────────────────────────────────────
-- Asymmetric (Twitter-style). Mutuality is derived, and it is what gates DMs.
CREATE TABLE IF NOT EXISTS social_follows (
  follower_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  -- Following yourself would make every "and my own posts" clause ambiguous
  -- and every follower count off by one.
  CONSTRAINT social_follows_not_self CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS social_follows_following_idx ON social_follows(following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS social_follows_follower_idx  ON social_follows(follower_id, created_at DESC);

-- ── Blocks ───────────────────────────────────────────────────
-- Stored one-directional (who blocked whom, so only the blocker can undo it)
-- but ENFORCED symmetrically: blockedIds() unions both directions, because if
-- A blocked B then neither should be able to reach the other.
CREATE TABLE IF NOT EXISTS social_blocks (
  blocker_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT social_blocks_not_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS social_blocks_blocked_idx ON social_blocks(blocked_id);

-- ── Direct messaging ─────────────────────────────────────────
-- The id is the participant ids sorted and joined, so "get or create the
-- thread between these two" is one upsert and a duplicate thread is
-- unrepresentable.
CREATE TABLE IF NOT EXISTS social_conversations (
  id               TEXT PRIMARY KEY,
  participants     TEXT[] NOT NULL,
  type             TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  -- Why this thread exists. A named source (e.g. 'consult') is what lets a
  -- doctor and the patient they are actually treating message each other
  -- without following one another first — see BYPASS_SOURCES.
  source           TEXT,
  last_message     JSONB,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_conversations_recent_idx
  ON social_conversations(last_message_at DESC NULLS LAST);

-- Per-participant state, one row each. The unread count HAS to live here: as a
-- jsonb map on the conversation, two people messaging at once rewrite the same
-- object and one increment is lost.
CREATE TABLE IF NOT EXISTS social_conversation_members (
  conversation_id  TEXT NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unread_count     INTEGER NOT NULL DEFAULT 0,
  archived         BOOLEAN NOT NULL DEFAULT FALSE,
  pinned           BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_at     TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS social_conversation_members_user_idx
  ON social_conversation_members(user_id);

CREATE TABLE IF NOT EXISTS social_messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
  sender_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content          TEXT NOT NULL DEFAULT '',
  type             TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','attachment','system')),
  -- Attachment descriptors: [{ mediaId, name, mime, size, kind }].
  attachments      JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_messages_thread_idx
  ON social_messages(conversation_id, created_at DESC, id DESC);

-- ── Communities & channels ───────────────────────────────────
CREATE TABLE IF NOT EXISTS social_communities (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  -- 'system' for the curated set, which belongs to nobody and so can never be
  -- deleted or renamed by the person who happened to open it first.
  creator_id    TEXT,
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  join_policy   TEXT NOT NULL DEFAULT 'open'   CHECK (join_policy IN ('open','request')),
  member_count  INTEGER NOT NULL DEFAULT 0,
  -- Fixed display order for the curated set; user-created communities sort
  -- after them by name.
  sort_order    INTEGER NOT NULL DEFAULT 1000,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Two communities called "Paediatrics" are two places to have the same
-- conversation, and nobody finds the second one. Case-insensitive, so
-- "paediatrics" doesn't slip past it either.
CREATE UNIQUE INDEX IF NOT EXISTS social_communities_name_key
  ON social_communities(lower(name));

CREATE TABLE IF NOT EXISTS social_community_members (
  community_id  TEXT NOT NULL REFERENCES social_communities(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  -- 'pending' is a join REQUEST, not a membership: every access check tests
  -- state = 'member', so a pending row grants nothing.
  state         TEXT NOT NULL DEFAULT 'member' CHECK (state IN ('member','pending')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS social_community_members_user_idx
  ON social_community_members(user_id, state);

CREATE TABLE IF NOT EXISTS social_channels (
  id            TEXT PRIMARY KEY,
  community_id  TEXT NOT NULL REFERENCES social_communities(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','voice')),
  description   TEXT NOT NULL DEFAULT '',
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  creator_id    TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 100,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Default channels are provisioned on every community read; the unique index
-- is what makes that provisioning idempotent instead of a duplicate factory.
CREATE UNIQUE INDEX IF NOT EXISTS social_channels_name_key
  ON social_channels(community_id, lower(name));

CREATE TABLE IF NOT EXISTS social_channel_members (
  channel_id  TEXT NOT NULL REFERENCES social_channels(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state       TEXT NOT NULL DEFAULT 'member' CHECK (state IN ('member','pending')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS social_channel_messages (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL REFERENCES social_channels(id) ON DELETE CASCADE,
  sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','attachment','audio','system')),
  attachments JSONB,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_channel_messages_channel_idx
  ON social_channel_messages(channel_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS social_channel_messages_pinned_idx
  ON social_channel_messages(channel_id) WHERE pinned;

-- Per-user flags on a channel message (bookmark it, or file it to the
-- briefcase). Rows, not `bookmarkedBy[]` on the message — same race, same fix.
CREATE TABLE IF NOT EXISTS social_message_flags (
  message_id  TEXT NOT NULL REFERENCES social_channel_messages(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('bookmark','briefcase')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, kind)
);
CREATE INDEX IF NOT EXISTS social_message_flags_user_idx ON social_message_flags(user_id, kind);

CREATE TABLE IF NOT EXISTS social_community_invites (
  id             TEXT PRIMARY KEY,
  community_id   TEXT NOT NULL REFERENCES social_communities(id) ON DELETE CASCADE,
  inviter_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accept','decline')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One live invite per person per community; re-inviting updates the row it
-- finds rather than stacking a second notification on the same person.
CREATE UNIQUE INDEX IF NOT EXISTS social_community_invites_key
  ON social_community_invites(community_id, target_user_id);

-- ── Notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  -- An in-app route, not a URL: '/doctor/network?post=xyz'.
  link        TEXT,
  sender_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  -- Actionable payload — a community invite renders accept/decline from this.
  metadata    JSONB,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_notifications_user_idx
  ON social_notifications(user_id, created_at DESC);
-- Serves the unread badge without touching the read ones.
CREATE INDEX IF NOT EXISTS social_notifications_unread_idx
  ON social_notifications(user_id) WHERE NOT read;

-- ── Moderation ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_reports (
  id           TEXT PRIMARY KEY,
  reporter_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  reason       TEXT NOT NULL,
  details      TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Reporting the same thing twice is a mis-tap, not a second complaint.
CREATE UNIQUE INDEX IF NOT EXISTS social_reports_once_key
  ON social_reports(reporter_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS social_reports_queue_idx ON social_reports(status, created_at DESC);

-- ── Engagement analytics ─────────────────────────────────────
-- The primary key is the whole identity of the event, DAY INCLUDED. That is
-- the entire idempotency mechanism: refreshing someone's profile fifty times
-- is fifty upserts onto the same key and one counted view, with no read first
-- and no way to double-count under concurrency.
CREATE TABLE IF NOT EXISTS social_engagement_events (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('profile_view','post_impression','search_appearance')),
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     TEXT,
  day         DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_engagement_owner_idx
  ON social_engagement_events(owner_id, type, created_at DESC);
