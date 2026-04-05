import imageCompression from "browser-image-compression";
import exifr from "exifr";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  CONTENT_MAX_IMAGE_DIMENSION,
  CONTENT_THUMBNAIL_DIMENSION,
} from "@/lib/validations/content";

export interface ExifData {
  latitude: number | null;
  longitude: number | null;
  exifDate: string | null;
}

export interface UploadResult {
  mediaUrl: string;
  thumbnailUrl: string | null;
  exif: ExifData;
}

/**
 * Extract EXIF data from an image file.
 * Returns GPS coordinates and date if available.
 * Never throws — returns nulls on failure.
 */
export async function extractExif(file: File): Promise<ExifData> {
  try {
    const exif = await exifr.parse(file, {
      gps: true,
      pick: ["DateTimeOriginal", "latitude", "longitude"],
    });
    if (exif) {
      return {
        latitude:
          exif.latitude != null && exif.longitude != null
            ? exif.latitude
            : null,
        longitude:
          exif.latitude != null && exif.longitude != null
            ? exif.longitude
            : null,
        exifDate:
          exif.DateTimeOriginal instanceof Date
            ? exif.DateTimeOriginal.toISOString()
            : null,
      };
    }
  } catch {
    // EXIF read failed — continue without data
  }
  return { latitude: null, longitude: null, exifDate: null };
}

/**
 * Compress an image to full size (max 1920px, 1MB) and generate a thumbnail (400px).
 * Returns both blobs.
 */
export async function compressImage(
  file: File
): Promise<{ full: Blob; thumbnail: Blob }> {
  const full = await imageCompression(file, {
    maxWidthOrHeight: CONTENT_MAX_IMAGE_DIMENSION,
    maxSizeMB: 1,
    useWebWorker: true,
    fileType: "image/jpeg",
  });

  const thumbnail = await imageCompression(file, {
    maxWidthOrHeight: CONTENT_THUMBNAIL_DIMENSION,
    maxSizeMB: 0.1,
    useWebWorker: true,
    fileType: "image/jpeg",
  });

  return { full, thumbnail };
}

/**
 * Upload a full image and thumbnail to Supabase Storage.
 * Returns the public URLs.
 *
 * @param onProgress - Optional callback (0-100) for upload progress indication.
 */
export async function uploadImageToStorage(
  eventId: string,
  userId: string,
  full: Blob,
  thumbnail: Blob,
  onProgress?: (percent: number) => void
): Promise<{ mediaUrl: string; thumbnailUrl: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().slice(0, 8);
  const basePath = `${eventId}/${userId}/${timestamp}-${randomId}`;
  const fullPath = `${basePath}-full.jpg`;
  const thumbPath = `${basePath}-thumb.jpg`;

  onProgress?.(10);

  // Upload full image
  const { error: fullError } = await supabase.storage
    .from("media")
    .upload(fullPath, full, {
      contentType: "image/jpeg",
      cacheControl: "3600",
    });

  if (fullError) {
    throw new Error(`Upload fehlgeschlagen: ${fullError.message}`);
  }

  onProgress?.(60);

  // Upload thumbnail
  let thumbnailUrl: string | null = null;
  const { error: thumbError } = await supabase.storage
    .from("media")
    .upload(thumbPath, thumbnail, {
      contentType: "image/jpeg",
      cacheControl: "3600",
    });

  onProgress?.(85);

  if (!thumbError) {
    const { data: thumbUrlData } = supabase.storage
      .from("media")
      .getPublicUrl(thumbPath);
    thumbnailUrl = thumbUrlData.publicUrl;
  }

  const { data: fullUrlData } = supabase.storage
    .from("media")
    .getPublicUrl(fullPath);

  onProgress?.(100);

  return {
    mediaUrl: fullUrlData.publicUrl,
    thumbnailUrl,
  };
}

/**
 * Full pipeline: extract EXIF, compress, upload, return all data.
 */
export async function processAndUploadImage(
  file: File,
  eventId: string,
  userId: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  onProgress?.(0);

  // Step 1: Extract EXIF before compression (compression strips EXIF)
  const exif = await extractExif(file);
  onProgress?.(5);

  // Step 2: Compress
  const { full, thumbnail } = await compressImage(file);
  onProgress?.(30);

  // Step 3: Upload
  const { mediaUrl, thumbnailUrl } = await uploadImageToStorage(
    eventId,
    userId,
    full,
    thumbnail,
    (p) => onProgress?.(30 + Math.round(p * 0.7))
  );

  return { mediaUrl, thumbnailUrl, exif };
}
