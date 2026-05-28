import { z } from "zod";

// --- Content Item Schema ---

export const contentTypeEnum = z.enum(["photo", "video", "text", "audio"]);
export type ContentType = z.infer<typeof contentTypeEnum>;

// SHA-256 in lowercase hex is always exactly 64 chars of [0-9a-f]. We enforce
// this at the API boundary so malformed or oversized hashes can't poison the
// unique index or slip past the dedup probe (PROJ-39).
export const fileHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "Ungültiger Datei-Hash");

export const contentCreateSchema = z.object({
  type: contentTypeEnum,
  agenda_item_id: z.string().uuid().nullable().optional(),
  media_url: z.string().url().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  caption: z
    .string()
    .max(2500, "Maximal 2500 Zeichen")
    .nullable()
    .optional()
    .or(z.literal("")),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  exif_date: z.string().nullable().optional(),
  // PROJ-39: optional SHA-256 of the uploaded file. Null/absent for
  // text-only posts and legacy clients.
  file_hash: fileHashSchema.nullable().optional(),
});

export type ContentCreatePayload = z.infer<typeof contentCreateSchema>;

// --- Constants ---

export const CONTENT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // Original photo pick limit; stored images are compressed before upload.
export const CONTENT_ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export const CONTENT_ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;
export const CONTENT_MAX_CAPTION_LENGTH = 2500;
export const CONTENT_MAX_IMAGE_DIMENSION = 1600; // px
export const CONTENT_THUMBNAIL_DIMENSION = 400; // px
