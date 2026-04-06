import { z } from "zod";

// --- Content Item Schema ---

export const contentTypeEnum = z.enum(["photo", "video", "text", "audio"]);
export type ContentType = z.infer<typeof contentTypeEnum>;

export const contentCreateSchema = z.object({
  type: contentTypeEnum,
  agenda_item_id: z.string().uuid().nullable().optional(),
  media_url: z.string().url().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  caption: z
    .string()
    .max(2500, "Maximal 2500 Zeichen")
    .optional()
    .or(z.literal("")),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  exif_date: z.string().nullable().optional(),
});

export type ContentCreatePayload = z.infer<typeof contentCreateSchema>;

// --- Constants ---

export const CONTENT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
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
export const CONTENT_MAX_IMAGE_DIMENSION = 1920; // px
export const CONTENT_THUMBNAIL_DIMENSION = 400; // px
