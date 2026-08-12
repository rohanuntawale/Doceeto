import { NextResponse } from "next/server";
import { isError, requireSocial, toErrorResponse } from "@/lib/social/guard";
import * as social from "@/lib/social/repo";
import * as chat from "@/lib/social/chat-repo";
import { NOTIFICATION_PAGE_SIZE } from "@/lib/social/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The network's single READ endpoint: `/api/social?entity=…`.
 *
 * One route rather than the twenty-odd REST paths this module was specified
 * with, because that is how the rest of this app reads (see /api/data). The
 * behaviour is identical — same scoping, same shapes — and keeping the
 * convention means one place to add an authorization check and one place to
 * look when a response is wrong.
 *
 * Authorization is enforced HERE and in the repo, never by the client asking
 * nicely. Every entity below either scopes to the caller or hands the caller's
 * id to a repo function that does.
 */
export async function GET(req: Request) {
  const caller = await requireSocial(req);
  if (isError(caller)) return caller.error;
  const { me } = caller;

  const params = new URL(req.url).searchParams;
  const entity = params.get("entity");
  const str = (key: string) => params.get(key) ?? "";

  try {
    switch (entity) {
      /**
       * A page of the feed. The reader's own state (liked, bookmarked, their
       * poll choice) is attached server-side; the four tabs are then ordered
       * client-side by lib/social/ranking.ts over this page.
       */
      case "feed":
        return NextResponse.json(
          await social.listFeed({
            viewerId: me,
            cursor: params.get("cursor"),
            authorId: params.get("authorId"),
          }),
        );

      /** One post — backs permalinks and every notification deep link. */
      case "post": {
        const post = await social.getPost(str("postId"), me);
        if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
        return NextResponse.json(post);
      }

      case "saved":
        return NextResponse.json(await social.listSaved(me));

      case "comments":
        return NextResponse.json(await social.listComments(str("postId"), me));

      case "stories":
        return NextResponse.json(await social.listStories(me));

      case "notifications":
        return NextResponse.json(await social.listNotifications(me, NOTIFICATION_PAGE_SIZE));

      // ── Follow graph ────────────────────────────────────
      case "followStatus":
        return NextResponse.json(await social.followStatus(me, str("userId")));

      case "followCounts":
        return NextResponse.json(await social.followCounts(str("userId") || me));

      case "following":
        return NextResponse.json(await social.listGraph(str("userId") || me, "following", me));

      case "followers":
        return NextResponse.json(await social.listGraph(str("userId") || me, "followers", me));

      case "suggestions":
        return NextResponse.json(await social.suggestPeople(me));

      /**
       * People search. Returns `{ people, total }` — the total is not
       * decoration: a bare page with no count reads as "that's everyone",
       * which is a claim the interface has no way to check.
       */
      case "searchPeople": {
        const q = str("q").trim();
        if (q.length < 2) return NextResponse.json({ people: [], total: 0 });
        // Search RESULTS are where a search appearance is recorded — measured
        // at the server chokepoint rather than trusted from the client.
        const result = await social.searchPeople(me, q);
        void social.recordEvents(
          "search_appearance",
          me,
          result.people.map((p) => ({ ownerId: p.id })),
        );
        return NextResponse.json(result);
      }

      case "blocked":
        return NextResponse.json(await social.listBlocked(me));

      case "reports":
        return NextResponse.json(await social.myReports(me));

      // ── Direct messaging ────────────────────────────────
      case "conversations":
        return NextResponse.json(await chat.listConversations(me));

      case "messages":
        return NextResponse.json(
          await chat.listMessages(str("conversationId"), me, params.get("before")),
        );

      case "messageable":
        return NextResponse.json(await chat.messageableUsers(me));

      // ── Communities ─────────────────────────────────────
      case "communities":
        return NextResponse.json(await chat.listCommunities(me));

      case "communityMembers":
        return NextResponse.json(await chat.listCommunityMembers(str("communityId"), me));

      case "channels":
        return NextResponse.json(await chat.listChannels(str("communityId"), me));

      case "channelMessages":
        return NextResponse.json(
          await chat.listChannelMessages(str("channelId"), me, params.get("pinned") === "1"),
        );

      // ── Engagement ──────────────────────────────────────
      /** Always your own. There is no parameter to read someone else's. */
      case "engagement":
        return NextResponse.json(await social.engagementSummary(me));

      default:
        return NextResponse.json({ error: "Unknown entity." }, { status: 400 });
    }
  } catch (err) {
    return toErrorResponse(err, `read (entity=${entity})`);
  }
}
