# PROJ-24: Auth & User-Accounts

## Status: In Review
**Created:** 2026-03-08
**Last Updated:** 2026-04-04

## Dependencies
- Keine (Basis-Feature)

## User Stories
- Als Organisator möchte ich Mitglieder anlegen und jedem einen persönlichen Link per WhatsApp schicken können.
- Als Teilnehmer möchte ich einen Link klicken und sofort eingeloggt sein — ohne Passwort, E-Mail oder App-Download.
- Als Nutzer möchte ich einen Anzeigenamen und optionales Profilfoto setzen können, damit andere mich im Content-Pool erkennen.
- Als eingeloggter Nutzer möchte ich mich abmelden können.
- Als nicht-eingeloggter Besucher möchte ich öffentliche Event-Seiten sehen können, ohne mich anzumelden.

## Acceptance Criteria
- [x] Organisator kann Mitglieder anlegen via `POST /api/members` (Zod-validiert)
- [x] Jedes Mitglied bekommt einen einzigartigen persönlichen Link (`/join/[token]`)
- [x] Link klicken → httpOnly Cookie setzen → sofort eingeloggt auf `/events`
- [x] Nutzer kann Display-Name (max 50 Zeichen) setzen und speichern
- [x] Nutzer kann optionales Profilfoto hochladen (Supabase Storage, Bucket: `avatars`)
- [x] Session bleibt nach App-Neustart bestehen (httpOnly Cookie, 30 Tage)
- [x] Geschützte Routen (`/events/*`, `/profile`) leiten nicht-eingeloggte Nutzer zur Login-Seite weiter
- [x] Öffentliche Routen (`/e/*`, `/join/*`) funktionieren vollständig ohne Login
- [x] Abmelden löscht Cookie und leitet zur Login-Seite (`/login`) weiter
- [x] Profil-Seite unter `/profile` zum Bearbeiten von Name und Foto
- [x] "Anonym" als Fallback-Anzeigename wenn kein Name gesetzt
- [x] Token wird nie an den Browser/Client gesendet (nur httpOnly Cookie)
- [x] Profil-Updates gehen über `/api/members/me` (IDOR-geschützt)
- [x] Rate Limiting auf POST/PATCH Endpunkten

## Edge Cases
- Ungültiger Token-Link → Fehlermeldung "Dieser Link ist ungueltig" + Hinweis "Frag den Organisator"
- Profilfoto > 2 MB → Fehlermeldung "Bild zu groß (max. 2 MB)" vor dem Upload
- Profilfoto falsches Format (nicht JPEG/PNG/WebP) → Fehlermeldung "Nur JPEG, PNG und WebP erlaubt"
- Display-Name leer gelassen → "Anonym" als Fallback in allen Ansichten
- Cookie abgelaufen oder gelöscht → Middleware leitet zu `/login` weiter
- Ungültiges Cookie (Token existiert nicht mehr in DB) → Cookie löschen, redirect zu `/login`

## Technical Requirements
- Token-basierte Links (kein Supabase Auth, kein Magic Link, keine E-Mail)
- `members` Tabelle in Supabase (id, name, token, role, avatar_url, created_at, updated_at)
- RLS enabled auf `members` Tabelle
- `src/middleware.ts` prüft `member_token` httpOnly Cookie gegen DB
- `/api/members/me` für sichere Profil-Updates (GET eigenes Profil, PATCH Name/Avatar, DELETE sign-out)
- `/api/members` für Organisator-Verwaltung (GET Liste, POST neues Mitglied)
- Storage Bucket `avatars`: public read, 2MB Limit, JPEG/PNG/WebP
- Profilfoto-Kompression client-side (max 400px, < 200 KB) vor Upload
- Zod-Schema für Profil-Validierung (display_name max 50 Zeichen)
- Rate Limiting via `src/lib/rate-limit.ts`

---

## Tech Design

### Übersicht
Foundation-Feature: Token-basierte persönliche Links + `members` Tabelle + Route-Schutz via Middleware. Alle v2-Features bauen darauf auf.

### Auth-Flow
```
1. Organisator erstellt Mitglied → POST /api/members → bekommt Join-Link
2. Organisator schickt Link per WhatsApp an Freund
3. Freund klickt /join/[token] → httpOnly Cookie gesetzt → redirect /events
4. AuthProvider ruft /api/members/me → bekommt Member-Daten (ohne Token!)
5. Profil bearbeiten: PATCH /api/members/me (Server validiert Token aus Cookie)
```

