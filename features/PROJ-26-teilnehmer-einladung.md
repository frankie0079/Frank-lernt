# PROJ-26: Teilnehmer-Einladung & Member-Management

## Status: In Review
**Created:** 2026-03-08
**Last Updated:** 2026-04-04

## Dependencies
- Requires: PROJ-24 (Auth & User-Accounts) — Eingeladene Person muss eingeloggt sein, um beizutreten
- Requires: PROJ-25 (Event-Erstellung & -Verwaltung) — Event muss existieren

## User Stories
- Als Organisator möchte ich Einladungslinks generieren, damit ich sie per WhatsApp oder Email teilen kann.
- Als eingeladene Person möchte ich dem Event über den Einladungslink beitreten.
- Als Organisator möchte ich die Teilnehmerliste sehen und Mitglieder entfernen können.
- Als Teilnehmer möchte ich sehen, wer sonst noch dabei ist.

## Acceptance Criteria
- [ ] Einladungslink ist 7 Tage gültig (Ablaufzeitpunkt in DB gespeichert)
- [ ] Link-Format: `/join/[token]` — Token ist kryptographisch sicherer Zufallsstring (32 Zeichen)
- [ ] Klick auf Link → Login-Check: falls nicht eingeloggt → Login-Seite mit `?redirect=/join/[token]` → nach Login automatisch beitreten
- [ ] Teilnehmerliste zeigt: Avatar, Anzeigename, Rolle (`organizer` | `admin` | `member`), Beitrittsdatum
- [ ] Teilnehmerliste ist nur für Mitglieder sichtbar (nicht öffentlich)
- [ ] Organisator kann Teilnehmer per Klick entfernen (Bestätigungs-Dialog)
- [ ] Organisator kann sich selbst nicht entfernen (Button deaktiviert)
- [ ] Max. 50 Teilnehmer pro Event → Fehlermeldung "Maximale Teilnehmerzahl (50) erreicht" bei Überschreitung
- [ ] Organisator kann neuen Einladungslink generieren → alter Link wird sofort invalidiert
- [ ] Kopiier-Button für den Einladungslink (Web Clipboard API)
- [ ] Einladungslink-Bereich in den Event-Einstellungen unter `/events/[id]/settings`

## Edge Cases
- Bereits Mitglied klickt Link → Toast-Meldung "Du bist bereits Mitglied dieses Events" + Weiterleitung zu `/events/[id]`
- Link abgelaufen (> 7 Tage) → Fehlerseite "Diese Einladung ist nicht mehr gültig. Bitte den Organisator um einen neuen Link."
- Link ungültig (manuell manipuliert) → 404-Fehlerseite
- 50. Teilnehmer tritt bei → Erfolg; 51. Teilnehmer → Fehlermeldung
- Teilnehmer verlässt Event (oder wird entfernt) → Alle Beiträge bleiben bestehen (`author_id` bleibt erhalten, Profilname bleibt sichtbar)
- Organisator entfernt sich versehentlich → Nicht möglich (serverseitige Prüfung)
- Einladungslink wird öffentlich gepostet → Max-Teilnehmer-Limit schützt vor Missbrauch
- Nutzer befindet sich offline beim Klick auf Einladungslink → Offline-Hinweis mit Aufforderung, sich zu verbinden

