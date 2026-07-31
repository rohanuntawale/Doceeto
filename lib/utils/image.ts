/**
 * Client-side photo preparation for profile pictures.
 *
 * The whole pipeline runs in the browser so what leaves the device is already
 * tiny: any camera-roll original (10MB, sideways, HEIC-ish) becomes a square
 * 256px JPEG data-URL of a few tens of KB — small enough to live in the user's
 * database row, which is the entire storage story (no bucket, no CDN).
 */

const AVATAR_SIZE = 256;
const JPEG_QUALITY = 0.85;

/** Read, centre-crop and downscale an image file into an avatar data-URL. */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Pick an image file (JPEG, PNG or WebP).");
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file couldn't be read as an image."));
      el.src = url;
    });

    // Centre-crop to a square, then scale down. Never scale UP a tiny image —
    // a 100px source stays 100px rather than becoming 256px of blur.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(AVATAR_SIZE, side);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process the image in this browser.");
    // JPEG has no alpha — a transparent PNG would otherwise composite on black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}
