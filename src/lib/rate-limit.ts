// In-memory store — per-instance on Vercel serverless. Acceptable for MVP.
// For production scale, replace with Upstash Redis or Vercel KV.
const requests = new Map<string, number[]>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_WRITE_REQUESTS = 30; // max 30 POST/DELETE requests per minute per IP
const MAX_READ_REQUESTS = 60; // max 60 GET requests per minute per IP

export function isRateLimited(ip: string, type: "read" | "write" = "write"): boolean {
  const key = `${type}:${ip}`;
  const limit = type === "read" ? MAX_READ_REQUESTS : MAX_WRITE_REQUESTS;
  const now = Date.now();
  const timestamps = requests.get(key) ?? [];

  // Remove expired timestamps
  const valid = timestamps.filter((t) => now - t < WINDOW_MS);

  if (valid.length >= limit) {
    requests.set(key, valid);
    return true;
  }

  valid.push(now);
  requests.set(key, valid);
  return false;
}

/**
 * Per-arbitrary-key rate limiter (e.g. per member-id).
 * Use this for spec-defined per-user limits like "5 comments per minute per user".
 */
export function isKeyRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number = WINDOW_MS
): boolean {
  const now = Date.now();
  const timestamps = requests.get(key) ?? [];
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= maxRequests) {
    requests.set(key, valid);
    return true;
  }

  valid.push(now);
  requests.set(key, valid);
  return false;
}

export function getRateLimitIp(request: Request): string {
  // Prefer Vercel's trusted header (cannot be spoofed by clients)
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
