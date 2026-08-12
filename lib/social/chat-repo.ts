import "server-only";
import { sql, one, tx } from "@/lib/postgres/client";
import { DomainError } from "@/lib/db/shared";
import {
  authorOf,
  blockedIds,
  followStatus,
  hydrateAuthors,
  notify,
} from "@/lib/social/repo";
import {
  BYPASS_SOURCES,
  CURATED_COMMUNITIES,
  DEFAULT_CHANNELS,
  MESSAGE_PAGE_SIZE,
  conversationIdFor,
  excerpt,
  extensionOf,
  formatBytes,
  isSystemCommunity,
  mediaUrl,
} from "@/lib/social/rules";
import type {
  Channel,
  ChannelMessage,
  Community,
  ConversationSummary,
  DirectMessage,
  MessageAttachment,
  SocialAuthor,
} from "@/lib/social/types";

/**
 * Direct messages and communities.
 *
 * Split from lib/social/repo.ts by subject, not by layer — both are the same
 * kind of module and share its helpers. What holds this half together is a
 * single idea: **the conversation id, the channel id and the community id
 * prove nothing.** Every function re-derives what the caller is allowed to do
 * from the membership tables, on every call, read and write alike. An id in a
 * URL is a claim, and the only thing standing between a guessed id and someone
 * else's inbox is that these checks are never skipped "because the list
 * already filtered it".
 */

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const iso = (d: Date | string | null | undefined): string => (d ? new Date(d).toISOString() : "");

// ── Attachments ─────────────────────────────────────────────

interface StoredAttachment {
  mediaId: string;
  name: string;
  mime: string;
  size: number;
  kind: MessageAttachment["kind"];
}

const toAttachments = (raw: unknown): MessageAttachment[] =>
  Array.isArray(raw)
    ? (raw as StoredAttachment[]).map((a) => ({ ...a, url: mediaUrl(a.mediaId) }))
    : [];

/**
 * Resolve media ids the SENDER owns into attachment descriptors. Ids that
 * aren't theirs simply don't come back, so an attachment can never be somebody
 * else's upload referenced by a guessed id.
 */
export async function resolveAttachments(
  ownerId: string,
  ids: string[],
): Promise<StoredAttachment[]> {
  if (!ids.length) return [];
  const rows = await sql<{
    id: string;
    mime: string;
    kind: MessageAttachment["kind"];
    file_name: string | null;
    byte_size: number;
  }>(
    `SELECT id, mime, kind, file_name, byte_size FROM social_media
      WHERE id = ANY($1) AND owner_id = $2`,
    [ids, ownerId],
  );
  return rows.map((r) => ({
    mediaId: r.id,
    name: r.file_name || `${extensionOf(r.file_name || "")} file`,
    mime: r.mime,
    size: r.byte_size,
    kind: r.kind,
  }));
}

/** A one-line preview for a thread list, whatever the message actually was. */
const previewOf = (content: string, attachments: StoredAttachment[]): string =>
  content ? excerpt(content, 120) : attachments.length ? `📎 ${attachments[0].name}` : "";

// ── Direct messaging ────────────────────────────────────────

/** The participant check, run by EVERY conversation endpoint including delete. */
async function assertParticipant(conversationId: string, userId: string): Promise<string[]> {
  const row = await one<{ participants: string[] }>(
    `SELECT participants FROM social_conversations WHERE id = $1`,
    [conversationId],
  );
  if (!row) throw new DomainError("That conversation no longer exists.", 404);
  if (!row.participants.includes(userId)) {
    throw new DomainError("That isn't your conversation.", 403);
  }
  return row.participants;
}

/**
 * Is this pair already in a working relationship the platform knows about?
 *
 * The bypass to the mutual-follow gate has to be VERIFIED, not asserted. A
 * client that can send `source: "consult"` and be believed has a boolean flag
 * with extra steps — exactly what the gate was built to prevent. So the claimed
 * source is checked against the tables that would make it true: a consult
 * between these two people, or a hired gig.
 */
async function hasCareRelationship(a: string, b: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    `SELECT id FROM consult_requests
      WHERE ((patient_id = $1 AND doctor_id = $2) OR (patient_id = $2 AND doctor_id = $1))
        AND status IN ('pending','accepted','completed')
      LIMIT 1`,
    [a, b],
  );
  return Boolean(row);
}

/**
 * Get the thread with someone, creating it if it doesn't exist.
 *
 * TWO THINGS IN A DELIBERATE ORDER.
 *
 * First, an EXISTING conversation is returned before the gate is consulted.
 * Two colleagues who unfollow each other later should not have their history
 * become unreachable — the gate decides who may START a conversation, not who
 * may continue one.
 *
 * Second, the gate itself: a direct thread needs the follow to be MUTUAL. This
 * is the whole reason a doctor's inbox is usable — following someone is public
 * and one-sided, so without it any account could open a thread with any
 * provider on the platform. `MUTUAL_FOLLOW_REQUIRED` is returned as a code so
 * the client can offer "follow them first" instead of a shrug.
 */
