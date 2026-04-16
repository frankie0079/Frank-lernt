"use client";

// PROJ-34: Lightweight storyboard editor — admin can rename title, change
// music track, edit overlay text per scene, and remove scenes. Reordering is
// kept simple (up/down buttons) to avoid pulling dnd-kit into yet another tree.

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import {
  SLIDESHOW_MAX_DURATION_MS,
  type Storyboard,
} from "@/lib/slideshow/storyboard-types";

interface MusicTrackOption {
  id: string;
  title: string;
  mood: string;
}

interface SceneThumb {
  thumbnail_url: string | null;
  media_url: string | null;
}

interface Props {
  storyboard: Storyboard;
  musicTracks: MusicTrackOption[];
  onChange: (next: Storyboard) => void;
  /** Optional map of content_item_id → thumbnail/media URL for preview in the scene list */
  sceneThumbnails?: Map<string, SceneThumb>;
}

export function StoryboardEditor({ storyboard, musicTracks, onChange, sceneThumbnails }: Props) {
  const totalMs = useMemo(
    () => storyboard.scenes.reduce((s, sc) => s + sc.duration_ms, 0),
    [storyboard.scenes]
  );
  const overBudget = totalMs > SLIDESHOW_MAX_DURATION_MS;

  const updateScene = (idx: number, patch: Partial<Storyboard["scenes"][number]>) => {
    const next = { ...storyboard, scenes: storyboard.scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s)) };
    onChange(next);
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= storyboard.scenes.length) return;
    const next = [...storyboard.scenes];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ ...storyboard, scenes: next });
  };

  const removeScene = (idx: number) => {
    if (storyboard.scenes.length <= 1) return;
    onChange({ ...storyboard, scenes: storyboard.scenes.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sb-title">Filmtitel</Label>
        <Input
          id="sb-title"
          value={storyboard.title}
          onChange={(e) => onChange({ ...storyboard, title: e.target.value.slice(0, 120) })}
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sb-music">Musik</Label>
        <Select
          value={storyboard.music_track_id ?? ""}
          onValueChange={(v) => onChange({ ...storyboard, music_track_id: v })}
        >
          <SelectTrigger id="sb-music">
            <SelectValue placeholder="Track wählen" />
          </SelectTrigger>
          <SelectContent>
            {musicTracks.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title} <span className="text-muted-foreground">— {t.mood}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3 text-sm">
        <span>
          Gesamtdauer: <strong>{(totalMs / 1000).toFixed(1)} s</strong> /{" "}
          {SLIDESHOW_MAX_DURATION_MS / 1000} s
        </span>
        {overBudget && (
          <span className="text-destructive font-medium">Zu lang!</span>
        )}
      </div>

      <div className="space-y-3">
        <Label>Szenen</Label>
        {storyboard.scenes.map((sc, i) => {
          const chapter = storyboard.chapters.find((c) => c.id === sc.chapter_id);
          const thumb = sc.content_item_id ? sceneThumbnails?.get(sc.content_item_id) : null;
          const thumbUrl = thumb?.thumbnail_url || thumb?.media_url || null;
          return (
            <div key={i} className="flex gap-3 rounded-md border border-border p-3">
              {thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl}
                  alt={`Szene ${i + 1}`}
                  className="h-20 w-20 shrink-0 rounded object-cover bg-muted"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  {sc.type}
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  #{i + 1} · {sc.type} · {chapter?.title ?? sc.chapter_id} · {(sc.duration_ms / 1000).toFixed(1)}s
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveScene(i, -1)}
                    aria-label="Nach oben"
                    disabled={i === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveScene(i, 1)}
                    aria-label="Nach unten"
                    disabled={i === storyboard.scenes.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeScene(i)}
                    aria-label="Entfernen"
                    disabled={storyboard.scenes.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={sc.overlay_text}
                onChange={(e) => updateScene(i, { overlay_text: e.target.value.slice(0, 280) })}
                placeholder="Text-Overlay (max. 280 Zeichen)"
                rows={2}
                maxLength={280}
              />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
