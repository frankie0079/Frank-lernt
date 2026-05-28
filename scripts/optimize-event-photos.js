/* eslint-disable no-console */

const fs = require("node:fs/promises");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const EVENT_SLUG = process.argv[2] || "hong-kong-april-2026";
const EXECUTE = process.argv.includes("--execute");
const MAX_FULL_EDGE = 1600;
const MAX_THUMB_EDGE = 400;
const FULL_QUALITY = 76;
const THUMB_QUALITY = 75;

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  return fs
    .readFile(envPath, "utf8")
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match) process.env[match[1]] = match[2];
      }
    })
    .catch(() => {});
}

function parseStorageUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    const parts = parsed.pathname
      .slice(markerIndex + marker.length)
      .split("/")
      .filter(Boolean);
    if (parts[0] === "public" || parts[0] === "sign") parts.shift();
    const bucket = parts.shift();
    if (!bucket || parts.length === 0) return null;
    return { bucket, path: decodeURIComponent(parts.join("/")) };
  } catch {
    return null;
  }
}

async function blobToBuffer(blob) {
  return Buffer.from(await blob.arrayBuffer());
}

async function downloadObject(supabase, ref) {
  const { data, error } = await supabase.storage.from(ref.bucket).download(ref.path);
  if (error) throw error;
  return blobToBuffer(data);
}

async function optimizeImage(buffer, maxEdge, quality) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality,
      mozjpeg: true,
    })
    .toBuffer();
}

async function backupObject(backupRoot, ref, buffer) {
  const target = path.join(backupRoot, ref.bucket, ref.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
}

async function uploadObject(supabase, ref, buffer) {
  const { error } = await supabase.storage.from(ref.bucket).upload(ref.path, buffer, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
}

function mb(bytes) {
  return +(bytes / 1024 / 1024).toFixed(2);
}

async function main() {
  await loadEnv();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, slug")
    .eq("slug", EVENT_SLUG)
    .single();
  if (eventError || !event) throw eventError || new Error(`Event not found: ${EVENT_SLUG}`);

  const { data: items, error: itemError } = await supabase
    .from("content_items")
    .select("id, media_url, thumbnail_url")
    .eq("event_id", event.id)
    .eq("type", "photo")
    .order("created_at", { ascending: true });
  if (itemError) throw itemError;

  const backupRoot = path.join(
    process.cwd(),
    "storage-backups",
    `${EVENT_SLUG}-${new Date().toISOString().replace(/[:.]/g, "-")}`
  );
  const manifest = {
    event,
    execute: EXECUTE,
    created_at: new Date().toISOString(),
    full: { max_edge: MAX_FULL_EDGE, quality: FULL_QUALITY },
    thumbnail: { max_edge: MAX_THUMB_EDGE, quality: THUMB_QUALITY },
    items: [],
    skipped: [],
  };

  let originalBytes = 0;
  let optimizedBytes = 0;
  let optimizedObjects = 0;

  for (const item of items || []) {
    const mediaRef = parseStorageUrl(item.media_url);
    const thumbRef = parseStorageUrl(item.thumbnail_url);
    if (!mediaRef || mediaRef.bucket !== "media") {
      manifest.skipped.push({ id: item.id, reason: "media_url is not a media storage URL" });
      continue;
    }

    try {
      const mediaOriginal = await downloadObject(supabase, mediaRef);
      const mediaOptimizedCandidate = await optimizeImage(mediaOriginal, MAX_FULL_EDGE, FULL_QUALITY);
      const mediaOptimized =
        mediaOptimizedCandidate.length < mediaOriginal.length ? mediaOptimizedCandidate : mediaOriginal;

      let thumbOriginal = null;
      let thumbOptimized = null;
      if (thumbRef?.bucket === "media") {
        thumbOriginal = await downloadObject(supabase, thumbRef);
        const thumbOptimizedCandidate = await optimizeImage(mediaOriginal, MAX_THUMB_EDGE, THUMB_QUALITY);
        thumbOptimized =
          thumbOptimizedCandidate.length < thumbOriginal.length ? thumbOptimizedCandidate : thumbOriginal;
      }

      originalBytes += mediaOriginal.length + (thumbOriginal?.length ?? 0);
      optimizedBytes += mediaOptimized.length + (thumbOptimized?.length ?? 0);

      if (EXECUTE) {
        await backupObject(backupRoot, mediaRef, mediaOriginal);
        if (thumbRef && thumbOriginal) await backupObject(backupRoot, thumbRef, thumbOriginal);
        await uploadObject(supabase, mediaRef, mediaOptimized);
        if (thumbRef && thumbOptimized) await uploadObject(supabase, thumbRef, thumbOptimized);
      }

      optimizedObjects += 1 + (thumbRef && thumbOriginal ? 1 : 0);
      manifest.items.push({
        id: item.id,
        media_path: mediaRef.path,
        thumbnail_path: thumbRef?.path ?? null,
        media_original_bytes: mediaOriginal.length,
        media_optimized_bytes: mediaOptimized.length,
        thumbnail_original_bytes: thumbOriginal?.length ?? null,
        thumbnail_optimized_bytes: thumbOptimized?.length ?? null,
      });
      console.log(
        `${manifest.items.length}/${items.length}: ${item.id} ${mb(mediaOriginal.length)} MB -> ${mb(
          mediaOptimized.length
        )} MB`
      );
    } catch (error) {
      manifest.skipped.push({
        id: item.id,
        reason: error instanceof Error ? error.message : String(error),
      });
      console.warn(`Skipped ${item.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  await fs.mkdir(backupRoot, { recursive: true });
  await fs.writeFile(path.join(backupRoot, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        event,
        execute: EXECUTE,
        backupRoot: EXECUTE ? backupRoot : `${backupRoot} (manifest only; no objects written in dry-run)`,
        photoItems: items?.length ?? 0,
        optimizedObjects,
        skipped: manifest.skipped.length,
        originalMb: mb(originalBytes),
        optimizedMb: mb(optimizedBytes),
        savedMb: mb(originalBytes - optimizedBytes),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