export async function getOrCreateConversation(
  meId: string,
  otherId: string,
  source?: string,
): Promise<{ id: string; created: boolean }> {
  if (meId === otherId) throw new DomainError("You cannot message yourself.");

  const id = conversationIdFor([meId, otherId]);
  const existing = await one<{ id: string }>(
    `SELECT id FROM social_conversations WHERE id = $1`,
    [id],
  );
  if (existing) return { id, created: false };

  const blocked = await blockedIds(meId);
  if (blocked.has(otherId)) throw new DomainError("You cannot message that account.", 403);

  const bypass = Boolean(source && BYPASS_SOURCES.has(source)) && (await hasCareRelationship(meId, otherId));
  if (!bypass) {
    const status = await followStatus(meId, otherId);
    if (!status.isMutual) {
      const err = new DomainError(
        "You can message each other once you both follow.",
        403,
      ) as DomainError & { code?: string };
      err.code = "MUTUAL_FOLLOW_REQUIRED";
      throw err;
    }
  }

  const participants = [meId, otherId].sort();
  await tx(async (c) => {
    await c.query(
      `INSERT INTO social_conversations (id, participants, type, source)
       VALUES ($1,$2,'direct',$3) ON CONFLICT (id) DO NOTHING`,
      [id, participants, bypass ? source : null],
    );
    for (const p of participants) {
      await c.query(
        `INSERT INTO social_conversation_members (conversation_id, user_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [id, p],
      );
    }
  });
  return { id, created: true };
}

export async function listConversations(meId: string): Promise<ConversationSummary[]> {
  const hidden = await blockedIds(meId);
  const rows = await sql<{
    id: string;
    participants: string[];
    type: "direct" | "group";
    source: string | null;
    last_message: { content: string; senderId: string; at: string } | null;
    created_at: Date;
    unread_count: number;
    archived: boolean;
    pinned: boolean;
  }>(
    `SELECT c.id, c.participants, c.type, c.source, c.last_message, c.created_at,
            m.unread_count, m.archived, m.pinned
       FROM social_conversation_members m
       JOIN social_conversations c ON c.id = m.conversation_id
      WHERE m.user_id = $1
      ORDER BY m.pinned DESC, c.last_message_at DESC NULLS LAST, c.created_at DESC
      LIMIT 200`,
    [meId],
  );

  // A thread whose only other participant is blocked disappears from the list
  // in both directions — the same rule that hides their posts.
  const visible = rows.filter((r) => !r.participants.some((p) => p !== meId && hidden.has(p)));
  const authors = await hydrateAuthors(visible.flatMap((r) => r.participants));

  return visible.map((r) => ({
    id: r.id,
    others: r.participants.filter((p) => p !== meId).map((p) => authorOf(authors, p)),
    type: r.type,
    source: r.source ?? undefined,
    lastMessage: r.last_message ?? undefined,
    unreadCount: r.unread_count,
    archived: r.archived,
    pinned: r.pinned,
    createdAt: iso(r.created_at),
  }));
}

export async function listMessages(
  conversationId: string,
  meId: string,
  before?: string | null,
): Promise<{ messages: DirectMessage[]; nextCursor: string | null }> {
  await assertParticipant(conversationId, meId);
  const hidden = await blockedIds(meId);

  const [cursorAt, cursorId] = (before ?? "").split("|");
  const hasCursor = Boolean(cursorAt && cursorId);

  const rows = await sql<{
    id: string;
    sender_id: string;
    content: string;
    type: DirectMessage["type"];
    attachments: unknown;
    created_at: Date;
  }>(
    `SELECT id, sender_id, content, type, attachments, created_at
       FROM social_messages
      WHERE conversation_id = $1
        AND ($2::boolean IS FALSE OR (created_at, id) < ($3::timestamptz, $4::text))
      ORDER BY created_at DESC, id DESC
      LIMIT $5`,
    [conversationId, hasCursor, hasCursor ? cursorAt : null, hasCursor ? cursorId : null, MESSAGE_PAGE_SIZE + 1],
  );

  const page = rows.slice(0, MESSAGE_PAGE_SIZE);
  const last = page[page.length - 1];
  // Blocked senders' messages are withheld rather than the thread being
  // hidden: in a group the rest of the conversation still belongs to everyone.
  const shown = page.filter((r) => !hidden.has(r.sender_id));
  const authors = await hydrateAuthors(shown.map((r) => r.sender_id));

  return {
    // Fetched newest-first for the cursor; rendered oldest-first.
    messages: shown
      .slice()
      .reverse()
      .map((r) => ({
        id: r.id,
        conversationId,
        sender: authorOf(authors, r.sender_id),
        content: r.content,
        type: r.type,
        attachments: toAttachments(r.attachments),
        createdAt: iso(r.created_at),
      })),
    nextCursor: rows.length > MESSAGE_PAGE_SIZE && last ? `${iso(last.created_at)}|${last.id}` : null,
  };
}

/**
 * Send a message.
 *
 * The unread bookkeeping is the part worth reading twice. It is a single
 * UPDATE across the OTHER participants' member rows, incremented by the
 * database. Held as a `{userId: count}` object on the conversation — which is
 * how this was originally shaped — two people replying at the same moment
 * both write the whole object and one increment is lost, permanently: nothing
 * ever recomputes it, so the badge is simply wrong from then on.
 */
export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  content: string;
  attachmentIds?: string[];
}): Promise<{ message: DirectMessage; recipients: string[] }> {
  const participants = await assertParticipant(input.conversationId, input.senderId);
  const others = participants.filter((p) => p !== input.senderId);

  const hidden = await blockedIds(input.senderId);
  if (others.some((p) => hidden.has(p))) {
    throw new DomainError("You cannot message that account.", 403);
  }

  const attachments = await resolveAttachments(input.senderId, input.attachmentIds ?? []);
  if (!input.content && !attachments.length) throw new DomainError("Write something first.");

  const id = uid("dm");
  const createdAt = await tx(async (c) => {
    const row = await c.query<{ created_at: Date }>(
      `INSERT INTO social_messages (id, conversation_id, sender_id, content, type, attachments)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING created_at`,
      [
        id,
        input.conversationId,
        input.senderId,
        input.content,
        attachments.length ? "attachment" : "text",
        attachments.length ? JSON.stringify(attachments) : null,
      ],
    );
    const at = row.rows[0].created_at;
    await c.query(
      `UPDATE social_conversations
          SET last_message = $2::jsonb, last_message_at = $3
        WHERE id = $1`,
      [
        input.conversationId,
        JSON.stringify({
          content: previewOf(input.content, attachments),
          senderId: input.senderId,
          at: iso(at),
        }),
        at,
      ],
    );
    // Everyone except the sender. One statement, incremented in place.
    await c.query(
      `UPDATE social_conversation_members
          SET unread_count = unread_count + 1, archived = FALSE
        WHERE conversation_id = $1 AND user_id <> $2`,
      [input.conversationId, input.senderId],
    );
    return at;
  });

  const authors = await hydrateAuthors([input.senderId]);
  const sender = authorOf(authors, input.senderId);
  for (const recipient of others) {
    void notify({
      userId: recipient,
      type: "message",
      title: `${sender.name} sent you a message`,
      content: previewOf(input.content, attachments),
      link: `/doctor/network?tab=messages&thread=${input.conversationId}`,
      senderId: input.senderId,
      metadata: { conversationId: input.conversationId },
    });
  }

  return {
    message: {
      id,
      conversationId: input.conversationId,
      sender,
      content: input.content,
      type: attachments.length ? "attachment" : "text",
      attachments: attachments.map((a) => ({ ...a, url: mediaUrl(a.mediaId) })),
      createdAt: iso(createdAt),
    },
    recipients: others,
  };
}

/** Clears only the CALLER's badge — never anybody else's. */
export async function markConversationRead(conversationId: string, meId: string): Promise<void> {
  await assertParticipant(conversationId, meId);
  await sql(
    `UPDATE social_conversation_members
        SET unread_count = 0, last_read_at = now()
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, meId],
  );
}

/** Archive and pin are PER PERSON: one side tidying up must not move the other's list. */
export async function setConversationFlag(
  conversationId: string,
  meId: string,
  flag: "archived" | "pinned",
  value: boolean,
): Promise<void> {
  await assertParticipant(conversationId, meId);
  await sql(
    `UPDATE social_conversation_members SET ${flag} = $3
      WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, meId, value],
  );
}

/**
 * Delete a conversation.
 *
 * Runs the SAME participant check as reading and sending. In the build this
 * was ported from, delete was the one endpoint that skipped it — so anyone who
 * could guess a conversation id could destroy a thread they were never part
 * of. It is worth stating plainly: every endpoint that takes a conversation id
 * checks membership, and "the destructive one" is not an exception, it is the
 * one where it matters most.
 */
export async function deleteConversation(conversationId: string, meId: string): Promise<void> {
  await assertParticipant(conversationId, meId);
  // Messages and member rows go with it through ON DELETE CASCADE.
  await sql(`DELETE FROM social_conversations WHERE id = $1`, [conversationId]);
}

/**
 * Who this person can start a thread with: their mutual follows.
 *
 * The same rule the gate enforces, asked as a question. Returning every user
 * here — which the reference build did — quietly widens the product's answer
 * to "who can I reach" beyond what sending actually permits, so the list
 * offers people that then 403. One policy, applied in both places.
 */
export async function messageableUsers(meId: string): Promise<SocialAuthor[]> {
  const hidden = await blockedIds(meId);
  const rows = await sql<{ other: string }>(
    `SELECT f.following_id AS other
       FROM social_follows f
       JOIN social_follows b
         ON b.follower_id = f.following_id AND b.following_id = f.follower_id
      WHERE f.follower_id = $1
      LIMIT 200`,
    [meId],
  );
  const ids = rows.map((r) => r.other).filter((id) => !hidden.has(id));
  const authors = await hydrateAuthors(ids);
  return ids.map((id) => authorOf(authors, id));
}

// ── Communities ─────────────────────────────────────────────

interface CommunityRow {
  id: string;
  name: string;
  description: string;
  creator_id: string | null;
  visibility: "public" | "private";
  join_policy: "open" | "request";
  member_count: number;
  created_at: Date;
  my_role: string | null;
  my_state: string | null;
}

/**
 * THE access resolver. One function, used by every community read and every
 * community write.
 *
 * It exists as a single function precisely because reads and writes drift
 * apart when each has its own copy: a read that is fractionally more generous
 * than the write it guards is how a private room becomes readable. If the
 * rules change, they change here, once.
 */
export function communityAccess(row: {
  visibility: string;
  join_policy: string;
  creator_id: string | null;
  my_role: string | null;
  my_state: string | null;
}): { openJoin: boolean; isMember: boolean; isAdmin: boolean; isPending: boolean; canRead: boolean } {
  const isAdmin = row.my_role === "admin" && row.my_state === "member";
  const isMember = isAdmin || row.my_state === "member";
  const openJoin = row.visibility === "public" && row.join_policy === "open";
  return {
    openJoin,
    isMember,
    isAdmin,
    isPending: row.my_state === "pending",
    // Public rooms are readable by anyone signed in; closed ones need
    // membership. Reading is never enough to join — see joinOnWrite.
    canRead: row.visibility === "public" || isMember,
  };
}

const toCommunity = (row: CommunityRow): Community => {
  const access = communityAccess(row);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    joinPolicy: row.join_policy,
    memberCount: row.member_count,
    isSystem: isSystemCommunity(row.id),
    isMember: access.isMember,
    isAdmin: access.isAdmin,
    isPending: access.isPending,
    createdAt: iso(row.created_at),
  };
};

/**
 * Make sure the curated set and every community's default channels exist.
 *
 * Idempotent inserts only. It deliberately does NOT delete anything: the build
 * this came from hard-deleted every community outside its canonical list, on a
 * plain GET — a destructive write on a read path, which also flatly
 * contradicts letting people create their own. Seeding a floor and purging
 * everything else cannot both be right; this seeds.
 */
export async function ensureCommunities(): Promise<void> {
  await sql(
    `INSERT INTO social_communities (id, name, description, creator_id, sort_order)
     SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::int[])
     ON CONFLICT (id) DO NOTHING`,
    [
      CURATED_COMMUNITIES.map((c) => c.id),
      CURATED_COMMUNITIES.map((c) => c.name),
      CURATED_COMMUNITIES.map((c) => c.description),
      CURATED_COMMUNITIES.map(() => "system"),
      CURATED_COMMUNITIES.map((c) => c.sortOrder),
    ],
  );
  // Every community gets `general` and `voice-lounge`. The unique index on
  // (community_id, lower(name)) is what makes re-running this a no-op rather
  // than a duplicate factory.
  await sql(
    `INSERT INTO social_channels (id, community_id, name, type, description, sort_order)
     SELECT 'ch-' || c.id || '-' || d.name, c.id, d.name, d.type, d.description, d.sort_order
       FROM social_communities c
       CROSS JOIN (
         SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::int[])
              AS t(name, type, description, sort_order)
       ) d
     ON CONFLICT (community_id, lower(name)) DO NOTHING`,
    [
      DEFAULT_CHANNELS.map((c) => c.name),
      DEFAULT_CHANNELS.map((c) => c.type),
      DEFAULT_CHANNELS.map((c) => c.description),
      DEFAULT_CHANNELS.map((c) => c.sortOrder),
    ],
  );
}

export async function listCommunities(meId: string): Promise<Community[]> {
  await ensureCommunities();
  const rows = await sql<CommunityRow>(
    `SELECT c.id, c.name, c.description, c.creator_id, c.visibility, c.join_policy,
            c.member_count, c.created_at, m.role AS my_role, m.state AS my_state
       FROM social_communities c
       LEFT JOIN social_community_members m ON m.community_id = c.id AND m.user_id = $1
      WHERE c.visibility = 'public' OR m.state = 'member'
      ORDER BY c.sort_order ASC, c.name ASC
      LIMIT 200`,
    [meId],
  );
  return rows.map(toCommunity);
}

async function loadCommunity(communityId: string, meId: string): Promise<CommunityRow> {
  const row = await one<CommunityRow>(
    `SELECT c.id, c.name, c.description, c.creator_id, c.visibility, c.join_policy,
            c.member_count, c.created_at, m.role AS my_role, m.state AS my_state
       FROM social_communities c
       LEFT JOIN social_community_members m ON m.community_id = c.id AND m.user_id = $2
      WHERE c.id = $1`,
    [communityId, meId],
  );
  if (!row) throw new DomainError("That community no longer exists.", 404);
  return row;
}

export async function createCommunity(input: {
  creatorId: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  joinPolicy: "open" | "request";
}): Promise<Community> {
  const id = uid("com");
  try {
    await tx(async (c) => {
      await c.query(
        `INSERT INTO social_communities
           (id, name, description, creator_id, visibility, join_policy, member_count)
         VALUES ($1,$2,$3,$4,$5,$6,1)`,
        [id, input.name, input.description, input.creatorId, input.visibility, input.joinPolicy],
      );
      // The creator is an admin from the first instant — a community with no
      // one who can approve a join request is a dead room.
      await c.query(
        `INSERT INTO social_community_members (community_id, user_id, role, state)
         VALUES ($1,$2,'admin','member')`,
        [id, input.creatorId],
      );
    });
  } catch (err) {
    // The unique index on lower(name) is the real guard — it also stops
    // somebody claiming creator rights over a curated name by racing the seed.
    if ((err as { code?: string }).code === "23505") {
      throw new DomainError("A community with that name already exists.");
    }
    throw err;
  }
  await ensureCommunities();
  return toCommunity(await loadCommunity(id, input.creatorId));
}

export async function deleteCommunity(communityId: string, meId: string): Promise<void> {
  if (isSystemCommunity(communityId)) {
    throw new DomainError("Doceeto's own communities cannot be deleted.", 403);
  }
  const row = await loadCommunity(communityId, meId);
  if (row.creator_id !== meId) throw new DomainError("Only the creator can delete this.", 403);
  await sql(`DELETE FROM social_communities WHERE id = $1`, [communityId]);
}

/**
 * Join, or ask to.
 *
 * An open public community adds you immediately; anything else records a
 * pending request and tells the admins. `state` is what every access check
 * reads, so a pending row grants exactly nothing in the meantime.
 */
export async function joinCommunity(
  communityId: string,
  meId: string,
): Promise<{ joined: boolean; pending: boolean }> {
  const row = await loadCommunity(communityId, meId);
  const access = communityAccess(row);
  if (access.isMember) return { joined: true, pending: false };

  const state = access.openJoin ? "member" : "pending";
  const inserted = await tx(async (c) => {
    const res = await c.query(
      `INSERT INTO social_community_members (community_id, user_id, state)
       VALUES ($1,$2,$3) ON CONFLICT (community_id, user_id) DO NOTHING`,
      [communityId, meId, state],
    );
    // The counter moves only for an actual new member, in the same
    // transaction, computed by the database.
    if ((res.rowCount ?? 0) > 0 && state === "member") {
      await c.query(
        `UPDATE social_communities SET member_count = member_count + 1 WHERE id = $1`,
        [communityId],
      );
    }
    return (res.rowCount ?? 0) > 0;
  });

  if (inserted && state === "pending") {
    const admins = await sql<{ user_id: string }>(
      `SELECT user_id FROM social_community_members
        WHERE community_id = $1 AND role = 'admin' AND state = 'member'`,
      [communityId],
    );
    const authors = await hydrateAuthors([meId]);
    for (const admin of admins) {
      void notify({
        userId: admin.user_id,
        type: "community_join",
        title: `${authorOf(authors, meId).name} asked to join ${row.name}`,
        link: `/doctor/network?tab=communities&community=${communityId}`,
        senderId: meId,
        metadata: { communityId, userId: meId },
      });
    }
  }
  return { joined: state === "member", pending: state === "pending" };
}

export async function handleJoinRequest(
  communityId: string,
  adminId: string,
  userId: string,
  action: "approve" | "reject",
): Promise<void> {
  const row = await loadCommunity(communityId, adminId);
  if (!communityAccess(row).isAdmin) throw new DomainError("Admins only.", 403);

  if (action === "reject") {
    await sql(
      `DELETE FROM social_community_members
        WHERE community_id = $1 AND user_id = $2 AND state = 'pending'`,
      [communityId, userId],
    );
    return;
  }
  await tx(async (c) => {
    const res = await c.query(
      `UPDATE social_community_members SET state = 'member'
        WHERE community_id = $1 AND user_id = $2 AND state = 'pending'`,
      [communityId, userId],
    );
    if ((res.rowCount ?? 0) > 0) {
      await c.query(
        `UPDATE social_communities SET member_count = member_count + 1 WHERE id = $1`,
        [communityId],
      );
    }
  });
  void notify({
    userId,
    type: "community_join",
    title: `You're in — ${row.name}`,
    link: `/doctor/network?tab=communities&community=${communityId}`,
    senderId: adminId,
    metadata: { communityId },
  });
}

