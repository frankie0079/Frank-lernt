/**
 * Robust network error detection.
 * Checks multiple signals instead of relying on a single fragile pattern.
 */
export function isNetworkError(err: unknown): boolean {
  // Browser reports offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  // TypeError from fetch (network failure, DNS, CORS preflight blocked by offline)
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("fetch") ||
      msg.includes("network") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("load failed") // Safari
    ) {
      return true;
    }
  }

  // DOMException from AbortController or network timeout
  if (err instanceof DOMException && err.name === "AbortError") {
    return true;
  }

  return false;
}
