import { NextResponse } from "next/server";
import { emitChange } from "@/lib/server/events";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";
import { isError, requireSocial, toErrorResponse } from "@/lib/social/guard";
import * as social from "@/lib/social/repo";
import * as chat from "@/lib/social/chat-repo";
import { PROFANITY_MESSAGE, containsProfanity } from "@/lib/social/profanity";
import {
  COMMENT_MAX,
  COMMUNITY_DESC_MAX,
  COMMUNITY_NAME_MAX,
  CHANNEL_NAME_MAX,
  MAX_ATTACHMENTS,
  MAX_IMAGES,
  MESSAGE_MAX,
  POST_MAX,
  REPORT_DETAILS_MAX,
  REPORT_REASON_MAX,
  REPORT_TARGETS,
  STORY_CAPTION_MAX,
  clean,
  excerpt,
  extractTags,
  isCuratedName,
  sanitizeMilestone,
  sanitizePoll,
} from "@/lib/social/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The network's single WRITE endpoint: `POST /api/social/actions` with
 * `{ action, payload }`. Mirrors /api/actions, which is how everything else in
 * this app writes.
 *
 * Three things happen on every successful write, in this order:
 *
 *   1. The caller's permission is re-checked SERVER-SIDE — in the repo, from
 *      the membership and ownership tables, never from the payload.
 *   2. `emitChange` names the query keys that just went stale, so every
 *      connected client refreshes over SSE instead of waiting for its poll.
 *   3. Anything with a person on the other end of it (a like, a comment, an
 *      invite, a mention) queues a notification, best-effort.
 *
 * The content filter runs on EVERY path that stores something a person typed —
 * posts, comments, direct messages and channel messages — before it is
 * persisted, not after.
 */