### Komponenten-Struktur
```
App Shell (Layout-Level)
+-- AuthProvider (wraps entire app — fetches /api/members/me)
|
/login
+-- Info-Seite ("Du brauchst einen Einladungslink")
+-- Fehlermeldung bei ungültigem Link

/join/[token] (Route Handler)
+-- Token validieren → Cookie setzen → /events

/profile (geschützt)
+-- ProfilePage
    +-- AvatarUpload (Upload → Supabase Storage → PATCH /api/members/me)
    +-- DisplayNameForm (PATCH /api/members/me)
    +-- AbmeldenButton (DELETE /api/members/me)

/events (geschützt)
+-- Events Dashboard mit Profil-Avatar

Middleware (serverseitig)
+-- Prüft member_token Cookie gegen DB
+-- Schützt /events/*, /profile → Redirect zu /login
+-- Öffentlich: /, /join/*, /e/*, /touren/*
```

### Datenmodell

**`members` Tabelle (live):**
- id: UUID (PK, auto-generated)
- name: TEXT (optional, max 50 Zeichen → Fallback "Anonym")
- token: TEXT (unique, auto-generated 32 hex chars)
- role: TEXT ('organizer' | 'admin' | 'member')
- avatar_url: TEXT (Link zu Supabase Storage)
- created_at, updated_at: TIMESTAMPTZ (auto-managed)
- RLS enabled, auto-updated_at Trigger

**Storage Bucket `avatars` (live):**
- Öffentlich lesbar, 2MB Limit, JPEG/PNG/WebP
- Pfad: `{member-id}/avatar.jpg` (überschreibt bei Update)

### API-Endpunkte

| Methode | Route | Auth | Beschreibung |
|---------|-------|------|-------------|
| GET | /api/members | member | Mitgliederliste |
| POST | /api/members | organizer | Neues Mitglied anlegen (+ Join-Link) |
| GET | /api/members/me | member | Eigenes Profil (ohne Token) |
| PATCH | /api/members/me | member | Name/Avatar updaten |
| DELETE | /api/members/me | any | Abmelden (Cookie löschen) |

### Sicherheit
- Token wird NIE an Client gesendet (httpOnly Cookie, /api/members/me gibt Token nicht zurück)
- Profil-Updates nur über eigenen Token möglich (kein IDOR)
- Rate Limiting auf mutating Endpunkten (POST, PATCH)
- Middleware validiert Token gegen DB bei jedem Request

## QA Test Results

### Previous Test Run: 2026-04-04 (Round 1)
**7 Bugs found, all fixed in commit ce5c3dc.**

### Test Run: 2026-04-04 (Round 2 -- Full Re-Test)
**Tested:** 2026-04-04
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS (Next.js 16.1.1, compiles without errors)

---

### Acceptance Criteria Status

#### AC-1: Organisator kann Mitglieder anlegen via POST /api/members (Zod-validiert)
- [x] POST /api/members requires authentication (401 without cookie)
- [x] POST /api/members requires organizer role (403 for non-organizers)
- [x] Zod validates name (required, min 1, max 50) and role (enum)
- [x] Returns join link for WhatsApp sharing
- [x] Rate limiting applied

#### AC-2: Jedes Mitglied bekommt einen einzigartigen persoenlichen Link (/join/[token])
- [x] Token is auto-generated (32 hex chars, unique constraint in DB)
- [x] Join link returned in POST response as `joinLink`

#### AC-3: Link klicken -> httpOnly Cookie setzen -> sofort eingeloggt auf /events
- [x] GET /join/[token] validates token against DB
- [x] Sets httpOnly cookie with secure=true in production, sameSite=lax
- [x] Redirects to /events on success
- [x] maxAge set to 30 days

#### AC-4: Nutzer kann Display-Name (max 50 Zeichen) setzen und speichern
- [x] PATCH /api/members/me accepts name field
- [x] Zod schema validates max 50 chars server-side
- [x] Client-side maxLength=50 on input
- [x] Character counter shown in UI

#### AC-5: Nutzer kann optionales Profilfoto hochladen (Supabase Storage, Bucket: avatars)
- [x] Client-side file type validation (JPEG/PNG/WebP)
- [x] Client-side file size validation (2 MB limit)
- [x] Client-side image compression (max 400px, 200KB)
- [x] Upload to Supabase Storage with upsert
- [x] PATCH /api/members/me updates avatar_url

#### AC-6: Session bleibt nach App-Neustart bestehen (httpOnly Cookie, 30 Tage)
- [x] Cookie maxAge: 60 * 60 * 24 * 30 = 2592000 seconds (30 days)
- [x] httpOnly: true prevents JavaScript access

