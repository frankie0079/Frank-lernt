import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { parseSupabaseStorageUrl, uniqueStoragePaths } from "@/lib/storage-paths";

export type StorageCategory =
  | "photos"
  | "videos"
  | "audios"
  | "slideshows"
  | "covers"
  | "avatars"
  | "orphaned"
  | "other";

export interface StorageFileInfo {
  bucket: string;
  path: string;
  size: number;
  category: StorageCategory;
  referenced: boolean;
  reason?: string;
}

export interface StorageBucketSummary {
  files: number;
  bytes: number;
}

export interface EventStorageReport {
  event: {
    id: string;
    name: string;
    slug: string | null;
  };
  totals: {
    files: number;
    bytes: number;
    referencedBytes: number;
    cleanupBytes: number;
  };
  categories: Record<StorageCategory, StorageBucketSummary>;
  warnings: string[];
  cleanupCandidates: StorageFileInfo[];
  largePhotos: StorageFileInfo[];
  files: StorageFileInfo[];
}

interface ListedStorageFile {
  bucket: string;
  path: string;
  size: number;
}

function emptySummary(): Record<StorageCategory, StorageBucketSummary> {
  return {
    photos: { files: 0, bytes: 0 },
    videos: { files: 0, bytes: 0 },
    audios: { files: 0, bytes: 0 },
    slideshows: { files: 0, bytes: 0 },
    covers: { files: 0, bytes: 0 },
    avatars: { files: 0, bytes: 0 },
    orphaned: { files: 0, bytes: 0 },
    other: { files: 0, bytes: 0 },
  };
}

function addSummary(
  categories: Record<StorageCategory, StorageBucketSummary>,
  category: StorageCategory,
  bytes: number
) {
  categories[category].files += 1;
  categories[category].bytes += bytes;
}

function categoryFromPath(bucket: string, path: string): StorageCategory {
  if (bucket === "slideshows") return "slideshows";
  if (bucket === "covers") return "covers";
  if (bucket === "avatars") return "avatars";
  if (path.includes("/videos/") || /\.(mp4|mov|webm)$/i.test(path)) return "videos";
  if (path.includes("/video-thumbs/")) return "photos";
  if (path.includes("/audio/") || /\.(webm|ogg|m4a)$/i.test(path)) return "audios";
  if (/\.(jpe?g|png|webp|heic|heif)$/i.test(path)) return "photos";
  return "other";
}

