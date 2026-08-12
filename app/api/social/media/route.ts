import { NextResponse } from "next/server";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";
import { isError, requireSocial, toErrorResponse } from "@/lib/social/guard";
import { putMedia } from "@/lib/social/repo";
import { UPLOAD_LIMITS, formatBytes, mediaKindOf } from "@/lib/social/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upload one file and get back an id.
 *
 * Uploads are SEPARATE from the write that references them, which is what
 * keeps posting fast and resumable: the composer uploads each attachment while
 * the author is still typing, and "Post" then sends a few ids and returns
 * immediately. It also means an abandoned draft leaves an unreferenced row
 * rather than a half-written post.
 *
 * Multipart via the platform's own `formData()` — no upload middleware, no
 * temp files, no disk. The bytes go straight into Postgres (see the note on
 * social_media in lib/social/schema.sql).
 */
export async function POST(req: Request) {
  const caller = await requireSocial(req);
  if (isError(caller)) return caller.error;
  const { me } = caller;

  if (!rateLimit(`social:upload:${me}`, 40, 10 * 60_000)) return tooMany();

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was sent." }, { status: 400 });
    }

    // The MIME type decides the bucket, and it is ALLOWLISTED — an unknown
    // type is refused rather than filed as an image, so nothing arrives that
    // the app has no way to render and no reason to store.
    const kind = mediaKindOf(file.type);
    if (!kind) {
      return NextResponse.json(
        { error: "That file type isn't supported here." },
        { status: 400 },
      );
    }

    const limit = UPLOAD_LIMITS[kind];
    // Checked against the declared size first (cheap, and rejects before
    // reading), then against what actually arrived — a lying Content-Length
    // must not get a free pass into the row.
    if (file.size > limit) {
      return NextResponse.json(
        { error: `That ${kind} is too large. The limit is ${formatBytes(limit)}.` },
        { status: 413 },
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > limit) {
      return NextResponse.json(
        { error: `That ${kind} is too large. The limit is ${formatBytes(limit)}.` },
        { status: 413 },
      );
    }

    const media = await putMedia({
      ownerId: me,
      mime: file.type,
      kind,
      // Only kept where it is shown — a document chip renders the filename and
      // downloads as it. Sliced, because it is attacker-controlled text.
      fileName: kind === "document" ? file.name.slice(0, 120) : null,
      bytes,
    });
    return NextResponse.json(media);
  } catch (err) {
    return toErrorResponse(err, "upload");
  }
}