## Technical Requirements
- Supabase Tabellen: `invitations` (id UUID PK, event_id UUID FK events CASCADE, token TEXT UNIQUE, created_by UUID FK auth.users, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
- Supabase Tabellen: `event_members` (id UUID PK, event_id UUID FK events CASCADE, user_id UUID FK auth.users, role TEXT CHECK (role IN ('organizer','admin','member')), joined_at TIMESTAMPTZ)
- UNIQUE Constraint auf `event_members(event_id, user_id)`
- RLS auf `invitations`: SELECT + INSERT für Organisator, SELECT für `/join/[token]` Route (public via service role)
- RLS auf `event_members`: SELECT für Mitglieder, INSERT via `/join` Route, DELETE für Organisator (nicht eigene Zeile)
- Token-Generierung: `crypto.randomBytes(24).toString('base64url')` in Server-Action
- Einladungslink-Ablauf: Server-seitige Prüfung `expires_at > NOW()`
- Teilnehmer-Zählung vor Beitritt: `SELECT COUNT(*) FROM event_members WHERE event_id = $1`
- Zod-Validierung für alle API-Routen

---

## Tech Design (Solution Architect)

### URL-Entscheidung: `/invite/[token]` statt `/join/[token]`

Die Spec nennt `/join/[token]`, aber diese Route ist bereits für die **Mitglieder-Authentifizierung** (persönlicher Login-Link) belegt. Event-Einladungen bekommen eine eigene Route:

```
/invite/[token]   ← NEU: Event-Einladungslinks
/join/[token]     ← BESTEHEND: Persönlicher Login-Link (bleibt unverändert)
```

Einladungslinks, die per WhatsApp geteilt werden, haben also das Format:
`https://app.example.com/invite/[32-Zeichen-Token]`

---

### Component Structure

```
/events/[id]/settings  (neue Seite — nur Organisator)
+-- SettingsHeader (Zurück zu /events/[id])
+-- InvitationLinkCard
|   +-- Link-Anzeige (URL + maskiert)
|   +-- CopyButton (Web Clipboard API)
|   +-- ShareButton (WhatsApp — bestehende Komponente!)
|   +-- ExpiryBadge ("Gültig noch X Tage")
|   +-- "Neuen Link generieren"-Button → AlertDialog (Bestätigung)
+-- EventMemberList
    +-- MemberRow (×N)
    |   +-- Avatar (shadcn)
    |   +-- Anzeigename + Rolle-Badge (organizer | admin | member)
    |   +-- Beitrittsdatum
    |   +-- "Entfernen"-Button (deaktiviert für Organisator selbst)
    +-- EmptyState (falls noch keine Mitglieder außer Organisator)

/invite/[token]  (neue Server-Route — Redirect-Logik)
  Eingeloggt + gültiger Token + kein Mitglied → Event beitreten → /events/[id]
  Eingeloggt + bereits Mitglied          → Toast + /events/[id]
  Eingeloggt + abgelaufener Token        → Fehlerseite
  NICHT eingeloggt                       → /login?redirect=/invite/[token]

/events/[id]  (bestehende Seite — minimale Ergänzung)
+-- [Organisator-only] "Einstellungen"-Tab oder Link → /events/[id]/settings
```

---

### Neue Datenbank-Tabellen

**`invitations`** — speichert aktive Einladungslinks pro Event

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | UUID PK | Primärschlüssel |
| event_id | UUID FK → events | Welches Event |
| token | TEXT UNIQUE | 32-Zeichen Zufallsstring (base64url) |
| created_by | UUID FK → members | Wer hat den Link generiert |
| expires_at | TIMESTAMPTZ | Ablaufzeit (7 Tage ab Erstellung) |
| created_at | TIMESTAMPTZ | Erstellungszeitpunkt |

Regel: Pro Event nur **ein aktiver Link** — bei "Neu generieren" wird der alte Datensatz überschrieben (UPSERT per event_id).

**`event_members`** — wer ist in welchem Event

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | UUID PK | Primärschlüssel |
| event_id | UUID FK → events CASCADE | Welches Event |
| member_id | UUID FK → members CASCADE | Wer |
| role | TEXT | 'organizer' \| 'admin' \| 'member' |
| joined_at | TIMESTAMPTZ | Beitrittszeitpunkt |

UNIQUE Constraint auf `(event_id, member_id)` — niemand kann doppelt beitreten.

---

### Neue API-Routen

| Route | Methode | Wer darf | Was passiert |
|-------|---------|----------|--------------|
| `/api/events/[id]/invitations` | GET | Organisator | Aktuellen Einladungslink abrufen |
| `/api/events/[id]/invitations` | POST | Organisator | Neuen Link generieren (alter wird invalidiert) |
| `/api/events/[id]/members` | GET | Event-Mitglied | Teilnehmerliste abrufen |
| `/api/events/[id]/members/[memberId]` | DELETE | Organisator | Mitglied entfernen (nicht sich selbst) |
| `/api/invite/[token]` | POST | Eingeloggtes Mitglied | Event beitreten |

---

### Sicherheits-Logik

- **Token-Generierung:** `crypto.randomBytes(24).toString('base64url')` → 32-Zeichen, kryptographisch sicher
- **Ablauf-Prüfung:** Server prüft `expires_at > NOW()` bei jedem Beitrittsversuch
- **Max-50-Grenze:** Vor dem Beitritt zählt der Server `COUNT(*) FROM event_members WHERE event_id = ?`
- **Selbst-Entfernen:** Server prüft ob `member_id = requesting_member_id` → 403
- **RLS (Row Level Security):**
  - `invitations`: Nur Organisator darf INSERT/SELECT — `/invite`-Route nutzt Service-Role-Key
  - `event_members`: SELECT für alle Event-Mitglieder, INSERT via `/invite`-Route, DELETE nur Organisator

---

### Wiederverwendete Komponenten

| Komponente | Wo | Zweck |
|------------|-----|-------|
| `ShareButton` | `src/components/share-button.tsx` | WhatsApp-Teilen des Einladungslinks |
| `Avatar` | shadcn/ui ✅ | Mitglieder-Avatar in der Liste |
| `Badge` | shadcn/ui ✅ | Rollen-Badge (organizer/admin/member) |
| `AlertDialog` | shadcn/ui ✅ | Bestätigung vor Link-Regenerierung und Mitglieder-Entfernung |
| `Table` | shadcn/ui ✅ | Teilnehmerliste |
| `Sheet` | shadcn/ui ✅ | ggf. Mobile-Ansicht der Member-Liste |

---

### Neue Komponenten

| Komponente | Datei | Zweck |
|------------|-------|-------|
| `InvitationLinkCard` | `src/components/invitation-link-card.tsx` | Link anzeigen, kopieren, teilen, neu generieren |
| `EventMemberList` | `src/components/event-member-list.tsx` | Tabelle aller Teilnehmer mit Entfernen-Aktion |

---

### Abhängigkeiten (neue Pakete)

Keine neuen Pakete nötig — `crypto` ist Node.js-built-in, alle shadcn-Komponenten sind bereits installiert.

## QA Test Results

**Tested:** 2026-04-04
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS (compiles without errors)

---

### Acceptance Criteria Status

#### AC-1: Einladungslink ist 7 Tage gueltig (Ablaufzeitpunkt in DB gespeichert)
- [x] `POST /api/events/[id]/invitations` sets `expires_at` to `now + 7 days` (route.ts line 142-143)
- [x] `POST /api/invite/[token]` checks `expires_at > NOW()` server-side (route.ts line 68-75)
- [x] Expired link returns HTTP 410 with correct error message

#### AC-2: Link-Format: `/invite/[token]` -- Token ist kryptographisch sicherer Zufallsstring (32 Zeichen)
- [x] Token generated via `crypto.randomBytes(24).toString("base64url")` producing 32 chars
- [x] Route changed from `/join/[token]` to `/invite/[token]` per tech design decision (avoids conflict with auth join route)
- [x] Token stored as UNIQUE in `invitations` table

#### AC-3: Klick auf Link -> Login-Check: falls nicht eingeloggt -> Login-Seite mit ?redirect=/invite/[token] -> nach Login automatisch beitreten
- [x] `/invite/[token]` page redirects unauthenticated users to `/login?redirect=/invite/[token]`
- [x] Login page detects `redirect` param and shows invite-specific message ("Du wurdest zu einem Event eingeladen!")
- [ ] **BUG-1:** After login via `/join/[token]`, user is NOT redirected back to `/invite/[token]`. The `/join/[token]` route always redirects to `/events`. The redirect loop is broken.

#### AC-4: Teilnehmerliste zeigt Avatar, Anzeigename, Rolle, Beitrittsdatum
- [x] `EventMemberList` component displays Avatar (via shadcn Avatar), name, role Badge, and formatted join date
- [x] Roles shown as localized labels: Organisator, Admin, Mitglied
- [x] Joined date formatted in German locale (`de-DE`)

#### AC-5: Teilnehmerliste ist nur fuer Mitglieder sichtbar (nicht oeffentlich)
- [x] `GET /api/events/[id]/members` checks membership before returning data (returns 403 for non-members)
- [x] Settings page checks organizer status client-side and shows error for non-organizers
- [x] Middleware protects `/events/[id]/settings` route (requires valid token cookie)

#### AC-6: Organisator kann Teilnehmer per Klick entfernen (Bestaetigungs-Dialog)
- [x] AlertDialog confirmation before removal (EventMemberList lines 224-243)
- [x] `DELETE /api/events/[id]/members/[memberId]` verifies organizer status server-side
- [x] Removed member disappears from list immediately via client-side state update

#### AC-7: Organisator kann sich selbst nicht entfernen (Button deaktiviert)
- [x] Remove button hidden for organizer row in UI (`!isOrganizerMember` check, line 211)
- [x] Server-side check: `memberId === currentMember.id` returns 403 (DELETE route line 80-84)

#### AC-8: Max. 50 Teilnehmer pro Event -> Fehlermeldung bei Ueberschreitung
- [x] Server counts members before insert: `select count(*)` with `head: true` (invite route lines 108-118)
- [x] Returns HTTP 422 with message "Maximale Teilnehmerzahl (50) erreicht"
- [ ] **BUG-2:** TOCTOU race condition -- count check and insert are not atomic. Two concurrent requests could both pass the count check and both insert, exceeding 50.

#### AC-9: Organisator kann neuen Einladungslink generieren -> alter Link wird sofort invalidiert
- [x] `POST /api/events/[id]/invitations` deletes all existing invitations for the event before creating new one (lines 132-136)
- [x] AlertDialog confirmation before regeneration (InvitationLinkCard lines 210-239)
- [x] UI updates immediately with new link

#### AC-10: Kopiier-Button fuer den Einladungslink (Web Clipboard API)
- [x] Copy button uses `navigator.clipboard.writeText()` (InvitationLinkCard line 100)
- [x] Visual feedback: icon changes to checkmark for 2 seconds
- [ ] **BUG-3:** No fallback for browsers where Clipboard API is unavailable (e.g., non-HTTPS on some browsers). The `catch` block is empty -- user gets no feedback that copy failed.

#### AC-11: Einladungslink-Bereich in den Event-Einstellungen unter /events/[id]/settings
- [x] Settings page exists at `/events/[id]/settings`
- [x] InvitationLinkCard component renders in settings page
- [x] Settings link visible on event dashboard (gear icon, top-right) -- organizer only

---

### Edge Cases Status

#### EC-1: Bereits Mitglied klickt Link -> Toast "Du bist bereits Mitglied" + Weiterleitung
- [x] Server returns `already_member: true` with event info (invite route lines 99-105)
- [x] Client shows toast "Du bist bereits Mitglied dieses Events." and redirects to `/events/[id]` after 2s

#### EC-2: Link abgelaufen -> Fehlerseite
- [x] Server returns HTTP 410 for expired links
- [x] Client shows "Einladung abgelaufen" with message to contact organizer
- [x] "Zu meinen Events" button for navigation

#### EC-3: Link ungueltig (manuell manipuliert) -> 404-Fehlerseite
- [x] Server returns HTTP 404 for unknown tokens
- [x] Client shows "Ungueltiger Link" error page

#### EC-4: 50. Teilnehmer tritt bei -> Erfolg; 51. -> Fehlermeldung
- [x] Count check uses `>= 50` so the 50th member succeeds and 51st is blocked
- [x] "Event ist voll" page shown with correct message

#### EC-5: Teilnehmer verlassen/entfernt -> Beitraege bleiben bestehen
- [x] DELETE only removes `event_members` row, no cascade to content (by design -- content uses `author_id` FK)
- [x] Confirmation dialog states "Bisherige Beitraege bleiben erhalten"

#### EC-6: Organisator entfernt sich versehentlich -> Nicht moeglich
- [x] UI hides remove button for organizer role
- [x] Server returns 403 if `memberId === currentMember.id`

#### EC-7: Einladungslink wird oeffentlich gepostet -> Max-Teilnehmer-Limit schuetzt
- [x] Max 50 members enforced server-side

#### EC-8: Nutzer offline beim Klick -> Offline-Hinweis
- [x] `navigator.onLine` check before API call
- [x] "Keine Internetverbindung" page with retry button
- [x] Listens for `online` event to auto-retry

---

### Security Audit Results

#### Authentication & Authorization
- [x] All API routes check `member_token` cookie for authentication (return 401 if missing)
- [x] Invitation management (GET/POST) restricted to organizer (checks `event.organizer_id`)
- [x] Member list restricted to event members (checks `event_members` table)
- [x] Member removal restricted to organizer, with self-removal prevention
- [x] `/invite/[token]` page is public in middleware (correct -- needs to work before auth)

#### Input Validation
- [x] UUID validation on all `[id]` path parameters via regex
- [x] Token path parameter used directly in DB query (parameterized by Supabase -- safe from SQL injection)
- [ ] **BUG-4:** No Zod validation on API request bodies for invitation routes. The spec requires "Zod-Validierung fuer alle API-Routen" but `/api/events/[id]/invitations` POST and `/api/invite/[token]` POST have no body validation (they don't accept a body, so this is acceptable for these routes). However, `/api/events/[id]/members` GET has no rate limiting.

#### Rate Limiting
- [x] `POST /api/events/[id]/invitations` has rate limiting
- [x] `DELETE /api/events/[id]/members/[memberId]` has rate limiting
- [x] `POST /api/invite/[token]` has rate limiting
- [ ] **BUG-5:** `GET /api/events/[id]/members` has NO rate limiting. An attacker could enumerate event members rapidly.
- [ ] **BUG-6:** `GET /api/events/[id]/invitations` has NO rate limiting. Could be used for reconnaissance.

#### Token Security
- [x] Invitation tokens are cryptographically secure (crypto.randomBytes)
- [x] Member auth tokens are httpOnly cookies (not accessible to JavaScript)
- [x] Tokens not exposed in API responses to non-organizers

#### IDOR (Insecure Direct Object Reference)
- [x] Event access checks membership (cannot view other events' members)
- [x] Member removal checks organizer status AND event membership of target
- [ ] **BUG-7:** The `DELETE /api/events/[id]/members/[memberId]` uses `memberId` as the `member_id` field, but the self-removal check compares `memberId === currentMember.id`. If the organizer's `member_id` in `event_members` differs from their `members.id` (they should be the same by design, but worth noting), this check could be bypassed. Currently safe because the system uses the same ID, but fragile.

#### Data Leakage
- [x] Invitation tokens only visible to organizer (GET route checks organizer status)
- [x] Member profiles return only public info (name, avatar_url) -- no tokens or private data
- [ ] **BUG-8:** The `POST /api/invite/[token]` response includes `event_id` and `event_name` even for invalid states (already_member). This is by design for UX but could leak event info to anyone with a valid (even expired) token. Currently mitigated by expiry check happening first.

#### XSS
- [x] React auto-escapes rendered values -- no `dangerouslySetInnerHTML` used
- [x] Event names and member names rendered safely via JSX interpolation

#### Supabase Client Key Usage
- [ ] **BUG-9:** All API routes use `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public anon key) instead of a service role key. Per the tech design, the `/invite` route should use the service role key for RLS bypass. If RLS policies are restrictive on `invitations` and `event_members` tables, the anon key may not have INSERT permissions. This could cause silent failures in production depending on RLS configuration.

---

### Cross-Browser Testing (Code Review)
- [x] No browser-specific APIs beyond standard Web APIs (Clipboard, navigator.share, navigator.onLine)
- [x] `navigator.share` has proper fallback to WhatsApp deep link
- [x] Clipboard API has try-catch but lacks user feedback on failure (see BUG-3)
- [x] All UI built with shadcn/ui primitives (cross-browser compatible)

### Responsive Testing (Code Review)
- [x] Settings page uses `max-w-2xl` with `px-4` padding (works at 375px, 768px, 1440px)
- [x] Member list items use flex layout with `min-w-0` for truncation
- [x] Invite link uses `truncate` class for long URLs on mobile
- [x] Action buttons use `flex-wrap` for small screens

---

### Bugs Found

#### BUG-1: Redirect after login does not return to invite page
- **Severity:** High
- **Steps to Reproduce:**
  1. As an unauthenticated user, open `/invite/[valid-token]`
  2. Page redirects to `/login?redirect=/invite/[token]`
  3. User logs in via their personal `/join/[member-token]` link
  4. Expected: User returns to `/invite/[token]` and automatically joins event
  5. Actual: User lands on `/events` -- never returns to the invite link
- **Root Cause:** `/join/[token]` route (line 41) always sets `url.pathname = "/events"` and ignores any stored redirect parameter
- **Priority:** Fix before deployment -- breaks the core invite flow for new users

#### BUG-2: TOCTOU race condition on max 50 member limit
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Event has 49 members
  2. Two users click the invite link simultaneously
  3. Both requests pass the `count >= 50` check (both see 49)
  4. Both inserts succeed, resulting in 51 members
- **Root Cause:** Count check and insert are separate operations without a transaction or DB-level constraint
- **Mitigation:** The UNIQUE constraint on `(event_id, member_id)` prevents duplicate joins, but does not enforce the 50-member cap. A DB-level CHECK or trigger would be needed.
- **Priority:** Fix in next sprint (unlikely to occur with small groups, but spec says max 50)

#### BUG-3: No user feedback when clipboard copy fails
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open settings page in a browser/context where Clipboard API is unavailable
  2. Click the copy button
  3. Expected: User sees a toast or fallback behavior
  4. Actual: Nothing happens -- empty catch block
- **File:** `src/components/invitation-link-card.tsx` line 103-104
- **Priority:** Nice to have

#### BUG-4: GET /api/events/[id]/members lacks rate limiting
- **Severity:** Medium
- **Steps to Reproduce:**
  1. As an authenticated event member, send rapid repeated GET requests to `/api/events/[id]/members`
  2. Expected: Rate limiting kicks in after threshold
  3. Actual: All requests succeed without throttling
- **File:** `src/app/api/events/[id]/members/route.ts`
- **Priority:** Fix before deployment (security requirement per spec)

#### BUG-5: GET /api/events/[id]/invitations lacks rate limiting
- **Severity:** Low
- **Steps to Reproduce:**
  1. As organizer, send rapid repeated GET requests to `/api/events/[id]/invitations`
  2. Expected: Rate limiting
  3. Actual: No rate limiting
- **File:** `src/app/api/events/[id]/invitations/route.ts` GET handler
- **Priority:** Fix in next sprint (organizer-only route, lower risk)

#### BUG-6: Anon key used instead of service role key for DB operations
- **Severity:** High
- **Steps to Reproduce:**
  1. If RLS policies on `invitations` or `event_members` tables restrict INSERT/DELETE to specific roles
  2. API routes using anon key may fail silently or return permission errors
  3. The tech design specifies service role key for `/invite` route operations
- **Root Cause:** All route files use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`
- **Files:** All 4 new API route files
- **Priority:** Fix before deployment -- depends on actual RLS policies. If RLS is permissive for anon, this works but is architecturally wrong per the spec.

#### BUG-7: Invitation token exposed in GET response without expiry filtering
- **Severity:** Low
- **Steps to Reproduce:**
  1. As organizer, generate an invitation
  2. Wait for it to expire
  3. Call `GET /api/events/[id]/invitations`
  4. Expected: No invitation returned (or marked as expired)
  5. Actual: Expired invitation still returned (query orders by `created_at DESC` but does not filter by `expires_at`)
- **File:** `src/app/api/events/[id]/invitations/route.ts` line 73-79
- **Priority:** Nice to have (UI handles expiry display, but API should be clean)

---

### Summary
- **Acceptance Criteria:** 9/11 passed (2 with bugs)
- **Edge Cases:** 8/8 passed
- **Bugs Found:** 7 total (2 High, 2 Medium, 3 Low)
- **Security:** Issues found (rate limiting gaps, anon key usage)
- **Build:** PASS (compiles without errors)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (redirect flow) and BUG-6 (service role key) before deployment. BUG-4 (rate limiting on member list) should also be addressed. BUG-2 (race condition) and remaining low-severity bugs can be fixed in next sprint.

## Deployment
_To be added by /deploy_
