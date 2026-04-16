// PROJ-34: Client-side slideshow renderer.
//
// Renders a Storyboard to a WebM Blob using Canvas 2D + captureStream +
// MediaRecorder, mixed with a music track via Web Audio API.
//
// Runs on the main thread (not in a Worker) because AudioContext +
// captureStream are not available in Workers in all browsers. We yield to
// the event loop between frames so the UI can update the progress bar.

import { createAudioMixer, combineStreams, type AudioMixerHandle } from "./audio-mixer";
import { findTrack, snapToBeat, pickDefaultTrack } from "./music-library";
import type { Scene, Storyboard } from "./storyboard-types";

export interface RenderProgress {
  phase: "preloading" | "rendering" | "finalizing";
  current: number; // 0..total
  total: number;
  message: string;
}

export interface RenderResult {
  blob: Blob;
  durationMs: number;
  width: number;
  height: number;
}

export interface RenderOptions {
  storyboard: Storyboard;
  format: "portrait" | "landscape";
  // Maps content_item_id -> { url, type, author_name, author_avatar_url, caption }
  itemMeta: Map<
    string,
    {
      url: string | null;
      thumbnail_url: string | null;
      type: "photo" | "video" | "text" | "audio";
      author_name: string | null;
      author_avatar_url: string | null;
      caption: string | null;
    }
  >;
  eventName: string;
  agendaTitle: string;
  agendaDate: string;
  onProgress?: (p: RenderProgress) => void;
  signal?: AbortSignal;
}

type LoadedImage = HTMLImageElement;

function dimensionsFor(format: "portrait" | "landscape") {
  return format === "portrait"
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

async function loadImage(url: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timeout = setTimeout(() => {
      console.error("[slideshow] image load timeout (15s):", url);
      reject(new Error(`Image load timeout: ${url}`));
    }, 15000);
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = (e) => {
      clearTimeout(timeout);
      console.error("[slideshow] image load failed:", url, e);
      reject(new Error(`Image load failed: ${url}`));
    };
    img.src = url;
  });
}

async function loadVideoFrame(url: string): Promise<LoadedImage> {
  // Capture first frame from a video into an Image-like canvas via blob.
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    video.addEventListener(
      "loadeddata",
      () => {
        try {
          const c = document.createElement("canvas");
          c.width = video.videoWidth || 1080;
          c.height = video.videoHeight || 1920;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(video, 0, 0, c.width, c.height);
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("video frame decode failed"));
          img.src = c.toDataURL("image/jpeg", 0.85);
        } catch (e) {
          reject(e instanceof Error ? e : new Error("video frame failed"));
        }
      },
      { once: true }
    );
    video.addEventListener("error", () => reject(new Error(`Video load failed: ${url}`)), { once: true });
    video.load();
  });
}

