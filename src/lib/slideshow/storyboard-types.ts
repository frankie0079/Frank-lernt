// PROJ-34: Storyboard types — shared between server (LLM call + Zod validation)
// and client (renderer + editor UI).
//
// A storyboard is the LLM-produced "shooting script" for the slideshow film.
// Scene budget = 60 s total film minus fixed 6 s intro + 3.5 s outro phases.

import { z } from "zod";

export const SLIDESHOW_MAX_MEDIA_ITEMS = 12;
export const SLIDESHOW_MAX_DURATION_MS = 72_000;
// Min scene length is 1.5 s so films with many curated photos (up to ~33)
// still fit in the 50.5 s scene budget. The LLM is instructed to prefer
// 4–5 s and only drop below when the budget is tight.
export const SLIDESHOW_MIN_SCENE_MS = 4_000;
export const SLIDESHOW_MAX_SCENE_MS = 6_000;

export const STORYBOARD_MOODS = ["epic", "chill", "joyful", "reflective"] as const;
export type StoryboardMood = (typeof STORYBOARD_MOODS)[number];

export const FILM_STYLES = ["postcard", "recap", "journal"] as const;
export type FilmStyle = (typeof FILM_STYLES)[number];

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

export const titleCardSchema = z.object({
  content_item_id: z.string().uuid().nullable().default(null),
  text: z.string().max(160).default(""),
});
export type TitleCard = z.infer<typeof titleCardSchema>;

export const storyboardSchema = z
  .object({
    title: z.string().min(1).max(120),
    film_style: z.enum(FILM_STYLES).default("postcard"),
    mood: z.enum(STORYBOARD_MOODS),
    music_track_id: z.string().min(1).max(64).nullable().default(null),
    chapters: z.array(chapterSchema).min(1).max(8),
    intro: titleCardSchema.default({ content_item_id: null, text: "" }),
    outro: titleCardSchema.default({ content_item_id: null, text: "Ende" }),
    scenes: z.array(sceneSchema).min(1).max(SLIDESHOW_MAX_MEDIA_ITEMS),
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
      if (sc.type !== "photo" && sc.type !== "video") {
        ctx.addIssue({
          code: "custom",
          message: `Nicht erlaubter Szenentyp: ${sc.type}`,
        });
      }
      if (!chapterIds.has(sc.chapter_id)) {
        ctx.addIssue({
          code: "custom",
          message: `Scene referenziert unbekanntes Kapitel: ${sc.chapter_id}`,
        });
      }
    }
  });
export type Storyboard = z.infer<typeof storyboardSchema>;

export function stripGeneratedIntroScenes(storyboard: Storyboard): Storyboard {
  const mediaScenes = storyboard.scenes
    .filter((scene) => scene.type === "photo" || scene.type === "video")
    .slice(0, SLIDESHOW_MAX_MEDIA_ITEMS)
    .map((scene) => ({
      ...scene,
      duration_ms: Math.max(
        SLIDESHOW_MIN_SCENE_MS,
        Math.min(SLIDESHOW_MAX_SCENE_MS, scene.duration_ms)
      ),
    }));
  const photoIds = new Set(
    mediaScenes
      .filter((scene) => scene.type === "photo" && scene.content_item_id)
      .map((scene) => scene.content_item_id)
  );
  const introId = storyboard.intro?.content_item_id ?? null;
  const outroId = storyboard.outro?.content_item_id ?? null;

  return {
    ...storyboard,
    film_style: storyboard.film_style ?? "postcard",
    intro: {
      content_item_id: introId && photoIds.has(introId) ? introId : null,
      text: storyboard.intro?.text?.trim() || storyboard.title,
    },
    outro: {
      content_item_id: outroId && photoIds.has(outroId) ? outroId : null,
      text: storyboard.outro?.text?.trim() || "Ende",
    },
    scenes: mediaScenes,
  };
}

// Server -> client input shape (mirror of get_report_storyboard_input RPC).
export interface StoryboardInputItem {
  sort_order: number;
  content_item_id: string;
  type: "photo" | "video" | "text" | "audio";
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  comments: Array<{ author: string | null; text: string }>;
}

export interface StoryboardInput {
  event: { id: string; name: string; description: string | null; cover_url: string | null };
  agenda_item: { id: string; title: string; date: string };
  report_id: string;
  existing_storyboard: Storyboard | null;
  items: StoryboardInputItem[];
}