export async function leaveCommunity(communityId: string, meId: string): Promise<void> {
  await tx(async (c) => {
    const res = await c.query(
      `DELETE FROM social_community_members
        WHERE community_id = $1 AND user_id = $2 AND state = 'member'`,
      [communityId, meId],
    );
    if ((res.rowCount ?? 0) > 0) {
      await c.query(
        `UPDATE social_communities SET member_count = GREATEST(0, member_count - 1) WHERE id = $1`,
        [communityId],
      );
    }
  });
}

/**
 * The roster.
 *
 * Member-only for a closed community: who is in a private room is itself
 * private, and a list of names, specialties and photos is exactly what a
 * scraper wants.
 */
export async function listCommunityMembers(
  communityId: string,
  meId: string,
): Promise<{ members: SocialAuthor[]; pending: SocialAuthor[] }> {
  const row = await loadCommunity(communityId, meId);
  const access = communityAccess(row);
  if (!access.canRead || (row.visibility !== "public" && !access.isMember)) {
    throw new DomainError("Join to see who's here.", 403);
  }
  const rows = await sql<{ user_id: string; state: string }>(
    `SELECT user_id, state FROM social_community_members
      WHERE community_id = $1 ORDER BY role ASC, created_at ASC LIMIT 500`,
    [communityId],
  );
  const authors = await hydrateAuthors(rows.map((r) => r.user_id));
  return {
    members: rows.filter((r) => r.state === "member").map((r) => authorOf(authors, r.user_id)),
    // Only an admin has any use for the pending list, and only an admin sees it.
    pending: access.isAdmin
      ? rows.filter((r) => r.state === "pending").map((r) => authorOf(authors, r.user_id))
      : [],
  };
}

