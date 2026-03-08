import { z } from "zod";

export const profileSchema = z.object({
  display_name: z
    .string()
    .max(50, "Maximal 50 Zeichen erlaubt")
    .optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const AVATAR_MAX_DIMENSION = 400; // px
export const AVATAR_MAX_COMPRESSED_SIZE_KB = 200; // KB
