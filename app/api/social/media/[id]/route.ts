import { NextResponse } from "next/server";
import { isError, requireSocial } from "@/lib/social/guard";
import { getMedia } from "@/lib/social/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve an uploaded file.
 *
 * SIGNED IN, NOT PUBLIC. The module this was ported from used public-read
 * buckets, where the URL is the only credential. Here the bytes live in the
 * database behind the same session check as everything else — so a photo
 * attached to a case discussion cannot be handed around outside the app by
 * pasting a link, and revoking someone's account revokes their access to it.
 *
 * IMMUTABLE CACHING. Ids are random and a row is never overwritten, so the URL
 * can only ever mean one file. `immutable` with a year's max-age means an
 * avatar or a feed image is fetched once per browser, ever — which is what
 * makes storing bytes in Postgres affordable at all. `private` keeps it out of
 * shared proxy caches, since the response is behind a session.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const caller = await requireSocial(req);
  if (isError(caller)) return caller.error;

  const media = await getMedia(params.id);
  if (!media) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return new Response(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.mime,
      "Content-Length": String(media.bytes.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      // Documents download under their own name rather than rendering. Only
      // images, video and audio are ever shown inline, and the upload
      // allowlist excludes SVG for exactly this reason — an SVG served inline
      // from this origin is a script running with the app's cookies.
      "Content-Disposition":
        media.kind === "document"
          ? `attachment; filename="${encodeURIComponent(media.fileName ?? "file")}"`
          : "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
