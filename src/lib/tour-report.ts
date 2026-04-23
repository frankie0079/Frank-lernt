/**
 * PROJ-41 — Tour-Report renderer.
 *
 * Pure Canvas rendering: takes event meta + stats + GPS polyline, returns
 * a 1200×1200 PNG Blob. No DOM dependencies beyond a canvas surface.
 *
 * Uses OffscreenCanvas when available (faster, main-thread-friendlier) and
 * falls back to a throwaway HTMLCanvasElement otherwise.
 */

export interface TourReportStats {
  distanceM: number;
  activeDurationMs: number;
  avgSpeedKmh: number;
  elevationGainM: number;
  elevationLossM: number;
}

export interface TourReportInput {
  eventName: string;
  date: Date;
  stats: TourReportStats;
  points: Array<{ lat: number; lng: number }>;
}

const CANVAS_SIZE = 1200;
const HEADER_HEIGHT = 200;
const MAP_HEIGHT = 600;
const STATS_HEIGHT = 400; // CANVAS_SIZE - HEADER - MAP = 400 (sanity: 200 + 600 + 400 = 1200)

const MAP_PADDING = 40;
const MAP_BG = "#f3f4f6";
const ROUTE_COLOR = "#0d9488"; // tailwind teal-600
const START_COLOR = "#16a34a"; // tailwind green-600
const END_COLOR = "#dc2626"; // tailwind red-600

const TEXT_PRIMARY = "#0f172a"; // slate-900
const TEXT_SECONDARY = "#64748b"; // slate-500
const CARD_BG = "#ffffff";
const PAGE_BG = "#ffffff";
const DIVIDER = "#e5e7eb"; // gray-200

/**
 * Format distance for display: <1 km → "950 m", else "12.3 km".
 */
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) {
    return `${Math.round(distanceM)} m`;
  }
  return `${(distanceM / 1000).toFixed(1)} km`;
}

/**
 * Format duration as "Hh Mm" or "Mm Ss" if < 1 hour.
 */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

