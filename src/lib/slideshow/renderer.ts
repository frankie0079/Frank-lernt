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
import { SLIDESHOW_MIN_SCENE_MS, type Scene, type Storyboard } from "./storyboard-types";

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
  /** MIME type the encoder picked (e.g. "video/mp4" on iOS, "video/webm" on Chrome). */
  mimeType: string;
  /** Matching file extension ("mp4" or "webm"). */
  extension: "mp4" | "webm";
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
  /** Event cover photo URL — used for the dedicated intro cover scene. */
  eventCoverUrl?: string | null;
  onProgress?: (p: RenderProgress) => void;
  signal?: AbortSignal;
}

type LoadedImage = HTMLImageElement;

function dimensionsFor(format: "portrait" | "landscape") {
  return format === "portrait"
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

function formatAgendaDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

async function loadImageOnce(url: string, timeoutMs: number): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      // Detach handlers so a late-arriving load/error doesn't fire after we
      // moved on — prevents dangling callbacks on iOS Safari.
      img.onload = null;
      img.onerror = null;
      reject(new Error(`Image load timeout (${timeoutMs}ms): ${url}`));
    }, timeoutMs);
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Image load failed: ${url}`));
    };
    img.src = url;
  });
}

async function loadImage(url: string): Promise<LoadedImage> {
  // Two attempts, 8 s each. Hard cap ~16.5 s total. Previously 15 s/15 s
  // caused iOS Safari + Supabase CORS edge cases to freeze the preload
  // loop for a full half-minute per stuck image.
  const started = performance.now();
  try {
    const img = await loadImageOnce(url, 8000);
    console.log(`[slideshow] loaded ${((performance.now() - started)/1000).toFixed(1)}s:`, url);
    return img;
  } catch (err) {
    console.warn("[slideshow] image load first attempt failed, retrying:", url, err);
    await new Promise((r) => setTimeout(r, 400));
    const img = await loadImageOnce(url, 8000);
    console.log(`[slideshow] loaded (retry) ${((performance.now() - started)/1000).toFixed(1)}s:`, url);
    return img;
  }
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
  // Classic letterbox: solid black bars on the non-image axis. The caller
  // already fills the canvas with black before calling us, so nothing more
  // is needed for the background.
  ctx.save();
  ctx.translate(W / 2 + tx, H / 2 + ty);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawContainedImageInRect(
  ctx: CanvasRenderingContext2D,
  img: LoadedImage,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imageRatio = img.width / img.height;
  const rectRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  if (imageRatio > rectRatio) {
    drawHeight = width / imageRatio;
  } else {
    drawWidth = height * imageRatio;
  }
  ctx.drawImage(
    img,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
}

function drawRecapChrome(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  agendaTitle: string,
  agendaDate: string,
  sceneIndex: number,
  sceneCount: number,
  localT: number
) {
  const accent = "#e9b63a";
  const edge = Math.max(12, Math.round(W * 0.018));
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, edge);
  ctx.fillRect(0, H - edge, W, edge);

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(0, 0, W, Math.round(H * 0.09));
  ctx.font = `700 ${Math.round(W * 0.035)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(agendaTitle.slice(0, 42), Math.round(W * 0.05), Math.round(H * 0.045));
  ctx.textAlign = "right";
  ctx.fillStyle = accent;
  ctx.fillText(
    `${String(sceneIndex + 1).padStart(2, "0")} / ${String(sceneCount).padStart(2, "0")}`,
    Math.round(W * 0.95),
    Math.round(H * 0.045)
  );

  if (localT < 0.12) {
    const reveal = 1 - localT / 0.12;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W * reveal, H);
    ctx.fillStyle = "#111111";
    ctx.font = `800 ${Math.round(W * 0.05)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(agendaDate, Math.max(W * 0.2, W * reveal - W * 0.05), H * 0.5);
  }
}

function drawJournalScene(
  ctx: CanvasRenderingContext2D,
  img: LoadedImage,
  W: number,
  H: number,
  caption: string,
  agendaTitle: string,
  agendaDate: string
) {
  ctx.filter = "none";
  ctx.fillStyle = "#f2e7ce";
  ctx.fillRect(0, 0, W, H);
  const margin = Math.round(W * 0.07);
  const photoY = Math.round(H * 0.12);
  const photoH = Math.round(H * 0.57);
  ctx.fillStyle = "#fffdf7";
  ctx.shadowColor = "rgba(34,27,18,0.22)";
  ctx.shadowBlur = 24;
  ctx.fillRect(margin, photoY, W - margin * 2, photoH);
  ctx.shadowBlur = 0;
  drawContainedImageInRect(
    ctx,
    img,
    margin + 18,
    photoY + 18,
    W - margin * 2 - 36,
    photoH - 36
  );
  ctx.fillStyle = "#c94a2b";
  ctx.fillRect(margin, Math.round(H * 0.075), Math.round(W * 0.16), 10);
  ctx.fillStyle = "#1e4a3c";
  ctx.font = `700 ${Math.round(W * 0.038)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(agendaTitle.slice(0, 46), margin, Math.round(H * 0.06));
  ctx.fillStyle = "#6b6256";
  ctx.font = `600 ${Math.round(W * 0.026)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(agendaDate, W - margin, Math.round(H * 0.06));
  if (caption) {
    ctx.fillStyle = "#24312e";
    ctx.font = `600 ${Math.round(W * 0.038)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = caption.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > W * 0.78 && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 4);
    const lineHeight = Math.round(W * 0.052);
    const startY = H * 0.79 - ((shown.length - 1) * lineHeight) / 2;
    shown.forEach((text, index) => ctx.fillText(text, W / 2, startY + index * lineHeight));
  }
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

const INTRO_MS = 6000; // cover shown alone 0-3s, title fades in 3-4.5s, holds 4.5-6s
const END_MS = 5000;

/** Deterministic PRNG so re-renders of the same storyboard produce the same pacing. */
function scenePseudoDuration(sceneIndex: number): number {
  // Simple LCG seeded by index → range 4000..6000 ms
  const seed = (sceneIndex * 2654435761) >>> 0;
  const r = (seed % 2001) / 2000; // 0..1
  return 4000 + Math.round(r * 2000);
}

export async function renderSlideshow(opts: RenderOptions): Promise<RenderResult> {
  const {
    storyboard: originalStoryboard,
    format,
    itemMeta,
    onProgress,
    signal,
    eventCoverUrl,
    agendaTitle,
    agendaDate,
  } = opts;
  const { width: W, height: H } = dimensionsFor(format);
  const agendaDateLabel = formatAgendaDate(agendaDate);

  // Override scene durations: user wants each scene to last 4-6s (random,
  // deterministic by scene index). Clone the storyboard so we don't mutate
  // the caller's state.
  const storyboard: Storyboard = {
    ...originalStoryboard,
    scenes: originalStoryboard.scenes.map((sc, i) => ({
      ...sc,
      duration_ms: scenePseudoDuration(i),
    })),
  };

  const checkAbort = () => {
    if (signal?.aborted) throw new Error("Abgebrochen");
  };

  const resolveTitleCardUrl = (contentItemId: string | null) => {
    if (!contentItemId) return eventCoverUrl ?? null;
    const meta = itemMeta.get(contentItemId);
    return meta?.url || meta?.thumbnail_url || eventCoverUrl || null;
  };

  // Preload editable start and end page images.
  let introCoverImg: LoadedImage | null = null;
  const introUrl = resolveTitleCardUrl(storyboard.intro.content_item_id);
  if (introUrl) {
    try {
      introCoverImg = await loadImage(introUrl);
    } catch (e) {
      console.warn("[slideshow] event cover load failed, falling back to gradient:", e);
    }
  }
  let outroCoverImg: LoadedImage | null = null;
  const outroUrl = resolveTitleCardUrl(storyboard.outro.content_item_id);
  if (outroUrl) {
    try {
      outroCoverImg = await loadImage(outroUrl);
    } catch (e) {
      console.warn("[slideshow] outro image load failed, falling back to gradient:", e);
    }
  }

  // 1. Preload all images
  const sceneImages = new Map<number, LoadedImage>();
  const avatarImages = new Map<string, LoadedImage>();
  const totalToLoad = storyboard.scenes.length;

  const loadFailures: Array<{ index: number; type: string; url: string }> = [];
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
          console.error("[slideshow] scene", i, "photo load failed after retry:", e);
          // "cover" scenes with no content_item_id legitimately fall back to
          // gradient (the dedicated intro phase already shows the event cover).
          // A `photo` scene with a content_item_id represents a curated item
          // that MUST appear — record it and abort after the preload pass.
          if (scene.type === "photo") {
            loadFailures.push({ index: i, type: "photo", url });
          }
        }
      } else if (scene.type === "photo") {
        loadFailures.push({ index: i, type: "photo", url: "(none)" });
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
          console.error("[slideshow] scene", i, "video frame load failed:", e);
          loadFailures.push({ index: i, type: "video", url });
        }
      } else {
        loadFailures.push({ index: i, type: "video", url: "(none)" });
      }
    }
    // Preload avatar if present — non-critical, bounded to 3 s so a hung
    // avatar URL can't freeze the preload loop. drawAuthorBadge accepts
    // null if the avatar didn't load in time.
    const meta = scene.content_item_id ? itemMeta.get(scene.content_item_id) : null;
    if (meta?.author_avatar_url && !avatarImages.has(meta.author_avatar_url)) {
      try {
        const avatarImg = await Promise.race([
          loadImageOnce(meta.author_avatar_url, 3000),
          new Promise<LoadedImage>((_, reject) =>
            setTimeout(() => reject(new Error("avatar preload hard cap")), 3500)
          ),
        ]);
        avatarImages.set(meta.author_avatar_url, avatarImg);
      } catch {
        /* ignore — avatar is optional */
      }
    }
  }

  // Abort if any curated photo/video failed to load — the user asked for
  // every curated item to end up in the film, so silent gradient
  // placeholders are not acceptable.
  if (loadFailures.length > 0) {
    const sceneList = loadFailures.map((f) => `#${f.index + 1}`).join(", ");
    throw new Error(
      `${loadFailures.length} Foto${loadFailures.length === 1 ? "" : "s"} konnte${loadFailures.length === 1 ? "" : "n"} nicht geladen werden (Szene ${sceneList}). Bitte Verbindung prüfen und erneut versuchen.`
    );
  }

  // 2. Setup canvas
  onProgress?.({
    phase: "preloading",
    current: totalToLoad,
    total: totalToLoad,
    message: "Bereite Leinwand vor…",
  });
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingQuality = "high";

  // 3. Setup audio — non-blocking: a hung music fetch won't freeze the
  // render, the audio mixer has its own 10 s timeout and we fall back to
  // a silent render if it fails.
  onProgress?.({
    phase: "preloading",
    current: totalToLoad,
    total: totalToLoad,
    message: "Lade Musik…",
  });
  const track = findTrack(storyboard.music_track_id) ?? pickDefaultTrack(storyboard.mood);
  let mixer: AudioMixerHandle | null = null;
  try {
    mixer = await createAudioMixer(track.file);
  } catch (e) {
    console.warn("[slideshow] music load failed, rendering silent:", e);
    mixer = null;
  }
  checkAbort();

  // 4. Setup MediaRecorder
  const fps = 30;
  const videoStream = canvas.captureStream(fps);
  const combined = combineStreams(videoStream, mixer?.audioStream ?? null);

  // Prefer MP4 (WhatsApp/iOS-compatible); fall back to WebM (Chrome desktop).
  const supportedTypes = [
    "video/mp4;codecs=h264,aac",
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType = supportedTypes.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) {
    mixer?.destroy();
    throw new Error("Browser unterstützt MediaRecorder nicht");
  }

  const chunks: Blob[] = [];
  // 2.5 Mbps keeps a 60 s 1080×1920 film well under 20 MB (including
  // audio + container) so uploads to the 50 MB `slideshows` bucket
  // don't fail even if the film runs slightly long.
  const recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stoppedPromise = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  // 5. Render loop — three phases: intro cover (5s), storyboard (variable), end (3.5s)
  const storyboardMs = totalDuration(storyboard);
  const totalMs = INTRO_MS + storyboardMs + END_MS;
  recorder.start(250);
  if (mixer) {
    try {
      await mixer.context.resume();
      mixer.start();
      // Schedule music fade-out during end phase
      const endPhaseStartSec = (INTRO_MS + storyboardMs) / 1000;
      mixer.fadeOut(endPhaseStartSec, END_MS / 1000);
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

      // Background fill (always)
      ctx.filter = "none";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // --- PHASE 1: Intro cover (0..INTRO_MS) ---
      if (elapsed < INTRO_MS) {
        if (introCoverImg) {
          if (storyboard.film_style === "journal") {
            drawJournalScene(ctx, introCoverImg, W, H, "", agendaTitle, agendaDateLabel);
            drawDarkOverlay(ctx, W, H, 0.16);
          } else {
            drawCoverImage(ctx, introCoverImg, W, H, "static", 0);
            ctx.filter = "none";
            drawDarkOverlay(ctx, W, H, storyboard.film_style === "recap" ? 0.3 : 0.45);
          }
        } else {
          drawGradient(ctx, W, H, storyboard.mood);
        }
        if (storyboard.film_style === "recap") {
          drawRecapChrome(ctx, W, H, agendaTitle, agendaDateLabel, 0, storyboard.scenes.length, 1);
        }
        // Title animation: cover alone 0-3s, fade in 3.0-4.5s, hold 4.5-6s
        const titleAlpha = elapsed < 3000 ? 0 : elapsed < 4500 ? (elapsed - 3000) / 1500 : 1;
        if (titleAlpha > 0) {
          ctx.globalAlpha = titleAlpha;
          drawCenteredText(ctx, storyboard.intro.text, W, H * 0.5, format === "portrait" ? 92 : 80, "800");
          ctx.globalAlpha = 1;
        }
        // Crossfade out in the last 300ms of the intro
        const introRemain = INTRO_MS - elapsed;
        if (introRemain < 350) {
          ctx.fillStyle = `rgba(0,0,0,${1 - introRemain / 350})`;
          ctx.fillRect(0, 0, W, H);
        }
        await new Promise((r) => setTimeout(r, 1000 / fps));
        continue;
      }

      // --- PHASE 3: End screen (after storyboard) ---
      if (elapsed >= INTRO_MS + storyboardMs) {
        const endElapsed = elapsed - INTRO_MS - storyboardMs;
        if (outroCoverImg) {
          if (storyboard.film_style === "journal") {
            drawJournalScene(ctx, outroCoverImg, W, H, "", agendaTitle, agendaDateLabel);
            drawDarkOverlay(ctx, W, H, 0.16);
          } else {
            drawCoverImage(ctx, outroCoverImg, W, H, "static", 0);
            ctx.filter = "none";
            drawDarkOverlay(ctx, W, H, storyboard.film_style === "recap" ? 0.3 : 0.45);
          }
        } else {
          drawGradient(ctx, W, H, storyboard.mood);
        }
        if (storyboard.film_style === "recap") {
          drawRecapChrome(
            ctx,
            W,
            H,
            agendaTitle,
            agendaDateLabel,
            storyboard.scenes.length - 1,
            storyboard.scenes.length,
            1
          );
        }
        // Fade-in "Ende" for the first 800ms, then hold, then fade to black in last 800ms
        const fadeInAlpha = Math.min(endElapsed / 800, 1);
        const fadeOutAlpha = endElapsed > END_MS - 800 ? (END_MS - endElapsed) / 800 : 1;
        const alpha = Math.max(0, Math.min(fadeInAlpha, fadeOutAlpha));
        if (alpha > 0) {
          ctx.globalAlpha = alpha;
          drawCenteredText(ctx, storyboard.outro.text, W, H / 2, format === "portrait" ? 100 : 84, "800");
          ctx.globalAlpha = 1;
        }
        await new Promise((r) => setTimeout(r, 1000 / fps));
        continue;
      }

      // --- PHASE 2: Storyboard scenes ---
      const storyElapsed = elapsed - INTRO_MS;
      const found = findSceneAt(storyboard, storyElapsed);
      if (!found) break;
      const { scene, index, sceneStart } = found;
      const localT = (storyElapsed - sceneStart) / scene.duration_ms; // 0..1

      // Crossfade alpha during last 300 ms of each scene (if next scene exists)
      const remainInScene = scene.duration_ms - (storyElapsed - sceneStart);
      const fadeMs = 350;
      const isFading = remainInScene < fadeMs && index < storyboard.scenes.length - 1;
      const fadeAlpha = isFading ? remainInScene / fadeMs : 1;

      // Draw scene
      const img = sceneImages.get(index);
      const meta = scene.content_item_id ? itemMeta.get(scene.content_item_id) : null;

      if (scene.type === "cover") {
        // LLM-generated "cover" scene inside the storyboard: render as a
        // regular photo (the title is already handled by the dedicated
        // intro phase — don't render it a second time here).
        if (img) {
          applyColorGrade(ctx, scene.color_grade);
          drawCoverImage(ctx, img, W, H, scene.effect, localT);
          ctx.filter = "none";
        } else {
          drawGradient(ctx, W, H, storyboard.mood);
        }
        // Optional per-scene overlay (no full-screen title)
        if (scene.overlay_text) {
          const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(1, "rgba(0,0,0,0.7)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, H * 0.55, W, H * 0.45);
          drawCenteredText(ctx, scene.overlay_text, W, H * 0.78, format === "portrait" ? 44 : 36, "600");
        }
      } else if (scene.type === "photo" || scene.type === "video") {
        if (img) {
          if (storyboard.film_style === "journal") {
            drawJournalScene(
              ctx,
              img,
              W,
              H,
              scene.overlay_text,
              agendaTitle,
              agendaDateLabel
            );
          } else {
            applyColorGrade(ctx, scene.color_grade);
            drawCoverImage(ctx, img, W, H, scene.effect, localT);
            ctx.filter = "none";
          }
        } else {
          drawGradient(ctx, W, H, storyboard.mood);
        }
        if (storyboard.film_style === "recap") {
          drawRecapChrome(
            ctx,
            W,
            H,
            agendaTitle,
            agendaDateLabel,
            index,
            storyboard.scenes.length,
            localT
          );
        }
        if (scene.type === "video" && storyboard.film_style !== "journal") {
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
        if (storyboard.film_style !== "journal") {
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
          // Author badge is part of the personal postcard style. The recap
          // keeps the frame cleaner and uses its persistent day marker.
          if (storyboard.film_style === "postcard") {
            const avatar = meta?.author_avatar_url ? avatarImages.get(meta.author_avatar_url) ?? null : null;
            drawAuthorBadge(ctx, W, H, meta?.author_name ?? null, avatar);
          }
        }
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
  const extension: "mp4" | "webm" = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  return { blob, durationMs: totalMs, width: W, height: H, mimeType, extension };
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
    const durationMs = Math.max(SLIDESHOW_MIN_SCENE_MS, snapped - cursor);
    newScenes.push({ ...sc, duration_ms: durationMs });
    cursor += durationMs;
  }
  return { ...sb, scenes: newScenes };
}