/** The query keys the client uses; see lib/hooks/social.ts. */
const KEYS = {
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

export async function POST(req: Request) {
  const caller = await requireSocial(req);
  if (isError(caller)) return caller.error;
  const { me } = caller;

  let body: { action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const action = String(body.action ?? "");
  const payload = body.payload ?? {};

  const str = (key: string, cap = 200) => clean(payload[key], cap);
  const id = (key: string) => String(payload[key] ?? "").slice(0, 200);
  const bool = (key: string) => payload[key] === true;
  const ids = (key: string, cap: number): string[] =>
    Array.isArray(payload[key])
      ? (payload[key] as unknown[]).map((x) => String(x)).slice(0, cap)
      : [];
  const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

  /** Emit the stale keys and answer. */
  const done = (result: unknown, entities: string[]) => {
    emitChange(entities);
    return NextResponse.json(result ?? { ok: true });
  };

  /** Refuse anything the guidelines don't allow, before it is stored. */
  const clean_ = (text: string) => {
    if (containsProfanity(text)) throw Object.assign(new Error(PROFANITY_MESSAGE), { soft: true });
    return text;
  };

  try {
    switch (action) {
      // ── Feed ──────────────────────────────────────────
      case "createPost": {
        // Bursts are what a scripted client looks like; a person writing posts
        // does not produce twelve in five minutes.
        if (!rateLimit(`social:post:${me}`, 12, 5 * 60_000)) return tooMany();
        const content = clean_(str("content", POST_MAX));
        const post = await social.createPost({
          authorId: me,
          content,
          imageIds: ids("imageIds", MAX_IMAGES),
          videoId: id("videoId") || null,
          documentId: id("documentId") || null,
          poll: sanitizePoll(payload.poll),
          milestone: sanitizeMilestone(payload.milestone),
          specialty: str("specialty", 60) || null,
          tags: extractTags(content, payload.tags),
        });
        return done(post, [KEYS.feed]);
      }

      case "deletePost":
        await social.deletePost(id("postId"), me);
        return done({ ok: true }, [KEYS.feed]);

      case "toggleLike": {
        const result = await social.toggleLike(id("postId"), me);
        if (result.liked) {
          void social.notify({
            userId: result.authorId,
            type: "like",
            title: "Someone liked your post",
            link: `/doctor/network?post=${id("postId")}`,
            senderId: me,
            metadata: { postId: id("postId") },
          });
        }
        return done(result, [KEYS.feed, KEYS.post, KEYS.notifications]);
      }

      case "addComment": {
        if (!rateLimit(`social:comment:${me}`, 30, 5 * 60_000)) return tooMany();
        const text = clean_(str("text", COMMENT_MAX));
        if (!text) return bad("Write a comment first.");
        const result = await social.addComment(id("postId"), me, text);
        void social.notify({
          userId: result.postAuthorId,
          type: "comment",
          title: "New comment on your post",
          // A 30-character excerpt: enough to recognise which conversation
          // this is, not enough to be the whole comment in a push banner.
          content: excerpt(text, 30),
          link: `/doctor/network?post=${id("postId")}`,
          senderId: me,
          metadata: { postId: id("postId") },
        });
        return done(result, [KEYS.feed, KEYS.post, KEYS.notifications]);
      }

      case "sharePost":
        return done({ shareCount: await social.sharePost(id("postId")) }, [KEYS.feed, KEYS.post]);

      case "toggleSave":
        return done({ isBookmarked: await social.toggleSave(id("postId"), me) }, [
          KEYS.feed,
          KEYS.post,
        ]);

      case "votePoll":
        return done(await social.votePoll(id("postId"), me, Number(payload.optionIndex)), [
          KEYS.feed,
          KEYS.post,
        ]);

      // ── Stories ───────────────────────────────────────
      case "createStory":
        await social.createStory({
          authorId: me,
          mediaId: id("mediaId"),
          content: clean_(str("content", STORY_CAPTION_MAX)),
        });
        return done({ ok: true }, [KEYS.stories]);

      // ── Follow graph & blocking ───────────────────────
      case "setFollow": {
        const target = id("userId");
        const follow = bool("follow");
        await social.setFollow(me, target, follow);
        if (follow) {
          void social.notify({
            userId: target,
            type: "follow",
            title: "You have a new follower",
            link: `/doctor/network?tab=people`,
            senderId: me,
          });
        }
        // Following changes the Following tab AND who you can message.
        return done({ ok: true }, [KEYS.graph, KEYS.feed, KEYS.notifications, KEYS.conversations]);
      }

      case "setBlock":
        await social.setBlock(me, id("userId"), bool("blocked"));
        // A block reaches into almost everything — sever the graph, hide the
        // posts, drop the thread from both lists.
        return done({ ok: true }, [
          KEYS.graph,
          KEYS.feed,
          KEYS.stories,
          KEYS.conversations,
          KEYS.moderation,
        ]);

      case "report": {
        const targetType = str("targetType", 40);
        if (!REPORT_TARGETS.has(targetType)) return bad("That can't be reported.");
        await social.createReport({
          reporterId: me,
          targetType,
          targetId: id("targetId"),
          reason: str("reason", REPORT_REASON_MAX) || "Not specified",
          details: str("details", REPORT_DETAILS_MAX),
        });
        return done({ ok: true }, [KEYS.moderation]);
      }

      // ── Notifications ─────────────────────────────────
      case "markNotifications":
        await social.markNotificationsRead(me, id("notificationId") || undefined);
        return done({ ok: true }, [KEYS.notifications]);

      // ── Direct messaging ──────────────────────────────
      case "startConversation": {
        const result = await chat.getOrCreateConversation(me, id("userId"), str("source", 40));
        return done(result, [KEYS.conversations]);
      }

      case "sendMessage": {
        if (!rateLimit(`social:dm:${me}`, 60, 60_000)) return tooMany();
        const content = clean_(str("content", MESSAGE_MAX));
        const result = await chat.sendMessage({
          conversationId: id("conversationId"),
          senderId: me,
          content,
          attachmentIds: ids("attachmentIds", MAX_ATTACHMENTS),
        });
        return done(result.message, [KEYS.messages, KEYS.conversations, KEYS.notifications]);
      }

      case "markConversationRead":
        await chat.markConversationRead(id("conversationId"), me);
        return done({ ok: true }, [KEYS.conversations]);

      case "setConversationFlag": {
        const flag = str("flag", 20);
        if (flag !== "archived" && flag !== "pinned") return bad("Unknown flag.");
        await chat.setConversationFlag(id("conversationId"), me, flag, bool("value"));
        return done({ ok: true }, [KEYS.conversations]);
      }

      case "deleteConversation":
        await chat.deleteConversation(id("conversationId"), me);
        return done({ ok: true }, [KEYS.conversations, KEYS.messages]);

      // ── Communities ───────────────────────────────────
      case "createCommunity": {
        const name = clean_(str("name", COMMUNITY_NAME_MAX));
        if (!name) return bad("Give the community a name.");
        // Curated names are the platform's own. Letting someone claim one
        // would hand them creator rights over a core room.
        if (isCuratedName(name)) return bad("That name is reserved.");
        const community = await chat.createCommunity({
          creatorId: me,
          name,
          description: clean_(str("description", COMMUNITY_DESC_MAX)),
          visibility: str("visibility", 10) === "private" ? "private" : "public",
          joinPolicy: str("joinPolicy", 10) === "request" ? "request" : "open",
        });
        return done(community, [KEYS.communities]);
      }

      case "deleteCommunity":
        await chat.deleteCommunity(id("communityId"), me);
        return done({ ok: true }, [KEYS.communities]);

      case "joinCommunity":
        return done(await chat.joinCommunity(id("communityId"), me), [
          KEYS.communities,
          KEYS.notifications,
        ]);

      case "leaveCommunity":
        await chat.leaveCommunity(id("communityId"), me);
        return done({ ok: true }, [KEYS.communities]);

      case "handleJoinRequest":
        await chat.handleJoinRequest(
          id("communityId"),
          me,
          id("userId"),
          str("action", 10) === "reject" ? "reject" : "approve",
        );
        return done({ ok: true }, [KEYS.communities, KEYS.notifications]);

      case "inviteToCommunity":
        await chat.inviteToCommunity(id("communityId"), me, id("userId"));
        return done({ ok: true }, [KEYS.communities, KEYS.notifications]);

      case "respondToInvite":
        await chat.respondToInvite(
          id("inviteId"),
          me,
          str("response", 10) === "decline" ? "decline" : "accept",
        );
        return done({ ok: true }, [KEYS.communities, KEYS.notifications]);

      // ── Channels ──────────────────────────────────────
      case "createChannel": {
        const name = clean_(str("name", CHANNEL_NAME_MAX))
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        if (!name) return bad("Give the channel a name.");
        const channel = await chat.createChannel({
          communityId: id("communityId"),
          meId: me,
          name,
          type: str("type", 10) === "voice" ? "voice" : "text",
          description: clean_(str("description", COMMUNITY_DESC_MAX)),
          visibility: str("visibility", 10) === "private" ? "private" : "public",
        });
        return done(channel, [KEYS.channels]);
      }

      case "requestChannelAccess":
        await chat.requestChannelAccess(id("channelId"), me);
        return done({ ok: true }, [KEYS.channels]);

      case "handleChannelRequest":
        await chat.handleChannelRequest(
          id("channelId"),
          me,
          id("userId"),
          str("action", 10) === "reject" ? "reject" : "approve",
        );
        return done({ ok: true }, [KEYS.channels]);

      case "sendChannelMessage": {
        if (!rateLimit(`social:channel:${me}`, 60, 60_000)) return tooMany();
        const result = await chat.sendChannelMessage({
          channelId: id("channelId"),
          senderId: me,
          content: clean_(str("content", MESSAGE_MAX)),
          attachmentIds: ids("attachmentIds", MAX_ATTACHMENTS),
          // Ids, validated against the community roster in the repo — never
          // matched from "@Name" in the text.
          mentions: ids("mentions", 20),
          audio: bool("audio"),
        });
        return done(result.message, [
          KEYS.channelMessages,
          KEYS.communities,
          KEYS.notifications,
        ]);
      }

      case "toggleChannelPin":
        return done({ pinned: await chat.toggleChannelPin(id("messageId"), me) }, [
          KEYS.channelMessages,
        ]);

      case "toggleMessageFlag": {
        const kind = str("kind", 20);
        if (kind !== "bookmark" && kind !== "briefcase") return bad("Unknown flag.");
        return done({ on: await chat.toggleMessageFlag(id("messageId"), me, kind) }, [
          KEYS.channelMessages,
        ]);
      }

      case "deleteChannelMessage":
        await chat.deleteChannelMessage(id("messageId"), me);
        return done({ ok: true }, [KEYS.channelMessages]);

      // ── Engagement ────────────────────────────────────
      /**
       * Recorded from the client, but only as a fallback and only for things
       * the server cannot see: which posts actually crossed 50% of the
       * viewport. Profile views are recorded at the server chokepoint below;
       * search appearances at the search endpoint.
       *
       * An impression credits the post's AUTHOR, resolved server-side — the
       * client says which posts it saw, never whose they were.
       */
      case "recordImpressions": {
        const postIds = ids("postIds", 200);
        const owners = await social.ownersOfPosts(postIds);
        void social.recordEvents("post_impression", me, owners);
        // Deliberately no emitChange: analytics must never cause a refetch
        // storm on the surface being measured.
        return NextResponse.json({ ok: true });
      }

      case "recordProfileView":
        void social.recordEvents("profile_view", me, [{ ownerId: id("userId") }]);
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    // The content filter's rejection is a 400 with the guidelines message, not
    // a 500 — it is an expected answer, not a fault.
    if ((err as { soft?: boolean })?.soft) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    return toErrorResponse(err, `action (${action})`);
  }
}