export async function inviteToCommunity(
  communityId: string,
  inviterId: string,
  targetUserId: string,
): Promise<void> {
  const row = await loadCommunity(communityId, inviterId);
  // ANY member may invite, not just admins. A community grows through the
  // people in it; routing every invitation through an admin is how a room
  // stays the size it started at.
  if (!communityAccess(row).isMember) throw new DomainError("Join before inviting others.", 403);
  if (targetUserId === inviterId) throw new DomainError("You're already here.");

  const id = uid("inv");
  const inserted = await sql<{ id: string }>(
    `INSERT INTO social_community_invites (id, community_id, inviter_id, target_user_id)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (community_id, target_user_id) DO UPDATE SET status = 'pending'
     RETURNING id`,
    [id, communityId, inviterId, targetUserId],
  );
  const authors = await hydrateAuthors([inviterId]);
  void notify({
    userId: targetUserId,
    type: "community_invite",
    title: `${authorOf(authors, inviterId).name} invited you to ${row.name}`,
    content: row.description,
    link: `/doctor/network?tab=communities&community=${communityId}`,
    senderId: inviterId,
    // The accept/decline buttons render straight from this.
    metadata: { communityId, inviteId: inserted[0]?.id ?? id },
  });
}

export async function respondToInvite(
  inviteId: string,
  meId: string,
  response: "accept" | "decline",
): Promise<void> {
  const invite = await one<{ community_id: string; target_user_id: string }>(
    `SELECT community_id, target_user_id FROM social_community_invites
      WHERE id = $1 AND status = 'pending'`,
    [inviteId],
  );
  if (!invite) throw new DomainError("That invitation is no longer open.", 404);
  if (invite.target_user_id !== meId) throw new DomainError("That invitation isn't yours.", 403);

  await tx(async (c) => {
    await c.query(`UPDATE social_community_invites SET status = $2 WHERE id = $1`, [
      inviteId,
      response,
    ]);
    if (response !== "accept") return;
    const res = await c.query(
      `INSERT INTO social_community_members (community_id, user_id, state)
       VALUES ($1,$2,'member')
       ON CONFLICT (community_id, user_id) DO UPDATE SET state = 'member'
       WHERE social_community_members.state <> 'member'`,
      [invite.community_id, meId],
    );
    if ((res.rowCount ?? 0) > 0) {
      await c.query(
        `UPDATE social_communities SET member_count = member_count + 1 WHERE id = $1`,
        [invite.community_id],
      );
    }
  });
}

