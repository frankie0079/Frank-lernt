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
  actions: {
    cleanup: StorageBucketSummary;
    slideshows: StorageBucketSummary;
    videos: StorageBucketSummary & {
      protectedFiles: number;
      protectedBytes: number;
    };
  };
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

function addFileSummary(summary: StorageBucketSummary, file: Pick<StorageFileInfo, "size">) {
  summary.files += 1;
  summary.bytes += file.size;
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

async function getBookContentIds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventId: string
): Promise<Set<string>> {
  const { data: pages } = await supabase
    .from("book_pages")
    .select("id")
    .eq("event_id", eventId);

  const pageIds = (pages ?? []).map((page: { id: string }) => page.id);
  if (pageIds.length === 0) return new Set();

  const [oldItems, sections] = await Promise.all([
    supabase
      .from("book_page_items")
      .select("content_item_id")
      .in("page_id", pageIds),
    supabase
      .from("book_sections")
      .select("id")
      .in("page_id", pageIds),
  ]);

  const contentIds = new Set<string>();
  for (const item of oldItems.data ?? []) {
    const id = (item as { content_item_id: string | null }).content_item_id;
    if (id) contentIds.add(id);
  }

  const sectionIds = (sections.data ?? []).map((section: { id: string }) => section.id);
  if (sectionIds.length > 0) {
    const { data: sectionItems } = await supabase
      .from("book_section_items")
      .select("content_item_id")
      .in("section_id", sectionIds);
    for (const item of sectionItems ?? []) {
      const id = (item as { content_item_id: string | null }).content_item_id;
      if (id) contentIds.add(id);
    }
  }

  return contentIds;
}

function refsForContentItem(item: { media_url: string | null; thumbnail_url: string | null }) {
  return uniqueStoragePaths([item.media_url, item.thumbnail_url]);
}

async function getVideoStorageAction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventId: string,
  files: StorageFileInfo[]
) {
  const { data: videos } = await supabase
    .from("content_items")
    .select("id, media_url, thumbnail_url")
    .eq("event_id", eventId)
    .eq("type", "video");

  const bookContentIds = await getBookContentIds(supabase, eventId);
  const fileByKey = new Map(files.map((file) => [`${file.bucket}/${file.path}`, file]));
  const deletable = { files: 0, bytes: 0 };
  const protectedSummary = { files: 0, bytes: 0 };

  for (const video of videos ?? []) {
    const item = video as { id: string; media_url: string | null; thumbnail_url: string | null };
    const summary = bookContentIds.has(item.id) ? protectedSummary : deletable;
    for (const ref of refsForContentItem(item)) {
      const file = fileByKey.get(`${ref.bucket}/${ref.path}`);
      if (file) addFileSummary(summary, file);
    }
  }

  return {
    files: deletable.files,
    bytes: deletable.bytes,
    protectedFiles: protectedSummary.files,
    protectedBytes: protectedSummary.bytes,
  };
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
  const slideshowSummary = files
    .filter((file) => file.category === "slideshows")
    .reduce<StorageBucketSummary>((sum, file) => {
      addFileSummary(sum, file);
      return sum;
    }, { files: 0, bytes: 0 });
  const videoAction = await getVideoStorageAction(supabase, eventId, files);
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
    actions: {
      cleanup: {
        files: cleanupCandidates.length,
        bytes: cleanupBytes,
      },
      slideshows: slideshowSummary,
      videos: videoAction,
    },
    files,
  };
}

async function removeStorageFiles(files: Array<Pick<StorageFileInfo, "bucket" | "path">>) {
  const supabase = getSupabaseAdmin();
  const byBucket = new Map<string, string[]>();
  for (const file of files) {
    const paths = byBucket.get(file.bucket) ?? [];
    paths.push(file.path);
    byBucket.set(file.bucket, paths);
  }

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

export async function cleanupEventStorage(eventId: string, execute: boolean) {
  const report = await buildEventStorageReport(eventId);
  if (!report) return null;

  if (execute) {
    await removeStorageFiles(report.cleanupCandidates);
  }

  return {
    execute,
    deleted: execute ? report.cleanupCandidates.length : 0,
    candidates: report.cleanupCandidates,
    bytes: report.totals.cleanupBytes,
  };
}

export async function deleteEventSlideshows(eventId: string) {
  const supabase = getSupabaseAdmin();
  const report = await buildEventStorageReport(eventId);
  if (!report) return null;

  const candidates = report.files.filter((file) => file.category === "slideshows");
  const { error } = await supabase
    .from("daily_reports")
    .update({
      slideshow_url: null,
      slideshow_published_at: null,
      slideshow_duration_sec: null,
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);
  if (error) throw error;

  await removeStorageFiles(candidates);

  return {
    deleted: candidates.length,
    bytes: candidates.reduce((sum, file) => sum + file.size, 0),
  };
}

export async function deleteEventVideosNotInBook(eventId: string) {
  const supabase = getSupabaseAdmin();
  const report = await buildEventStorageReport(eventId);
  if (!report) return null;

  const bookContentIds = await getBookContentIds(supabase, eventId);
  const { data: videos } = await supabase
    .from("content_items")
    .select("id, media_url, thumbnail_url")
    .eq("event_id", eventId)
    .eq("type", "video");

  const deletable = (videos ?? []).filter((video: { id: string }) => !bookContentIds.has(video.id));
  const storageRefs = deletable.flatMap((video: { media_url: string | null; thumbnail_url: string | null }) =>
    refsForContentItem(video)
  );

  const fileByKey = new Map(report.files.map((file) => [`${file.bucket}/${file.path}`, file]));
  const storageFiles = storageRefs
    .map((ref) => fileByKey.get(`${ref.bucket}/${ref.path}`) ?? ref)
    .filter((file): file is StorageFileInfo | { bucket: string; path: string } => Boolean(file));

  await removeStorageFiles(storageFiles);

  if (deletable.length > 0) {
    const ids = deletable.map((video: { id: string }) => video.id);
    const { error } = await supabase
      .from("content_items")
      .delete()
      .in("id", ids)
      .eq("event_id", eventId)
      .eq("type", "video");
    if (error) throw error;
  }

  return {
    deleted: deletable.length,
    files: storageFiles.length,
    bytes: storageFiles.reduce((sum, file) => sum + ("size" in file ? file.size : 0), 0),
    protected: videos ? videos.length - deletable.length : 0,
  };
}
