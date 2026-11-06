/**
 * Browser-side image preparation. Supabase image transformations are a paid
 * feature, so we resize and re-encode before upload: smaller files mean faster
 * question loads on student phones and less free-tier egress.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // what we accept from the teacher
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // bucket limit after compression
export const MAX_DIMENSION = 1280;

export type PreparedImage = { blob: Blob; extension: 'webp' | 'jpg' | 'gif'; width: number; height: number };

export class ImageValidationError extends Error {}

/** Scales (width, height) to fit inside `max` × `max`, never upscaling. */
export function fitWithin(width: number, height: number, max = MAX_DIMENSION): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function validateSourceImage(file: File): void {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageValidationError('Use a JPG, PNG, WebP or GIF image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageValidationError('That image is larger than 10 MB. Choose a smaller one.');
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  validateSourceImage(file);

  // Keep GIFs as-is (re-encoding would drop animation) if they are small enough.
  if (file.type === 'image/gif') {
    if (file.size > MAX_UPLOAD_BYTES) throw new ImageValidationError('GIFs must be under 2 MB.');
    const bitmap = await createImageBitmap(file);
    const result = { blob: file, extension: 'gif' as const, width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return result;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageValidationError('This image could not be read. Try another file.');
  }
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageValidationError('Your browser could not process this image.');
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  // WebP first; browsers without WebP encoding fall back to PNG from toBlob, so check the type.
  for (const quality of [0.82, 0.7, 0.55]) {
    const webp = await canvasToBlob(canvas, 'image/webp', quality);
    if (webp && webp.type === 'image/webp' && webp.size <= MAX_UPLOAD_BYTES) {
      return { blob: webp, extension: 'webp', ...size };
    }
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (jpeg && jpeg.size <= MAX_UPLOAD_BYTES && (!webp || webp.type !== 'image/webp')) {
      return { blob: jpeg, extension: 'jpg', ...size };
    }
  }
  throw new ImageValidationError('This image is too detailed to compress under 2 MB. Try a smaller image.');
}