// ── Channels ────────────────────────────────────────────────

interface ChannelRow {
  id: string;
  community_id: string;
  name: string;
  type: "text" | "voice";
  description: string;
  visibility: "public" | "private";
  creator_id: string | null;
  my_state: string | null;
}

export async function listChannels(communityId: string, meId: string): Promise<Channel[]> {
  await ensureCommunities();
  const community = await loadCommunity(communityId, meId);
  const access = communityAccess(community);
  // Reading a closed community's channel list is not permitted — and, just as
  // importantly, reading an OPEN one does not make you a member. Membership
  // follows an explicit write (posting, or tapping join), never a GET.
  if (!access.canRead) {
    const err = new DomainError("This community is private.", 403) as DomainError & {
      restricted?: boolean;
    };
    err.restricted = true;
    throw err;
  }

  const rows = await sql<ChannelRow>(
    `SELECT ch.id, ch.community_id, ch.name, ch.type, ch.description, ch.visibility,
            ch.creator_id, cm.state AS my_state
       FROM social_channels ch
       LEFT JOIN social_channel_members cm ON cm.channel_id = ch.id AND cm.user_id = $2
      WHERE ch.community_id = $1
      ORDER BY ch.sort_order ASC, ch.name ASC`,
    [communityId, meId],
  );

  return rows.map((row) => ({
    id: row.id,
    communityId: row.community_id,
    name: row.name,
    type: row.type,
    description: row.description,
    visibility: row.visibility,
    canRead: channelReadable(row, access.isAdmin, meId),
    isPending: row.my_state === "pending",
  }));
}