async function listBucketFiles(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bucket: string,
  prefix: string
): Promise<ListedStorageFile[]> {
  const files: ListedStorageFile[] = [];

  async function walk(path: string): Promise<void> {
    let offset = 0;
    const limit = 1000;

    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(path, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const entry of data) {
        const childPath = path ? `${path}/${entry.name}` : entry.name;
        const metadata = entry.metadata as { size?: number } | null;
        if (metadata?.size != null) {
          files.push({ bucket, path: childPath, size: metadata.size });
        } else {
          await walk(childPath);
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  await walk(prefix);
  return files;
}

async function headSize(url: string | null | undefined): Promise<number> {
  if (!url) return 0;
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return 0;
    return Number(res.headers.get("content-length") ?? 0) || 0;
  } catch {
    return 0;
  }
}

export async function buildEventStorageReport(eventId: string): Promise<EventStorageReport | null> {
  const supabase = getSupabaseAdmin();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, slug, cover_url")
    .eq("id", eventId)
    .single();
  if (eventError || !event) return null;

  const [{ data: contentItems }, { data: reports }, { data: eventMembers }] = await Promise.all([
    supabase
      .from("content_items")
      .select("id, type, media_url, thumbnail_url")
      .eq("event_id", eventId),
    supabase
      .from("daily_reports")
      .select("agenda_item_id, slideshow_url")
      .eq("event_id", eventId),
    supabase
      .from("event_members")
      .select("member_id")
      .eq("event_id", eventId),
  ]);

  const memberIds = Array.from(new Set((eventMembers ?? []).map((m: { member_id: string }) => m.member_id)));
  const { data: members } = memberIds.length
    ? await supabase.from("members").select("id, avatar_url").in("id", memberIds)
    : { data: [] };

  const referencedUrls = [
    event.cover_url,
    ...(contentItems ?? []).flatMap((item: { media_url: string | null; thumbnail_url: string | null }) => [
      item.media_url,
      item.thumbnail_url,
    ]),
    ...(reports ?? []).map((report: { slideshow_url: string | null }) => report.slideshow_url),
    ...(members ?? []).map((member: { avatar_url: string | null }) => member.avatar_url),
  ];
  const referencedRefs = uniqueStoragePaths(referencedUrls);
  const referenced = new Set(referencedRefs.map((ref) => `${ref.bucket}/${ref.path}`));

  const listed = [
    ...(await listBucketFiles(supabase, "media", eventId)),
    ...(await listBucketFiles(supabase, "slideshows", eventId)),
  ];

  const files: StorageFileInfo[] = listed.map((file) => {
    const key = `${file.bucket}/${file.path}`;
    const isReferenced = referenced.has(key);
    const category = isReferenced ? categoryFromPath(file.bucket, file.path) : "orphaned";
    return {
      ...file,
      category,
      referenced: isReferenced,
      reason: isReferenced ? undefined : "Keine Datenbankreferenz für dieses Event",
    };
  });

  const listedKeys = new Set(listed.map((file) => `${file.bucket}/${file.path}`));

  for (const ref of referencedRefs) {
    const key = `${ref.bucket}/${ref.path}`;
    if (listedKeys.has(key)) continue;

    if (ref.bucket !== "covers" && ref.bucket !== "avatars") continue;
    const originalUrl = referencedUrls.find((url) => {
      const parsed = parseSupabaseStorageUrl(url);
      return parsed?.bucket === ref.bucket && parsed.path === ref.path;
    });
    const size = await headSize(originalUrl);
    files.push({
      bucket: ref.bucket,
      path: ref.path,
      size,
      category: categoryFromPath(ref.bucket, ref.path),
      referenced: true,
    });
  }

  const categories = emptySummary();
  for (const file of files) {
    addSummary(categories, file.category, file.size);
  }

  const cleanupCandidates = files.filter((file) => !file.referenced);
  const largePhotos = files.filter(
    (file) => file.category === "photos" && file.referenced && file.size > 900 * 1024 && file.path.endsWith("-full.jpg")
  );

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const cleanupBytes = cleanupCandidates.reduce((sum, file) => sum + file.size, 0);
  const referencedBytes = totalBytes - cleanupBytes;
  const warnings: string[] = [];
  if (referencedBytes >= 500 * 1024 * 1024) warnings.push("Dieses Event liegt über 500 MB und ist für Supabase Free kritisch.");
  else if (referencedBytes >= 250 * 1024 * 1024) warnings.push("Dieses Event liegt über 250 MB. Prüfe Videos und alte Slideshows.");
  else if (referencedBytes >= 100 * 1024 * 1024) warnings.push("Dieses Event liegt über 100 MB. Für Free Storage weiter beobachten.");
  if (largePhotos.length > 0) warnings.push(`${largePhotos.length} ältere Fotos sind größer als das neue Speicherziel.`);
  if (cleanupCandidates.length > 0) warnings.push(`${cleanupCandidates.length} verwaiste Dateien können nach Prüfung bereinigt werden.`);

  return {
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug ?? null,
    },
    totals: {
      files: files.length,
      bytes: totalBytes,
      referencedBytes,
      cleanupBytes,
    },
    categories,
    warnings,
    cleanupCandidates,
    largePhotos,
    files,
  };
}

export async function cleanupEventStorage(eventId: string, execute: boolean) {
  const supabase = getSupabaseAdmin();
  const report = await buildEventStorageReport(eventId);
  if (!report) return null;

  const byBucket = new Map<string, string[]>();
  for (const file of report.cleanupCandidates) {
    const paths = byBucket.get(file.bucket) ?? [];
    paths.push(file.path);
    byBucket.set(file.bucket, paths);
  }

  if (execute) {
    for (const [bucket, paths] of byBucket) {
      for (let i = 0; i < paths.length; i += 100) {
        const chunk = paths.slice(i, i + 100);
        if (chunk.length > 0) {
          const { error } = await supabase.storage.from(bucket).remove(chunk);
          if (error) throw error;
        }
      }
    }
  }

  return {
    execute,
    deleted: execute ? report.cleanupCandidates.length : 0,
    candidates: report.cleanupCandidates,
    bytes: report.totals.cleanupBytes,
  };
}
