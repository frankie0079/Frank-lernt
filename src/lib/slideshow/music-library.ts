// PROJ-34: Music library — beat-timestamped tracks for slideshow rendering.
//
// Beats are extracted ONCE offline (see scripts/extract-beats.mjs) and committed
// as constants here. The renderer uses beat_timestamps_ms to snap scene cuts
// onto downbeats.
//
// Tracks live under /public/music/<file>.mp3 — served as static assets.

import type { StoryboardMood } from "./storyboard-types";

export interface MusicTrack {
  id: string;
  file: string; // public/-relative path
  title: string;
  artist: string;
  mood: StoryboardMood;
  bpm: number;
  duration_ms: number;
  // Sorted ascending. Used by renderer to snap scene cuts.
  beat_timestamps_ms: number[];
}

// Helper: synthesize beats from BPM if no real beat data exists yet (placeholder
// until extract-beats.mjs runs). The renderer can still snap to a regular grid.
function synthBeats(bpm: number, durationMs: number): number[] {
  const intervalMs = 60_000 / bpm;
  const out: number[] = [];
  for (let t = 0; t < durationMs; t += intervalMs) {
    out.push(Math.round(t));
  }
  return out;
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    id: "epic-summit",
    file: "/music/epic-summit.mp3",
    title: "Summit Push",
    artist: "Library",
    mood: "epic",
    bpm: 120,
    duration_ms: 60_000,
    beat_timestamps_ms: synthBeats(120, 60_000),
  },
  {
    id: "epic-horizon",
    file: "/music/epic-horizon.mp3",
    title: "Distant Horizon",
    artist: "Library",
    mood: "epic",
    bpm: 100,
    duration_ms: 60_000,
    beat_timestamps_ms: synthBeats(100, 60_000),
  },
  {
    id: "chill-meadow",
    file: "/music/chill-meadow.mp3",
    title: "Meadow Walk",
    artist: "Library",
    mood: "chill",
    bpm: 88,
    duration_ms: 60_000,
    beat_timestamps_ms: synthBeats(88, 60_000),
  },
  {
    id: "chill-river",
    file: "/music/chill-river.mp3",
    title: "Slow River",
    artist: "Library",
    mood: "chill",
    bpm: 76,
    duration_ms: 60_000,
    beat_timestamps_ms: synthBeats(76, 60_000),
  },
  {
    id: "joyful-camp",
    file: "/music/joyful-camp.mp3",
    title: "Camp Days",
    artist: "Library",
    mood: "joyful",
    bpm: 128,
    duration_ms: 60_000,
    beat_timestamps_ms: synthBeats(128, 60_000),
  },
  {
    id: "joyful-trail",
    file: "/music/joyful-trail.mp3",
    title: "Trail Friends",
    artist: "Library",
    mood: "joyful",
    bpm: 116,
    duration_ms: 60_000,
    beat_timestamps_ms: synthBeats(116, 60_000),
  },
  {
    id: "reflective-dusk",
    file: "/music/reflective-dusk.mp3",
    title: "Dusk Reflection",
    artist: "Library",
    mood: "reflective",
    bpm: 70,
    duration_ms: 60_000,
    beat_timestamps_ms: synthBeats(70, 60_000),
  },
  {
    id: "reflective-stars",
    file: "/music/reflective-stars.mp3",
    title: "Under Stars",
    artist: "Library",
    mood: "reflective",
    bpm: 64,
    duration_ms: 60_000,
    beat_timestamps_ms: synthBeats(64, 60_000),
  },
];

export function tracksByMood(mood: StoryboardMood): MusicTrack[] {
  return MUSIC_LIBRARY.filter((t) => t.mood === mood);
}

export function findTrack(id: string | null | undefined): MusicTrack | null {
  if (!id) return null;
  return MUSIC_LIBRARY.find((t) => t.id === id) ?? null;
}

export function pickDefaultTrack(mood: StoryboardMood): MusicTrack {
  return tracksByMood(mood)[0] ?? MUSIC_LIBRARY[0];
}

/** Snap a target time to the nearest beat at or after `from_ms`. */
export function snapToBeat(track: MusicTrack, target_ms: number, from_ms: number): number {
  const candidates = track.beat_timestamps_ms.filter((b) => b >= from_ms);
  if (candidates.length === 0) return target_ms;
  let best = candidates[0];
  let bestDiff = Math.abs(best - target_ms);
  for (const b of candidates) {
    const d = Math.abs(b - target_ms);
    if (d < bestDiff) {
      best = b;
      bestDiff = d;
    }
  }
  return best;
}
