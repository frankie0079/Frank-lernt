export interface StoragePathRef {
  bucket: string;
  path: string;
}

export function parseSupabaseStorageUrl(url: string | null | undefined): StoragePathRef | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return null;

    const after = parsed.pathname.slice(idx + marker.length);
    const parts = after.split("/").filter(Boolean);
    if (parts[0] === "public" || parts[0] === "sign") {
      parts.shift();
    }
    const bucket = parts.shift();
    if (!bucket || parts.length === 0) return null;

    return {
      bucket,
      path: decodeURIComponent(parts.join("/")),
    };
  } catch {
    return null;
  }
}

export function uniqueStoragePaths(urls: Array<string | null | undefined>): StoragePathRef[] {
  const seen = new Set<string>();
  const refs: StoragePathRef[] = [];

  for (const url of urls) {
    const ref = parseSupabaseStorageUrl(url);
    if (!ref) continue;

    const key = `${ref.bucket}/${ref.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }

  return refs;
}