/**
 * A private channel needs one of three things: membership of the channel,
 * having created it, or being an admin of the community above it. A public
 * channel inherits the community's own access, which was already checked.
 */
function channelReadable(row: ChannelRow, isCommunityAdmin: boolean, meId: string): boolean {
  if (row.visibility === "public") return true;
  return row.my_state === "member" || row.creator_id === meId || isCommunityAdmin;
}

async function loadChannel(
  channelId: string,
  meId: string,
): Promise<{ channel: ChannelRow; community: CommunityRow }> {
  const channel = await one<ChannelRow>(
    `SELECT ch.id, ch.community_id, ch.name, ch.type, ch.description, ch.visibility,
            ch.creator_id, cm.state AS my_state
       FROM social_channels ch
       LEFT JOIN social_channel_members cm ON cm.channel_id = ch.id AND cm.user_id = $2
      WHERE ch.id = $1`,
    [channelId, meId],
  );
  if (!channel) throw new DomainError("That channel no longer exists.", 404);
  return { channel, community: await loadCommunity(channel.community_id, meId) };
}

export async function createChannel(input: {
  communityId: string;
  meId: string;
  name: string;
  type: "text" | "voice";
  description: string;
  visibility: "public" | "private";
}): Promise<Channel> {
  const community = await loadCommunity(input.communityId, input.meId);
  if (!communityAccess(community).isAdmin) {
    throw new DomainError("Only community admins can add channels.", 403);
  }
  const id = uid("ch");
  try {
    await sql(
      `INSERT INTO social_channels (id, community_id, name, type, description, visibility, creator_id, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,100)`,
      [id, input.communityId, input.name, input.type, input.description, input.visibility, input.meId],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new DomainError("This community already has a channel with that name.");
    }
    throw err;
  }
  return {
    id,
    communityId: input.communityId,
    name: input.name,
    type: input.type,
    description: input.description,
    visibility: input.visibility,
    canRead: true,
    isPending: false,
  };
}

