/**
 * Client-side profile photo processing (browser-native APIs only, no new
 * dependencies — same seam as the rest of the mock layer).
 *
 * Validation never trusts the file extension, the `accept` attribute or the
 * reported MIME type alone: the file is really decoded with
 * createImageBitmap and both dimensions must fall inside the accepted range.
 * The image is then center-cropped to a square, scaled to 256×256 and
 * re-encoded as JPEG, walking a quality ladder until the decoded output fits
 * the size cap. The produced data URL is exactly what the preview shows and
 * what the mock API receives; no image data ever leaves the browser.
 */

export const AVATAR_MAX_ORIGINAL_BYTES = 2 * 1024 * 1024; // 2 MiB
export const AVATAR_MIN_DIMENSION = 64;
export const AVATAR_MAX_DIMENSION = 4096;
export const AVATAR_OUTPUT_SIZE = 256;
export const AVATAR_MAX_OUTPUT_BYTES = 150 * 1024; // 150 KiB decoded JPEG

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** JPEG quality ladder for the 256×256 re-encode; the first entry whose
 *  output fits the cap wins. 256×256 photos land far below the cap in
 *  practice — the tail entries only matter for pathological images. */
const QUALITY_LADDER = [0.9, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5];

/** Thrown for every rejectable photo; the message is user-facing. */
export class AvatarImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarImageError';
  }
}

/**
 * Validates and processes one selected photo into a JPEG data URL.
 * Throws AvatarImageError with an actionable message when rejected; the
 * decoded bitmap is always released, including on rejection.
 */
export async function processAvatarFile(file: File): Promise<string> {
  if (file.size === 0) {
    throw new AvatarImageError('That file is empty. Choose a photo with image content.');
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new AvatarImageError('Unsupported format. Choose a JPEG, PNG or WebP image.');
  }
  if (file.size > AVATAR_MAX_ORIGINAL_BYTES) {
    throw new AvatarImageError('That photo is larger than 2 MiB. Choose a smaller file.');
  }

  // Real decode: a renamed, truncated or malformed file fails here no
  // matter what its name or reported type says.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarImageError(
      'That image could not be read. The file may be corrupted — try another photo.',
    );
  }

  try {
    const { width, height } = bitmap;
    if (width < AVATAR_MIN_DIMENSION || height < AVATAR_MIN_DIMENSION) {
      throw new AvatarImageError(
        `That image is too small (${width}×${height}). Photos need to be at least 64×64 pixels.`,
      );
    }
    if (width > AVATAR_MAX_DIMENSION || height > AVATAR_MAX_DIMENSION) {
      throw new AvatarImageError(
        `That image is too large (${width}×${height}). Photos need to be at most 4096×4096 pixels.`,
      );
    }
    return encodeSquare(bitmap, width, height);
  } finally {
    // Release the decoded bitmap on every path (success, reject, error).
    bitmap.close();
  }
}

/** Center-crops to a square, scales to 256×256 and re-encodes as JPEG. */
function encodeSquare(bitmap: ImageBitmap, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new AvatarImageError('This browser could not process the photo. Please try again.');
  }
  const side = Math.min(width, height);
  const sx = (width - side) / 2;
  const sy = (height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);

  for (const quality of QUALITY_LADDER) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrlByteLength(dataUrl) <= AVATAR_MAX_OUTPUT_BYTES) return dataUrl;
  }
  throw new AvatarImageError(
    'That photo could not be compressed small enough. Try a simpler image.',
  );
}

/** Decoded byte size of a `data:…;base64,` URL (padding-aware). */
function dataUrlByteLength(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
