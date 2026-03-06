import imageCompression from "browser-image-compression";
import exifr from "exifr";
import { createClient } from "@supabase/supabase-js";
import type { Photo } from "./types";

// Client-side Supabase instance for Storage uploads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

interface UploadOptions {
  file: File;
  tourId: string;
  caption: string | null;
  authorName: string;
}

/**
 * Compress an image, read EXIF data, upload to Supabase Storage,
 * and save metadata via the API route.
 */
export async function compressAndUploadPhoto({
  file,
  tourId,
  caption,
  authorName,
}: UploadOptions): Promise<Photo> {
  // 1. Read EXIF data before compression (compression may strip EXIF)
  let gpsLat: number | null = null;
  let gpsLng: number | null = null;
  let takenAt: string | null = null;

  try {
    const exif = await exifr.parse(file, {
      gps: true,
      pick: ["DateTimeOriginal", "latitude", "longitude"],
    });
    if (exif) {
      if (exif.latitude != null && exif.longitude != null) {
        gpsLat = exif.latitude;
        gpsLng = exif.longitude;
      }
      if (exif.DateTimeOriginal instanceof Date) {
        takenAt = exif.DateTimeOriginal.toISOString();
      }
    }
  } catch {
    // EXIF read failed -- continue without GPS/date
  }

  // 2. Compress the image (max 1920px wide, max 1MB for full, 400px for thumbnail)
  const fullImage = await imageCompression(file, {
    maxWidthOrHeight: 1920,
    maxSizeMB: 1,
    useWebWorker: true,
    fileType: "image/jpeg",
  });

  const thumbnailImage = await imageCompression(file, {
    maxWidthOrHeight: 400,
    maxSizeMB: 0.1,
    useWebWorker: true,
    fileType: "image/jpeg",
  });

  // 3. Get image dimensions from the compressed full image
  const dimensions = await getImageDimensions(fullImage);

  // 4. Generate unique file paths
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);
  const basePath = `${tourId}/${timestamp}-${randomId}`;
  const fullPath = `${basePath}-full.jpg`;
  const thumbPath = `${basePath}-thumb.jpg`;

  // 5. Upload full image to Supabase Storage
  const { error: fullError } = await supabaseClient.storage
    .from("photos")
    .upload(fullPath, fullImage, {
      contentType: "image/jpeg",
      cacheControl: "3600",
    });

  if (fullError) {
    throw new Error(`Upload fehlgeschlagen: ${fullError.message}`);
  }

  // 6. Upload thumbnail
  const { error: thumbError } = await supabaseClient.storage
    .from("photos")
    .upload(thumbPath, thumbnailImage, {
      contentType: "image/jpeg",
      cacheControl: "3600",
    });

  if (thumbError) {
    // Non-critical -- continue without thumbnail
    console.warn("Thumbnail upload failed:", thumbError.message);
  }

  // 7. Get public URLs
  const { data: fullUrlData } = supabaseClient.storage
    .from("photos")
    .getPublicUrl(fullPath);
  const { data: thumbUrlData } = supabaseClient.storage
    .from("photos")
    .getPublicUrl(thumbPath);

  const fullUrl = fullUrlData.publicUrl;
  const thumbnailUrl = thumbError ? null : thumbUrlData.publicUrl;

  // 8. Save metadata via API route
  const res = await fetch(`/api/tours/${tourId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storage_path: fullPath,
      full_url: fullUrl,
      thumbnail_url: thumbnailUrl,
      caption,
      author_name: authorName,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      taken_at: takenAt,
      width: dimensions.width,
      height: dimensions.height,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Metadaten konnten nicht gespeichert werden.");
  }

  return res.json();
}

function getImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht gelesen werden."));
    };
    img.src = url;
  });
}