#### AC-7: Geschuetzte Routen leiten nicht-eingeloggte Nutzer zur Login-Seite weiter
- [x] Middleware checks member_token cookie
- [x] Redirects to /login with redirect parameter
- [x] Protected routes: everything except /, /join/*, /e/*, /touren/*

#### AC-8: Oeffentliche Routen funktionieren ohne Login
- [x] /, /join/*, /e/*, /touren/* bypass middleware auth check

#### AC-9: Abmelden loescht Cookie und leitet zur Login-Seite
- [x] DELETE /api/members/me clears member_token cookie
- [x] AuthProvider sets member to null and redirects to /login

#### AC-10: Profil-Seite unter /profile zum Bearbeiten von Name und Foto
- [x] ProfilePage renders AvatarUpload and DisplayNameForm
- [x] Shows role badge, back navigation to /events
- [x] Loading skeleton while auth loads

#### AC-11: "Anonym" als Fallback-Anzeigename wenn kein Name gesetzt
- [x] Events page: `member.name ?? "Anonym"` on line 69
- [x] Avatar fallback: shows User icon when no name

#### AC-12: Token wird nie an den Browser/Client gesendet (nur httpOnly Cookie)
- [x] GET /api/members/me selects: id, name, role, avatar_url, created_at, updated_at (no token)
- [x] GET /api/members selects: id, name, role, avatar_url, created_at (no token)
- [x] PATCH /api/members/me response selects without token
- [ ] **BUG-8:** POST /api/members returns token in member object (see below)

#### AC-13: Profil-Updates gehen ueber /api/members/me (IDOR-geschuetzt)
- [x] PATCH /api/members/me resolves member ID from cookie token, not from request body
- [x] No user-supplied ID parameter that could be manipulated

#### AC-14: Rate Limiting auf POST/PATCH Endpunkten
- [x] POST /api/members: rate limited
- [x] PATCH /api/members/me: rate limited
- [x] 20 requests per minute per IP

---

### Edge Cases Status

#### EC-1: Ungueltiger Token-Link
- [x] /join/[invalid-token] redirects to /login?error=invalid_link
- [x] Login page shows "Dieser Link ist ungueltig" alert

#### EC-2: Profilfoto > 2 MB
- [x] Client-side check: file.size > AVATAR_MAX_SIZE_BYTES shows error
- [x] Error message: "Bild zu gross (max. 2 MB)."

#### EC-3: Profilfoto falsches Format
- [x] Client-side check validates MIME type against AVATAR_ALLOWED_TYPES
- [x] Error message: "Nur JPEG, PNG und WebP erlaubt."

#### EC-4: Display-Name leer gelassen
- [x] Empty string sent as null via trim() || null
- [x] "Anonym" used as fallback in UI

#### EC-5: Cookie abgelaufen oder geloescht
- [x] Middleware redirects to /login when no cookie present

#### EC-6: Ungueltiges Cookie (Token nicht mehr in DB)
- [x] Middleware validates token against DB
- [x] Deletes cookie and redirects to /login if token invalid

---

### Cross-Browser & Responsive (Code Review)

Note: This is a code-level audit. Manual browser testing should be performed in a running environment.

#### Responsive Design
- [x] Login page: max-w-md with px-4 padding, centers on all sizes
- [x] Profile page: max-w-md with px-4 padding
- [x] Events page: max-w-2xl with px-4 padding
- [x] All pages use min-h-screen for proper vertical filling

#### Accessibility
- [x] ARIA labels on avatar link, back navigation, file input
- [x] aria-hidden on decorative icons (Lucide icons)
- [x] Semantic HTML: headings, buttons, links
- [x] Form labels with shadcn/ui Form components

---

### Security Audit Results (Red Team)

#### Authentication
- [x] Cannot access protected routes without valid cookie
- [x] Cookie is httpOnly, sameSite=lax, secure in production
- [x] Middleware validates token against DB on every request
- [x] Invalid tokens are cleared from cookies

#### Authorization
- [x] POST /api/members restricted to organizer role
- [x] PATCH /api/members/me uses token-based identity (no IDOR possible)
- [x] Member list returns safe fields only (no tokens)

#### Input Validation
- [x] Zod validation on all POST/PATCH endpoints
- [x] Client-side validation on file type and size
- [x] maxLength on name input
- [x] JSON parse errors handled gracefully (.catch(() => null))

#### Rate Limiting
- [x] Applied on POST /api/members and PATCH /api/members/me
- [ ] **BUG-9:** No rate limiting on /join/[token] (see below)
- [ ] **BUG-10:** Rate limit uses x-forwarded-for which is spoofable (see below)
- [ ] **BUG-11:** In-memory rate limit resets per serverless instance (see below)

#### Security Headers
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] Referrer-Policy: origin-when-cross-origin
- [x] Strict-Transport-Security with includeSubDomains

#### Data Exposure
- [ ] **BUG-8:** POST /api/members response includes raw token (see below)
- [ ] **BUG-12:** getCurrentMember uses select("*") exposing token in server memory (see below)

---

### Bugs Found

#### BUG-8: POST /api/members returns token in member object
- **Severity:** Medium
- **Steps to Reproduce:**
  1. As organizer, call POST /api/members with valid body
  2. Response JSON contains `member.token` field alongside `joinLink`
  3. Expected: Only `joinLink` should contain the token; `member` object should omit it
  4. Actual: Token exposed in both `member.token` AND `joinLink`
- **File:** `src/app/api/members/route.ts` line 101: `.select("id, name, token, role, created_at")`
- **Impact:** The organizer already receives the token via joinLink, so the redundant `member.token` is unnecessary exposure. If the member list response were ever cached or logged, tokens could leak.
- **Priority:** Fix before deployment

#### BUG-9: No rate limiting on /join/[token] route
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send rapid GET requests to /join/[random-token]
  2. Expected: Rate limited after N attempts
  3. Actual: Unlimited attempts, each hitting the database
- **File:** `src/app/join/[token]/route.ts` -- no rate limit check
- **Impact:** Tokens are 128-bit (32 hex chars), so brute-force is computationally infeasible. However, an attacker could cause excessive DB queries. Defense-in-depth would add rate limiting.
- **Priority:** Nice to have

#### BUG-10: Rate limit bypassed via x-forwarded-for spoofing
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send POST /api/members with header `X-Forwarded-For: 1.2.3.4`
  2. After 20 requests, change to `X-Forwarded-For: 5.6.7.8`
  3. Expected: Rate limit applied per real client IP
  4. Actual: Rate limit bypassed by rotating spoofed IPs
- **File:** `src/lib/rate-limit.ts` line 23-28
- **Impact:** Any rate-limited endpoint can be attacked at unlimited speed by rotating the x-forwarded-for header. On Vercel, the real IP is in a different header or Vercel strips/overrides x-forwarded-for, so this may be partially mitigated in production. Needs verification.
- **Priority:** Fix in next sprint

#### BUG-11: In-memory rate limit ineffective on serverless (Vercel)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Deploy to Vercel (serverless functions)
  2. Send rapid requests -- each may hit a different serverless instance
  3. Expected: Rate limit applied globally
  4. Actual: Rate limit state is per-instance and resets on cold starts
- **File:** `src/lib/rate-limit.ts` line 1: `const requests = new Map<string, number[]>()`
- **Impact:** Rate limiting is essentially non-functional in a serverless deployment. For a v1/MVP this is acceptable, but should be replaced with a distributed store (e.g., Vercel KV, Upstash Redis) before scaling.
- **Priority:** Fix in next sprint

#### BUG-12: getCurrentMember helper uses select("*") leaking token into server memory
- **Severity:** Low
- **Steps to Reproduce:**
  1. Review `src/app/api/members/route.ts` line 23 and `src/app/api/events/route.ts` line 19
  2. `getCurrentMember` fetches all columns including `token`
  3. Expected: Only fetch needed columns (id, role)
  4. Actual: Token loaded into server memory unnecessarily
- **Impact:** Not directly exploitable since data stays server-side. However, if error logging or tracing captures request context, tokens could appear in logs. Principle of least privilege violation.
- **Priority:** Nice to have

---

### Regression Check

- [x] Build succeeds (no TypeScript errors)
- [x] v1 routes (/touren/*) still in build output and functional
- [x] Layout wraps all pages with AuthProvider
- [x] Security headers applied to all routes

---

### Summary
- **Acceptance Criteria:** 13/14 passed, 1 partial (AC-12: token in POST response)
- **Edge Cases:** 6/6 passed
- **Bugs Found:** 5 total (0 critical, 0 high, 3 medium, 2 low)
- **Security:** Generally solid. Medium-severity issues around rate limiting and token exposure in POST response.
- **Production Ready:** YES (conditionally)
- **Recommendation:** Fix BUG-8 (strip token from member object in POST response) before deployment. BUG-10 and BUG-11 (rate limiting) are acceptable for MVP but should be addressed before scaling. BUG-9 and BUG-12 are nice-to-have improvements.

## Deployment
_To be added by /deploy_