function applyColorGrade(ctx: CanvasRenderingContext2D, grade: Scene["color_grade"]) {
  switch (grade) {
    case "warm":
      ctx.filter = "saturate(1.2) sepia(0.18) contrast(1.05) brightness(1.02)";
      break;
    case "cool":
      ctx.filter = "saturate(1.1) hue-rotate(-10deg) contrast(1.05) brightness(0.98)";
      break;
    case "neutral":
    default:
      ctx.filter = "saturate(1.1) contrast(1.04)";
  }
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: LoadedImage,
  W: number,
  H: number,
  effect: Scene["effect"],
  t: number // 0..1 progress within scene
) {
  const ir = img.width / img.height;
  const cr = W / H;
  // Object-contain base: show entire image, letterbox the rest. Avoids
  // aggressive center-crop that cuts heads/legs off when aspect ratios
  // differ strongly (e.g. 4:3 photo into 9:16 video).
  let dw: number, dh: number, dx: number, dy: number;
  if (ir > cr) {
    // Image is wider than canvas → fit by width, letterbox top/bottom
    dw = W;
    dh = W / ir;
    dx = 0;
    dy = (H - dh) / 2;
  } else {
    // Image is taller than canvas → fit by height, letterbox sides
    dh = H;
    dw = H * ir;
    dx = (W - dw) / 2;
    dy = 0;
  }
  // No zoom/pan — keep full image visible. Scene transitions (crossfades)
  // provide the motion. Frank's feedback: Ken-Burns cropped too much of
  // landscape shots.
  const scale = 1;
  const tx = 0;
  const ty = 0;
  // Effect param intentionally ignored; kept in storyboard for future use.
  void effect;
  void t;
  // Blurred background fill (Instagram-story style) so letterbox bars don't
  // look like dead black space.
  ctx.save();
  ctx.filter = "blur(40px) brightness(0.6)";
  // Draw the image cover-style (fill canvas, crop) as background
  let bgW: number, bgH: number, bgX: number, bgY: number;
  if (ir > cr) {
    bgH = H;
    bgW = H * ir;
    bgX = (W - bgW) / 2;
    bgY = 0;
  } else {
    bgW = W;
    bgH = W / ir;
    bgX = 0;
    bgY = (H - bgH) / 2;
  }
  ctx.drawImage(img, bgX, bgY, bgW, bgH);
  ctx.restore();

  // Foreground: contain + Ken Burns
  ctx.save();
  ctx.translate(W / 2 + tx, H / 2 + ty);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawGradient(ctx: CanvasRenderingContext2D, W: number, H: number, mood: string) {
  const palette: Record<string, [string, string]> = {
    epic: ["#1a1a2e", "#e94560"],
    chill: ["#2c3e50", "#3498db"],
    joyful: ["#f6d365", "#fda085"],
    reflective: ["#0f2027", "#2c5364"],
  };
  const [a, b] = palette[mood] ?? palette.epic;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawDarkOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, alpha = 0.45) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  W: number,
  cy: number,
  fontPx: number,
  weight = "700"
) {
  ctx.font = `${weight} ${fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;
  // Simple word wrap
  const maxWidth = W * 0.85;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const lineHeight = fontPx * 1.2;
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lineHeight));
  ctx.shadowBlur = 0;
}

function drawAuthorBadge(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  name: string | null,
  avatarImg: LoadedImage | null
) {
  const padding = 32;
  const badgeH = 84;
  const r = badgeH / 2;
  const text = name ?? "anonym";
  ctx.font = `600 32px system-ui, -apple-system, sans-serif`;
  const textW = ctx.measureText(text).width;
  const badgeW = badgeH + 24 + textW + 32;
  const x = padding;
  const y = H - padding - badgeH;
  // Pill background
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + badgeW, y, x + badgeW, y + badgeH, r);
  ctx.arcTo(x + badgeW, y + badgeH, x, y + badgeH, r);
  ctx.arcTo(x, y + badgeH, x, y, r);
  ctx.arcTo(x, y, x + badgeW, y, r);
  ctx.closePath();
  ctx.fill();
  // Avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + r, y + r, r - 4, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, x + 4, y + 4, badgeH - 8, badgeH - 8);
  } else {
    ctx.fillStyle = "#666";
    ctx.fillRect(x + 4, y + 4, badgeH - 8, badgeH - 8);
  }
  ctx.restore();
  // Name
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + badgeH + 16, y + r);
}

function totalDuration(sb: Storyboard): number {
  return sb.scenes.reduce((s, sc) => s + sc.duration_ms, 0);
}

function findSceneAt(sb: Storyboard, t_ms: number): { scene: Scene; index: number; sceneStart: number } | null {
  let acc = 0;
  for (let i = 0; i < sb.scenes.length; i++) {
    const sc = sb.scenes[i];
    if (t_ms >= acc && t_ms < acc + sc.duration_ms) {
      return { scene: sc, index: i, sceneStart: acc };
    }
    acc += sc.duration_ms;
  }
  return null;
}

export async function renderSlideshow(opts: RenderOptions): Promise<RenderResult> {
  const { storyboard, format, itemMeta, onProgress, signal, eventName, agendaTitle, agendaDate } = opts;
  const { width: W, height: H } = dimensionsFor(format);

  const checkAbort = () => {
    if (signal?.aborted) throw new Error("Abgebrochen");
  };

  // 1. Preload all images
  const sceneImages = new Map<number, LoadedImage>();
  const avatarImages = new Map<string, LoadedImage>();
  const totalToLoad = storyboard.scenes.length;

  for (let i = 0; i < storyboard.scenes.length; i++) {
    checkAbort();
    onProgress?.({
      phase: "preloading",
      current: i,
      total: totalToLoad,
      message: `Lade Bild ${i + 1} von ${totalToLoad}…`,
    });
    const scene = storyboard.scenes[i];
    if (scene.type === "photo" || scene.type === "cover") {
      const meta = scene.content_item_id ? itemMeta.get(scene.content_item_id) : null;
      const url = meta?.url || meta?.thumbnail_url;
      if (url) {
        try {
          sceneImages.set(i, await loadImage(url));
        } catch (e) {
          console.warn("[slideshow] scene", i, "photo load failed, falling back to gradient:", e);
        }
      } else {
        console.warn("[slideshow] scene", i, "has no url, scene meta:", meta);
      }
    } else if (scene.type === "video") {
      const meta = scene.content_item_id ? itemMeta.get(scene.content_item_id) : null;
      const url = meta?.thumbnail_url || meta?.url;
      if (url) {
        try {
          if (meta?.thumbnail_url) {
            sceneImages.set(i, await loadImage(meta.thumbnail_url));
          } else if (meta?.url) {
            sceneImages.set(i, await loadVideoFrame(meta.url));
          }
        } catch (e) {
          console.warn("[slideshow] scene", i, "video frame load failed:", e);
        }
      }
    }
    // Preload avatar if present
    const meta = scene.content_item_id ? itemMeta.get(scene.content_item_id) : null;
    if (meta?.author_avatar_url && !avatarImages.has(meta.author_avatar_url)) {
      try {
        avatarImages.set(meta.author_avatar_url, await loadImage(meta.author_avatar_url));
      } catch {
        /* ignore */
      }
    }
  }

  // 2. Setup canvas
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingQuality = "high";

  // 3. Setup audio
  const track = findTrack(storyboard.music_track_id) ?? pickDefaultTrack(storyboard.mood);
  let mixer: AudioMixerHandle | null = null;
  try {
    mixer = await createAudioMixer(track.file);
  } catch {
    // Music load failed — render silent
    mixer = null;
  }
  checkAbort();

  // 4. Setup MediaRecorder
  const fps = 30;
  const videoStream = canvas.captureStream(fps);
  const combined = combineStreams(videoStream, mixer?.audioStream ?? null);

  const supportedTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType = supportedTypes.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) {
    mixer?.destroy();
    throw new Error("Browser unterstützt MediaRecorder/WebM nicht");
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stoppedPromise = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  // 5. Render loop
  const totalMs = totalDuration(storyboard);
  recorder.start(250);
  if (mixer) {
    try {
      await mixer.context.resume();
      mixer.start();
    } catch {
      /* ignore */
    }
  }

  const startWall = performance.now();
  let lastSceneIdx = -1;

  try {
    while (true) {
      checkAbort();
      const elapsed = performance.now() - startWall;
      if (elapsed >= totalMs) break;

      const found = findSceneAt(storyboard, elapsed);
      if (!found) break;
      const { scene, index, sceneStart } = found;
      const localT = (elapsed - sceneStart) / scene.duration_ms; // 0..1

      // Crossfade alpha during last 300 ms of each scene (if next scene exists)
      const remainInScene = scene.duration_ms - (elapsed - sceneStart);
      const fadeMs = 350;
      const isFading = remainInScene < fadeMs && index < storyboard.scenes.length - 1;
      const fadeAlpha = isFading ? remainInScene / fadeMs : 1;

      // Background fill (always)
      ctx.filter = "none";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // Draw scene
      const img = sceneImages.get(index);
      const meta = scene.content_item_id ? itemMeta.get(scene.content_item_id) : null;

      if (scene.type === "cover") {
        if (img) {
          applyColorGrade(ctx, scene.color_grade);
          drawCoverImage(ctx, img, W, H, scene.effect, localT);
          ctx.filter = "none";
          drawDarkOverlay(ctx, W, H, 0.55);
        } else {
          drawGradient(ctx, W, H, storyboard.mood);
        }
        // Title block
        drawCenteredText(ctx, storyboard.title, W, H * 0.42, format === "portrait" ? 92 : 80, "800");
        drawCenteredText(ctx, agendaTitle, W, H * 0.55, format === "portrait" ? 52 : 44, "500");
        drawCenteredText(ctx, new Date(agendaDate + "T00:00:00").toLocaleDateString("de-DE", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }), W, H * 0.62, format === "portrait" ? 36 : 30, "400");
      } else if (scene.type === "photo" || scene.type === "video") {
        if (img) {
          applyColorGrade(ctx, scene.color_grade);
          drawCoverImage(ctx, img, W, H, scene.effect, localT);
          ctx.filter = "none";
        } else {
          drawGradient(ctx, W, H, storyboard.mood);
        }
        if (scene.type === "video") {
          // Play icon overlay top-right
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.beginPath();
          ctx.arc(W - 80, 80, 44, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.moveTo(W - 92, 60);
          ctx.lineTo(W - 92, 100);
          ctx.lineTo(W - 60, 80);
          ctx.closePath();
          ctx.fill();
        }
        // Bottom gradient for legibility
        const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.7)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, H * 0.55, W, H * 0.45);
        // Overlay text (caption / quote)
        if (scene.overlay_text) {
          drawCenteredText(ctx, scene.overlay_text, W, H * 0.78, format === "portrait" ? 44 : 36, "600");
        }
        // Author badge
        const avatar = meta?.author_avatar_url ? avatarImages.get(meta.author_avatar_url) ?? null : null;
        drawAuthorBadge(ctx, W, H, meta?.author_name ?? null, avatar);
      } else if (scene.type === "text-card") {
        drawGradient(ctx, W, H, storyboard.mood);
        drawCenteredText(ctx, scene.overlay_text || "", W, H / 2, format === "portrait" ? 64 : 56, "700");
        const avatar = meta?.author_avatar_url ? avatarImages.get(meta.author_avatar_url) ?? null : null;
        if (meta?.author_name) {
          drawAuthorBadge(ctx, W, H, meta.author_name, avatar);
        }
      } else if (scene.type === "chapter-title") {
        drawGradient(ctx, W, H, storyboard.mood);
        drawDarkOverlay(ctx, W, H, 0.25);
        const chapter = storyboard.chapters.find((c) => c.id === scene.chapter_id);
        drawCenteredText(ctx, chapter?.title || scene.overlay_text || "", W, H / 2, format === "portrait" ? 88 : 72, "800");
      }

      // Apply crossfade by drawing black on top with reverse alpha
      if (isFading) {
        ctx.fillStyle = `rgba(0,0,0,${1 - fadeAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Progress callback once per scene transition
      if (index !== lastSceneIdx) {
        lastSceneIdx = index;
        onProgress?.({
          phase: "rendering",
          current: index + 1,
          total: storyboard.scenes.length,
          message: `Szene ${index + 1} von ${storyboard.scenes.length}…`,
        });
      }

      // Yield to event loop so UI/progress can update
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }
  } finally {
    onProgress?.({
      phase: "finalizing",
      current: storyboard.scenes.length,
      total: storyboard.scenes.length,
      message: "Finalisiere…",
    });
    if (recorder.state !== "inactive") recorder.stop();
    await stoppedPromise;
    mixer?.destroy();
    videoStream.getTracks().forEach((t) => t.stop());
  }

  const blob = new Blob(chunks, { type: mimeType });
  return { blob, durationMs: totalMs, width: W, height: H };
}

// Snap-to-beat helper exposed for editor (so admin can preview snap targets)
export function snapStoryboardToBeats(sb: Storyboard): Storyboard {
  const track = findTrack(sb.music_track_id);
  if (!track) return sb;
  const newScenes: Scene[] = [];
  let cursor = 0;
  for (const sc of sb.scenes) {
    const target = cursor + sc.duration_ms;
    const snapped = snapToBeat(track, target, cursor + 1500);
    newScenes.push({ ...sc, duration_ms: Math.max(1500, snapped - cursor) });
    cursor = snapped;
  }
  return { ...sb, scenes: newScenes };
}