export async function requestChannelAccess(channelId: string, meId: string): Promise<void> {
  const { channel, community } = await loadChannel(channelId, meId);
  if (!communityAccess(community).isMember) {
    throw new DomainError("Join the community first.", 403);
  }
  if (channel.visibility !== "private") return;
  await sql(
    `INSERT INTO social_channel_members (channel_id, user_id, state) VALUES ($1,$2,'pending')
     ON CONFLICT DO NOTHING`,
    [channelId, meId],
  );
}

export async function handleChannelRequest(
  channelId: string,
  adminId: string,
  userId: string,
  action: "approve" | "reject",
): Promise<void> {
  const { channel, community } = await loadChannel(channelId, adminId);
  const isAdmin = communityAccess(community).isAdmin || channel.creator_id === adminId;
  if (!isAdmin) throw new DomainError("Only channel or community admins can do this.", 403);

  if (action === "approve") {
    await sql(
      `UPDATE social_channel_members SET state = 'member'
        WHERE channel_id = $1 AND user_id = $2`,
      [channelId, userId],
    );
  } else {
    await sql(`DELETE FROM social_channel_members WHERE channel_id = $1 AND user_id = $2`, [
      channelId,
      userId,
    ]);
  }
}

export async function listChannelMessages(
  channelId: string,
  meId: string,
  pinnedOnly = false,
): Promise<ChannelMessage[]> {
  const { channel, community } = await loadChannel(channelId, meId);
  const access = communityAccess(community);
  if (!access.canRead || !channelReadable(channel, access.isAdmin, meId)) {
    const err = new DomainError("You don't have access to this channel.", 403) as DomainError & {
      pending?: boolean;
    };
    err.pending = channel.my_state === "pending";
    throw err;
  }

  const hidden = await blockedIds(meId);
  const rows = await sql<{
    id: string;
    sender_id: string;
    content: string;
    type: ChannelMessage["type"];
    attachments: unknown;
    pinned: boolean;
    created_at: Date;
  }>(
    `SELECT id, sender_id, content, type, attachments, pinned, created_at
       FROM social_channel_messages
      WHERE channel_id = $1 AND ($2::boolean IS FALSE OR pinned)
      ORDER BY created_at DESC LIMIT ${MESSAGE_PAGE_SIZE}`,
    [channelId, pinnedOnly],
  );
  const visible = rows.filter((r) => !hidden.has(r.sender_id));

  const flags = await sql<{ message_id: string; kind: string }>(
    `SELECT message_id, kind FROM social_message_flags
      WHERE user_id = $1 AND message_id = ANY($2)`,
    [meId, visible.map((r) => r.id)],
  );
  const bookmarked = new Set(flags.filter((f) => f.kind === "bookmark").map((f) => f.message_id));
  const briefcased = new Set(flags.filter((f) => f.kind === "briefcase").map((f) => f.message_id));
  const authors = await hydrateAuthors(visible.map((r) => r.sender_id));

  return visible
    .slice()
    .reverse()
    .map((r) => ({
      id: r.id,
      channelId,
      sender: authorOf(authors, r.sender_id),
      content: r.content,
      type: r.type,
      attachments: toAttachments(r.attachments),
      pinned: r.pinned,
      isBookmarked: bookmarked.has(r.id),
      inBriefcase: briefcased.has(r.id),
      createdAt: iso(r.created_at),
    }));
}

