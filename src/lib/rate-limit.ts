// In-memory store — per-instance on Vercel serverless. Acceptable for MVP.
// For production scale, replace with Upstash Redis or Vercel KV.
const requests = new Map<string, number[]>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30; // max 30 POST requests per minute per IP

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requests.get(ip) ?? [];

  // Remove expired timestamps
  const valid = timestamps.filter((t) => now - t < WINDOW_MS);

  if (valid.length >= MAX_REQUESTS) {
    requests.set(ip, valid);
    return true;
  }

  valid.push(now);
  requests.set(ip, valid);
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
