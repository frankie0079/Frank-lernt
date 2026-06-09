// PROJ-34 (2026-04-21): Reconcile a storyboard with the current curated
// selection for a day. Ensures that *every* curated photo/video appears as
// exactly one scene in the storyboard — even if the user added/removed
// photos after the LLM plan was generated.
//
// Strategy:
//   - Drop legacy cover scenes. The renderer already creates a fixed intro.
//   - Keep chapter-title and text-card scenes as-is when they have content.
//   - Keep every existing photo/video scene whose content_item_id is still
//     in the curated selection.
//   - Drop scenes whose content_item_id is no longer curated.
//   - Append a minimal scene for every curated photo/video that the
//     storyboard doesn't yet reference.
//   - If the resulting total exceeds SLIDESHOW_MAX_DURATION_MS, shrink all
//     photo/video scenes proportionally until it fits (down to min scene
//     duration). Non-photo scenes are left untouched.

import {
  SLIDESHOW_MAX_DURATION_MS,
  SLIDESHOW_MIN_SCENE_MS,
  SLIDESHOW_MAX_SCENE_MS,
  SLIDESHOW_MAX_MEDIA_ITEMS,
  stripGeneratedIntroScenes,
  type Scene,
  type Storyboard,
  type StoryboardInputItem,
} from "./storyboard-types";

const PHOTO_VIDEO_TYPES: readonly Scene["type"][] = ["photo", "video"];

function isPhotoLikeScene(s: Scene): boolean {
  return PHOTO_VIDEO_TYPES.includes(s.type);
}

export interface ReconcileResult {
  storyboard: Storyboard;
  added: number;   // photos appended as new scenes
  removed: number; // scenes dropped (curation removed the item)
  rebalanced: boolean; // true if we had to shrink scene durations to fit budget
}

export function reconcileStoryboardWithItems(
  sb: Storyboard,
  items: StoryboardInputItem[]
): ReconcileResult {
  const base = stripGeneratedIntroScenes(sb);
  const curated = items.filter(
    (it) => (it.type === "photo" || it.type === "video") && !!it.content_item_id
  ).slice(0, SLIDESHOW_MAX_MEDIA_ITEMS);
  const curatedIds = new Set(curated.map((it) => it.content_item_id));

  // 1. Walk existing scenes, split into photo-scenes (keep if still curated)
  //    vs non-photo scenes. Preserve source order. Legacy "cover" scenes are
  //    removed because the renderer already prepends the real cover/title intro.
  const keptScenes: Scene[] = [];
  const existingPhotoIds = new Set<string>();
  let removed = sb.scenes.length - base.scenes.length;
  for (const sc of base.scenes) {
    if (isPhotoLikeScene(sc) && sc.content_item_id) {
      if (curatedIds.has(sc.content_item_id)) {
        keptScenes.push(sc);
        existingPhotoIds.add(sc.content_item_id);
      } else {
        removed++;
      }
    } else {
      removed++;
    }
  }

  // 2. Append a minimal scene for every curated item the storyboard doesn't
  //    yet reference. New scenes attach to the first chapter and use a
  //    simple effect / neutral grade — the admin can tweak in the editor.
  const chapterId = sb.chapters[0]?.id ?? "intro";
  const appended: Scene[] = [];
  for (const item of curated) {
    if (existingPhotoIds.has(item.content_item_id)) continue;
    appended.push({
      type: item.type === "video" ? "video" : "photo",
      content_item_id: item.content_item_id,
      chapter_id: chapterId,
      duration_ms: SLIDESHOW_MIN_SCENE_MS,
      overlay_text: (item.caption ?? "").slice(0, 80),
      effect: "kenburns-zoom-in",
      color_grade: "neutral",
    });
  }
  const added = appended.length;

  const merged: Scene[] = [...keptScenes, ...appended].slice(0, SLIDESHOW_MAX_MEDIA_ITEMS);

  // 3. Fit to budget — bulletproof. Three stages:
  //    a) Shrink only photo/video scenes first (preserves LLM pacing for
  //       cover + chapter-title beats).
  //    b) If that's not enough, shrink ALL scenes proportionally.
  //    c) Final guard: if somehow still over (e.g. scene count × MIN >
  //       budget), clamp each to MIN and drop trailing non-photo scenes
  //       until it fits. Photos are never dropped by reconcile — the
  //       whole point is that every curated photo appears in the film.
  let totalMs = merged.reduce((sum, s) => sum + s.duration_ms, 0);
  let rebalanced = false;

  if (totalMs > SLIDESHOW_MAX_DURATION_MS) {
    const photoScenes = merged.filter(isPhotoLikeScene);
    const nonPhotoMs = merged
      .filter((s) => !isPhotoLikeScene(s))
      .reduce((sum, s) => sum + s.duration_ms, 0);
    const photoBudget = SLIDESHOW_MAX_DURATION_MS - nonPhotoMs;

    // Stage a: can we fit by shrinking photos alone (each ≥ MIN)?
    if (
      photoScenes.length > 0 &&
      photoBudget >= photoScenes.length * SLIDESHOW_MIN_SCENE_MS
    ) {
      const perScene = Math.min(
        SLIDESHOW_MAX_SCENE_MS,
        Math.floor(photoBudget / photoScenes.length)
      );
      for (const s of photoScenes) s.duration_ms = perScene;
    } else {
      // Stage b: shrink everything proportionally.
      const scale = SLIDESHOW_MAX_DURATION_MS / totalMs;
      for (const s of merged) {
        s.duration_ms = Math.max(
          SLIDESHOW_MIN_SCENE_MS,
          Math.min(SLIDESHOW_MAX_SCENE_MS, Math.floor(s.duration_ms * scale))
        );
      }
      // Stage c: if MIN-clamp pushes us back over (many scenes × MIN), drop
      // trailing non-photo scenes (cover/chapter-title) until it fits.
      // Photos remain — that invariant is the reason reconcile exists.
      totalMs = merged.reduce((sum, s) => sum + s.duration_ms, 0);
      while (totalMs > SLIDESHOW_MAX_DURATION_MS) {
        let dropIdx = -1;
        for (let i = merged.length - 1; i >= 0; i--) {
          if (!isPhotoLikeScene(merged[i])) {
            dropIdx = i;
            break;
          }
        }
        if (dropIdx === -1) break; // nothing but photos — stop and accept
        merged.splice(dropIdx, 1);
        totalMs = merged.reduce((sum, s) => sum + s.duration_ms, 0);
      }
    }
    rebalanced = true;
  }

  return {
    storyboard: { ...base, scenes: merged },
    added,
    removed,
    rebalanced,
  };
}
