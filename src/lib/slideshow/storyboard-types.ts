// PROJ-34: Storyboard types — shared between server (LLM call + Zod validation)
// and client (renderer + editor UI).
//
// A storyboard is the LLM-produced "shooting script" for the slideshow film.
// Hard constraint: total scene duration <= 45000 ms.

import { z } from "zod";

export const SLIDESHOW_MAX_DURATION_MS = 45_000;
export const SLIDESHOW_MIN_SCENE_MS = 1500;
export const SLIDESHOW_MAX_SCENE_MS = 5000;

export const STORYBOARD_MOODS = ["epic", "chill", "joyful", "reflective"] as const;
export type StoryboardMood = (typeof STORYBOARD_MOODS)[number];

export const SCENE_TYPES = [
  "cover",
  "photo",
  "video",
  "text-card",
  "chapter-title",
] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const SCENE_EFFECTS = [
  "kenburns-zoom-in",
  "kenburns-zoom-out",
  "kenburns-pan-left",
  "kenburns-pan-right",
  "static",
] as const;
export type SceneEffect = (typeof SCENE_EFFECTS)[number];

export const COLOR_GRADES = ["warm", "cool", "neutral"] as const;
export type ColorGrade = (typeof COLOR_GRADES)[number];

export const sceneSchema = z.object({
  type: z.enum(SCENE_TYPES),
  // null for cover / chapter-title / text-card scenes
  content_item_id: z.string().uuid().nullable(),
  chapter_id: z.string().min(1).max(64),
  duration_ms: z.number().int().min(SLIDESHOW_MIN_SCENE_MS).max(SLIDESHOW_MAX_SCENE_MS),
  overlay_text: z.string().max(280).default(""),
  effect: z.enum(SCENE_EFFECTS).default("static"),
  color_grade: z.enum(COLOR_GRADES).default("neutral"),
});
export type Scene = z.infer<typeof sceneSchema>;

export const chapterSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(80),
});
export type Chapter = z.infer<typeof chapterSchema>;

export const storyboardSchema = z
  .object({
    title: z.string().min(1).max(120),
    mood: z.enum(STORYBOARD_MOODS),
    music_track_id: z.string().min(1).max(64).nullable().default(null),
    chapters: z.array(chapterSchema).min(1).max(8),
    scenes: z.array(sceneSchema).min(1).max(40),
  })
  .superRefine((sb, ctx) => {
    const total = sb.scenes.reduce((sum, s) => sum + s.duration_ms, 0);
    if (total > SLIDESHOW_MAX_DURATION_MS) {
      ctx.addIssue({
        code: "custom",
        message: `Storyboard zu lang: ${total} ms > ${SLIDESHOW_MAX_DURATION_MS} ms`,
      });
    }
    const chapterIds = new Set(sb.chapters.map((c) => c.id));
    for (const sc of sb.scenes) {
      if (!chapterIds.has(sc.chapter_id)) {
        ctx.addIssue({
          code: "custom",
          message: `Scene referenziert unbekanntes Kapitel: ${sc.chapter_id}`,
        });
      }
    }
  });
export type Storyboard = z.infer<typeof storyboardSchema>;

// Server -> client input shape (mirror of get_report_storyboard_input RPC).
export interface StoryboardInputItem {
  sort_order: number;
  content_item_id: string;
  type: "photo" | "video" | "text" | "audio";
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  transcript: string | null;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  comments: Array<{ author: string | null; text: string }>;
}

export interface StoryboardInput {
  event: { id: string; name: string; description: string | null };
  agenda_item: { id: string; title: string; date: string };
  report_id: string;
  existing_storyboard: Storyboard | null;
  items: StoryboardInputItem[];
}