export function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(1)} km/h`;
}

/**
 * Format a caption for the content item — short single-line summary.
 */
export function formatTourCaption(stats: TourReportStats): string {
  return `🗺️ Tour: ${formatDistance(stats.distanceM)} · ${formatDuration(stats.activeDurationMs)} · ↑${Math.round(stats.elevationGainM)}m ↓${Math.round(stats.elevationLossM)}m`;
}

/**
 * Ramer-Douglas-Peucker simplification. Reduces a polyline to a minimum
 * set of points within ε degrees perpendicular distance.
 */
function simplifyRDP(
  points: Array<{ lat: number; lng: number }>,
  epsilon: number
): Array<{ lat: number; lng: number }> {
  if (points.length < 3) return points;

  const sqrEps = epsilon * epsilon;

  // Perpendicular distance^2 of p from line (a, b).
  function sqrPerpDist(
    p: { lat: number; lng: number },
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
  ): number {
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      const ddx = p.lng - a.lng;
      const ddy = p.lat - a.lat;
      return ddx * ddx + ddy * ddy;
    }
    const t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq;
    const tClamped = Math.max(0, Math.min(1, t));
    const projX = a.lng + tClamped * dx;
    const projY = a.lat + tClamped * dy;
    const ex = p.lng - projX;
    const ey = p.lat - projY;
    return ex * ex + ey * ey;
  }

  // Iterative RDP — avoids call-stack blow-up on very long tracks.
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    let maxSq = 0;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = sqrPerpDist(points[i], points[lo], points[hi]);
      if (d > maxSq) {
        maxSq = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxSq > sqrEps) {
      keep[idx] = true;
      stack.push([lo, idx]);
      stack.push([idx, hi]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"):
    | (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D)
    | null;
}

function createCanvas(size: number): CanvasLike {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(size, size);
  }
  const el = document.createElement("canvas");
  el.width = size;
  el.height = size;
  return el;
}

async function canvasToBlob(canvas: CanvasLike): Promise<Blob> {
  // OffscreenCanvas has convertToBlob; HTMLCanvasElement has toBlob (callback-based).
  const anyCanvas = canvas as unknown as {
    convertToBlob?: (opts?: { type?: string; quality?: number }) => Promise<Blob>;
    toBlob?: (
      cb: (blob: Blob | null) => void,
      type?: string,
      quality?: number
    ) => void;
  };
  if (typeof anyCanvas.convertToBlob === "function") {
    return anyCanvas.convertToBlob({ type: "image/png", quality: 0.95 });
  }
  if (typeof anyCanvas.toBlob === "function") {
    return new Promise((resolve, reject) => {
      anyCanvas.toBlob!(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("canvas.toBlob returned null"));
        },
        "image/png",
        0.95
      );
    });
  }
  throw new Error("No canvas-to-blob API available");
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Renders the tour report PNG and returns a Blob.
 */
export async function renderTourReport(input: TourReportInput): Promise<Blob> {
  const canvas = createCanvas(CANVAS_SIZE);
  const ctxMaybe = canvas.getContext("2d");
  if (!ctxMaybe) {
    throw new Error("Canvas 2D context not available");
  }
  // Rebind to a non-null const so inner closures can rely on the narrowed
  // type without TypeScript widening it back to `| null`.
  const ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D =
    ctxMaybe;

  // Page background
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // ── Header ──────────────────────────────────────────────────────────
  // Caveat isn't reliably available inside a canvas context (even when
  // loaded by next/font for the DOM). Use a tolerant font stack — if
  // Caveat is resolved it looks great, otherwise the system serif
  // fallback still reads well.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const eventTitle = input.eventName.trim() || "Tour";
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "700 72px 'Caveat', 'Dancing Script', 'Segoe Script', cursive";
  // Auto-shrink title if it overflows.
  let titleFontSize = 72;
  ctx.font = `700 ${titleFontSize}px 'Caveat', 'Dancing Script', 'Segoe Script', cursive`;
  while (
    ctx.measureText(eventTitle).width > CANVAS_SIZE - 120 &&
    titleFontSize > 40
  ) {
    titleFontSize -= 4;
    ctx.font = `700 ${titleFontSize}px 'Caveat', 'Dancing Script', 'Segoe Script', cursive`;
  }
  ctx.fillText(eventTitle, CANVAS_SIZE / 2, 80);

  const dateStr = input.date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "400 28px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(dateStr, CANVAS_SIZE / 2, 140);

  // Divider
  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(120, HEADER_HEIGHT - 8);
  ctx.lineTo(CANVAS_SIZE - 120, HEADER_HEIGHT - 8);
  ctx.stroke();

  // ── Map card ────────────────────────────────────────────────────────
  const mapX = MAP_PADDING;
  const mapY = HEADER_HEIGHT + 20;
  const mapW = CANVAS_SIZE - MAP_PADDING * 2;
  const mapH = MAP_HEIGHT - 40;

  ctx.fillStyle = MAP_BG;
  drawRoundedRect(ctx, mapX, mapY, mapW, mapH, 24);
  ctx.fill();

  // Decide how to render the path
  const rawPoints = input.points.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180
  );

  const hasRoute = rawPoints.length >= 2;

  if (!hasRoute) {
    // Nothing to draw — show placeholder text
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "400 32px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText("Kein Routenverlauf", CANVAS_SIZE / 2, mapY + mapH / 2);
  } else {
    // Simplify if the raw polyline is huge.
    const pointsForDraw =
      rawPoints.length > 2000 ? simplifyRDP(rawPoints, 0.00005) : rawPoints;

    // Bounding box
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    for (const p of pointsForDraw) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    const latSpan = Math.max(1e-6, maxLat - minLat);
    const lngSpan = Math.max(1e-6, maxLng - minLng);

    // If the points all collapse to a single spot (total extent < ~10m), show placeholder.
    // 0.00009 deg ≈ 10 m in latitude.
    const collapsed = latSpan < 0.00009 && lngSpan < 0.00009;
    if (collapsed) {
      ctx.fillStyle = TEXT_SECONDARY;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "400 32px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.fillText("Kein Routenverlauf", CANVAS_SIZE / 2, mapY + mapH / 2);
    } else {
      const drawPad = 40;
      const drawX = mapX + drawPad;
      const drawY = mapY + drawPad;
      const drawW = mapW - drawPad * 2;
      const drawH = mapH - drawPad * 2;

      const scaleLng = drawW / lngSpan;
      const scaleLat = drawH / latSpan;
      const scale = Math.min(scaleLng, scaleLat);
      const offsetX = drawX + (drawW - lngSpan * scale) / 2;
      const offsetY = drawY + (drawH - latSpan * scale) / 2;

      const project = (p: { lat: number; lng: number }) => ({
        x: offsetX + (p.lng - minLng) * scale,
        // Invert Y — higher lat = further north = higher on screen.
        y: offsetY + (maxLat - p.lat) * scale,
      });

      // Draw polyline
      ctx.strokeStyle = ROUTE_COLOR;
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      const first = project(pointsForDraw[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pointsForDraw.length; i++) {
        const { x, y } = project(pointsForDraw[i]);
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Start / End markers — use raw endpoints, not simplified, so they
      // match the actual start/end of the tour.
      const startP = project(rawPoints[0]);
      const endP = project(rawPoints[rawPoints.length - 1]);

      const drawMarker = (
        x: number,
        y: number,
        color: string,
        letter: string
      ) => {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 16px system-ui, -apple-system, 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, x, y + 1);
      };

      drawMarker(startP.x, startP.y, START_COLOR, "A");
      drawMarker(endP.x, endP.y, END_COLOR, "B");
    }
  }

  // ── Stats grid (bottom 400px) ──────────────────────────────────────
  const statsTop = HEADER_HEIGHT + MAP_HEIGHT;
  const statsBlockPad = 40;
  const statsX = statsBlockPad;
  const statsY = statsTop + 10;
  const statsW = CANVAS_SIZE - statsBlockPad * 2;
  const statsH = STATS_HEIGHT - 30;

  ctx.fillStyle = CARD_BG;
  drawRoundedRect(ctx, statsX, statsY, statsW, statsH, 20);
  ctx.fill();
  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, statsX, statsY, statsW, statsH, 20);
  ctx.stroke();

  // 2 rows × 3 columns, but row 1 has 3 cells (Distanz, Dauer, Ø-Speed) and
  // row 2 has 2 wide cells (Aufstieg, Abstieg).
  const cellPad = 20;
  const row1Top = statsY + cellPad;
  const row1Height = 160;
  const row2Top = row1Top + row1Height + 20;
  const row2Height = statsH - (row1Top - statsY) - row1Height - 20 - cellPad;

  const innerW = statsW - cellPad * 2;
  const row1CellW = innerW / 3;
  const row2CellW = innerW / 2;

  function drawStat(
    label: string,
    value: string,
    cx: number,
    cy: number,
    valueSize: number,
    labelSize: number,
    valueColor = TEXT_PRIMARY
  ) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = valueColor;
    ctx.font = `700 ${valueSize}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    ctx.fillText(value, cx, cy - labelSize / 2 - 4);
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = `500 ${labelSize}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    ctx.fillText(label, cx, cy + valueSize / 2 + 2);
  }

  // Row 1
  const row1CY = row1Top + row1Height / 2;
  drawStat(
    "Distanz",
    formatDistance(input.stats.distanceM),
    statsX + cellPad + row1CellW * 0.5,
    row1CY,
    60,
    22
  );
  drawStat(
    "Dauer",
    formatDuration(input.stats.activeDurationMs),
    statsX + cellPad + row1CellW * 1.5,
    row1CY,
    60,
    22
  );
  drawStat(
    "Ø-Speed",
    formatSpeed(input.stats.avgSpeedKmh),
    statsX + cellPad + row1CellW * 2.5,
    row1CY,
    60,
    22
  );

  // Row 2
  const row2CY = row2Top + row2Height / 2;
  drawStat(
    "Aufstieg",
    `+${Math.round(input.stats.elevationGainM)} m`,
    statsX + cellPad + row2CellW * 0.5,
    row2CY,
    56,
    22,
    START_COLOR
  );
  drawStat(
    "Abstieg",
    `-${Math.round(input.stats.elevationLossM)} m`,
    statsX + cellPad + row2CellW * 1.5,
    row2CY,
    56,
    22,
    END_COLOR
  );

  return canvasToBlob(canvas);
}