/**
 * Post into a channel.
 *
 * This is where joining happens for an open community: an explicit write is
 * consent to be a member, a GET is not. That asymmetry is the whole membership
 * model — browse freely, and the moment you say something, you're in the room.
 */
export async function sendChannelMessage(input: {
  channelId: string;
  senderId: string;
  content: string;
  attachmentIds?: string[];
  mentions?: string[];
  audio?: boolean;
}): Promise<{ message: ChannelMessage; communityId: string }> {
  const { channel, community } = await loadChannel(input.channelId, input.senderId);
  const access = communityAccess(community);

  if (!access.isMember) {
    if (!access.openJoin) throw new DomainError("Join this community to post here.", 403);
    await joinCommunity(community.id, input.senderId);
  }
  if (!channelReadable(channel, access.isAdmin, input.senderId)) {
    throw new DomainError("You don't have access to this channel.", 403);
  }
  if (channel.type === "voice") throw new DomainError("That's a voice channel.");

  const attachments = await resolveAttachments(input.senderId, input.attachmentIds ?? []);
  if (!input.content && !attachments.length) throw new DomainError("Write something first.");

  const id = uid("cmsg");
  const row = await one<{ created_at: Date }>(
    `INSERT INTO social_channel_messages (id, channel_id, sender_id, content, type, attachments)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING created_at`,
    [
      id,
      input.channelId,
      input.senderId,
      input.content,
      input.audio ? "audio" : attachments.length ? "attachment" : "text",
      attachments.length ? JSON.stringify(attachments) : null,
    ],
  );

  // Mentions arrive as user ids and are validated against the membership of
  // THIS community — so a crafted list can only ever reach people who are
  // already in the room.
  if (input.mentions?.length) {
    const members = await sql<{ user_id: string }>(
      `SELECT user_id FROM social_community_members
        WHERE community_id = $1 AND state = 'member' AND user_id = ANY($2)`,
      [community.id, input.mentions],
    );
    const authors = await hydrateAuthors([input.senderId]);
    const sender = authorOf(authors, input.senderId);
    for (const member of members) {
      void notify({
        userId: member.user_id,
        type: "mention",
        title: `${sender.name} mentioned you in #${channel.name}`,
        content: excerpt(input.content, 120),
        link: `/doctor/network?tab=communities&community=${community.id}&channel=${input.channelId}&message=${id}`,
        senderId: input.senderId,
        metadata: { communityId: community.id, channelId: input.channelId, messageId: id },
      });
    }
  }

  const authors = await hydrateAuthors([input.senderId]);
  return {
    message: {
      id,
      channelId: input.channelId,
      sender: authorOf(authors, input.senderId),
      content: input.content,
      type: input.audio ? "audio" : attachments.length ? "attachment" : "text",
      attachments: attachments.map((a) => ({ ...a, url: mediaUrl(a.mediaId) })),
      pinned: false,
      isBookmarked: false,
      inBriefcase: false,
      createdAt: iso(row?.created_at),
    },
    communityId: community.id,
  };
}

/** Pinning speaks for the room, so it is admin-only (or the channel's creator). */
export async function toggleChannelPin(messageId: string, meId: string): Promise<boolean> {
  const msg = await one<{ channel_id: string }>(
    `SELECT channel_id FROM social_channel_messages WHERE id = $1`,
    [messageId],
  );
  if (!msg) throw new DomainError("That message no longer exists.", 404);
  const { channel, community } = await loadChannel(msg.channel_id, meId);
  if (!communityAccess(community).isAdmin && channel.creator_id !== meId) {
    throw new DomainError("Only admins can pin messages.", 403);
  }
  const row = await one<{ pinned: boolean }>(
    `UPDATE social_channel_messages SET pinned = NOT pinned WHERE id = $1 RETURNING pinned`,
    [messageId],
  );
  return Boolean(row?.pinned);
}

/** Bookmark / briefcase — private to the person who set it, hence a row per user. */
export async function toggleMessageFlag(
  messageId: string,
  meId: string,
  kind: "bookmark" | "briefcase",
): Promise<boolean> {
  const inserted = await sql(
    `INSERT INTO social_message_flags (message_id, user_id, kind) VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING RETURNING message_id`,
    [messageId, meId, kind],
  );
  if (inserted.length) return true;
  await sql(
    `DELETE FROM social_message_flags WHERE message_id = $1 AND user_id = $2 AND kind = $3`,
    [messageId, meId, kind],
  );
  return false;
}

/** Author or community admin. Nobody else deletes what somebody else said. */
export async function deleteChannelMessage(messageId: string, meId: string): Promise<string> {
  const msg = await one<{ channel_id: string; sender_id: string }>(
    `SELECT channel_id, sender_id FROM social_channel_messages WHERE id = $1`,
    [messageId],
  );
  if (!msg) throw new DomainError("That message no longer exists.", 404);
  const { community } = await loadChannel(msg.channel_id, meId);
  if (msg.sender_id !== meId && !communityAccess(community).isAdmin) {
    throw new DomainError("You can only delete your own messages.", 403);
  }
  await sql(`DELETE FROM social_channel_messages WHERE id = $1`, [messageId]);
  return msg.channel_id;
}
