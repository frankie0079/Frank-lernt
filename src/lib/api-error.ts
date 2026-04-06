import { NextResponse } from "next/server";

/**
 * Returns a sanitized 500 response without leaking database internals to the
 * client. The original error is logged server-side so it remains debuggable in
 * Vercel logs, but the user-facing message stays generic.
 *
 * Use this instead of `NextResponse.json({ error: err.message }, { status: 500 })`.
 */
export function serverError(
  context: string,
  error: unknown
): NextResponse {
  console.error(`[api:${context}]`, error);
  return NextResponse.json(
    { error: "Ein interner Fehler ist aufgetreten." },
    { status: 500 }
  );
}
