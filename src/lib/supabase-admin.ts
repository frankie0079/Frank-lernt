import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for SERVER-SIDE use only.
 *
 * Required because the 20260408_lockdown_anon_rls migration revokes anon
 * SELECT on members, events, event_members, agenda_items and content_items
 * to close the BUG-1 account-takeover vector (members.token was world-
 * readable via the anon REST endpoint). Server routes that previously
 * relied on the anon client to read these tables (cookie-based token
 * validation, /api/events/*, /api/members/*, etc.) must now use the
 * service-role key, which bypasses RLS.
 *
 * NEVER import this from a Client Component or anything that ships to the
 * browser. The service-role key is a master key for the project.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "getSupabaseAdmin: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }
  // Note: intentionally untyped (no <Database> generic) because
  // src/lib/database.types.ts is stale (v1 tables only). Matches the existing
  // ambient typing of the previous anon createClient calls.
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
