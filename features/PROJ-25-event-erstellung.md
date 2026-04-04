# PROJ-25: Event-Erstellung & -Verwaltung

## Status: In Review
**Created:** 2026-03-08
**Last Updated:** 2026-04-04

## Dependencies
- Requires: PROJ-24 (Auth & User-Accounts) — Organisator muss eingeloggt sein, um Events zu erstellen

## User Stories
- Als Organisator möchte ich ein Event erstellen (Name, Datum, Beschreibung, Cover-Foto), damit Teilnehmer einen gemeinsamen Raum haben.
- Als Organisator möchte ich eine Agenda mit Tagesabschnitten (Datum, Titel, Beschreibung) erstellen, damit der Content strukturiert wird.
- Als Organisator möchte ich täglich einen Tages-Admin zuweisen können, damit die Kuration rotiert.
- Als Organisator möchte ich ein Event archivieren können wenn es abgeschlossen ist.
- Als Teilnehmer möchte ich alle Events sehen, zu denen ich eingeladen bin.

## Acceptance Criteria
- [ ] Event-Felder: Name (max 100 Zeichen, Pflicht), Beschreibung (max 500 Zeichen, optional), Startdatum (Pflicht), Enddatum (Pflicht), Cover-Foto (optional)
- [ ] Event-URL: `/events/[id]` — ID ist UUID, kein lesbarer Slug (Datenschutz)
- [ ] Öffentliche URL: `/e/[slug]` — slug wird aus Event-Name generiert (lowercase, Bindestriche)
- [ ] Agenda: Pro Event 1–30 Tages-Abschnitte, jeder mit Datum (Pflicht) + Titel (max 80 Zeichen, Pflicht) + optionaler Beschreibung (max 300 Zeichen)
- [ ] Tages-Admin-Zuweisung: Organisator kann pro Agenda-Eintrag einen Teilnehmer (aus Mitgliederliste) als Admin zuweisen
- [ ] Event-Liste auf `/events` zeigt nur Events, in denen der eingeloggte Nutzer Mitglied ist
- [ ] Event-Status: `planned` | `active` | `archived` — wird automatisch anhand von Datum gesetzt (cron oder on-read)
- [ ] Nur Organisator kann Event-Details bearbeiten (Name, Beschreibung, Cover-Foto, Agenda)
- [ ] Nur Organisator kann Event archivieren
- [ ] Cover-Foto ohne Angabe → Platzhalter-Gradient (Teal/Amber basierend auf Event-Name-Hash)
- [ ] Event-Erstellungsformular mit Zod-Validierung (client + server)
- [ ] Nach Erstellung wird Organisator automatisch als erstes Mitglied eingetragen (Rolle: `organizer`)

## Edge Cases
- Enddatum vor Startdatum → Validierungsfehler "Enddatum muss nach Startdatum liegen"
- Enddatum gleich Startdatum → Erlaubt (eintägiges Event)
- Cover-Foto > 5 MB → Fehlermeldung vor Upload, client-seitige Kompression (max 1920px)
- Event-Name führt zu Slug-Kollision → Zufälliges Suffix anhängen (z.B. `-2`)
- 0 Agenda-Einträge → Erlaubt, Beiträge werden ohne Tages-Zuordnung gespeichert
- 30+ Agenda-Einträge → Validierungsfehler "Maximal 30 Tages-Abschnitte"
- Event löschen → Bestätigungs-Dialog mit Text "Alle Beiträge, Fotos und Kommentare werden unwiderruflich gelöscht", alle Daten werden per CASCADE gelöscht
- Organisator ändert Tages-Admin-Zuweisung rückwirkend → Neuer Admin kann Entwurf des Vorgängers weiterbearbeiten
- Teilnehmer öffnet `/events/[fremdeId]` → 403 Forbidden (nicht Mitglied)

## Technical Requirements
- Supabase Tabellen: `events` (id UUID PK, name TEXT, description TEXT, start_date DATE, end_date DATE, cover_url TEXT, slug TEXT UNIQUE, status TEXT, organizer_id UUID FK auth.users, created_at TIMESTAMPTZ)
- Supabase Tabellen: `agenda_items` (id UUID PK, event_id UUID FK events CASCADE, date DATE, title TEXT, description TEXT, admin_user_id UUID FK profiles nullable, sort_order INT, created_at TIMESTAMPTZ)
- RLS auf `events`: SELECT für Mitglieder, INSERT für authentifizierte Nutzer, UPDATE/DELETE nur für Organisator
- RLS auf `agenda_items`: SELECT für Event-Mitglieder, INSERT/UPDATE/DELETE nur für Organisator
- Zod-Schema für Event-Validierung und Agenda-Validierung
- Slug-Generierung: `event-name-lowercased` → Kollisionsprüfung → ggf. `-2`, `-3` Suffix
- Cover-Foto: Supabase Storage Bucket `covers` (public read, authentifiziertes Write)
- `unstable_cache` für Event-Daten (selten geändert, 60s Revalidierung)

---

## Tech Design (Solution Architect)

### Component Structure

```
/events (existing — enhanced)
+-- EventsHeader (title + avatar)
+-- [Organizer only] Button "Event erstellen" → /events/new
+-- EventList
|   +-- EventCard (×N)
|       +-- CoverImage (Foto oder Gradient-Fallback)
|       +-- StatusBadge (planned / active / archived)
|       +-- EventMeta (Datum, Teilnehmer-Anzahl)
+-- EmptyState (wenn keine Events)

/events/new (neu)
+-- EventCreateForm
|   +-- Step 1: Basis-Infos
|   |   +-- Name-Input (max 100 Zeichen)
|   |   +-- Beschreibung-Textarea (max 500 Zeichen, optional)
|   |   +-- Datepicker: Startdatum + Enddatum
|   |   +-- CoverPhotoUploader (optional, max 5 MB → client-komprimiert)
|   +-- Step 2: Agenda
|       +-- AgendaItemList
|       |   +-- AgendaItemRow (Datum + Titel + Beschreibung) ×N
|       +-- "Tages-Abschnitt hinzufügen"-Button
|       +-- "Ohne Agenda erstellen"-Link

/events/[id] (neu — Event-Dashboard-Shell)
+-- EventHeader (Cover, Name, Dates, StatusBadge)
+-- EventNav (Tabs: Beiträge | Pool | Admin | Buch)
+-- [Organizer only] EditButton → opens EditSheet
+-- EventBody (Placeholder — Inhalte kommen in PROJ-27/28)

EventEditSheet (Slide-over)
+-- Gleiche Felder wie Create-Form
+-- AgendaEditor (Abschnitte hinzufügen/entfernen/sortieren)
+-- "Event archivieren"-Button (mit Bestätigungs-Dialog)
+-- "Event löschen"-Button (mit Warntext-Dialog)
```

### Data Model

**Neue Tabelle: `events`**
- id (UUID, PK), name (max 100), description (max 500), start_date, end_date
- cover_url (Storage → `covers` Bucket), slug (einmalig, aus Name generiert)
- organizer_id (FK → members), created_at

**Status on-read berechnet** (kein gespeichertes Feld):
- Heute < start_date → `planned`
- Heute zwischen start und end → `active`
- Heute > end_date → `archived`

**Neue Tabelle: `agenda_items`**
- id (UUID), event_id (FK → events, CASCADE), date, title (max 80)
- description (max 300, optional), admin_member_id (FK → members, nullable), sort_order

**Neue Tabelle: `event_members`** *(Minimal — PROJ-26 erweitert)*
- event_id (FK → events), member_id (FK → members), role (`organizer` | `member`)
- Bei Erstellung: Organisator wird automatisch eingetragen

**Storage Bucket: `covers`** (neu) — public read, authenticated write, max 5 MB

### Tech Decisions

| Entscheidung | Warum |
|---|---|
| Status on-read berechnen | Kein Cron nötig. Datum ändert sich nicht rückwirkend. |
| Slug aus Name generiert | Lesbare öffentliche URL `/e/wanderung-alpen-2026`. Kollision → `-2` Suffix. |
| Cover-Kompression client-seitig | Bestehende `photo-upload.ts` Library wiederverwenden. |
| Gradient-Fallback | Name-Hash → deterministischer Teal/Amber Gradient. |
| Multi-Step Form | Schritt 1 (Basis) + Schritt 2 (Agenda) — weniger Überwältigung auf Mobile. |
| `unstable_cache` für Events | Events ändern sich selten. 60s Cache reduziert DB-Last. |
| Sheet für Bearbeiten | Kein separates Edit-Route — Slide-over hält Kontext sichtbar. |

### API-Struktur

| Methode | Route | Wer | Zweck |
|---|---|---|---|
| GET | `/api/events` | Eingeloggte Mitglieder | Meine Events (nur wo ich Mitglied bin) |
| POST | `/api/events` | Eingeloggte Mitglieder | Event erstellen + Agenda + Organisator-Mitglied |
| GET | `/api/events/[id]` | Event-Mitglieder | Event-Details + Agenda |
| PATCH | `/api/events/[id]` | Nur Organisator | Bearbeiten |
| DELETE | `/api/events/[id]` | Nur Organisator | Löschen (CASCADE) |

### Wiederverwendete Komponenten

- `photo-upload.ts` — EXIF + Kompression + Upload für Cover-Foto
- `avatar-upload.tsx` — Upload-Pattern als Referenz
- `auth-provider.tsx` — `useAuth()` für Rollen-Prüfung

### Neue Dependencies

- `@dnd-kit/core` + `@dnd-kit/sortable` — Drag & Drop für Agenda-Reihenfolge
- `date-fns` — Datums-Formatierung + Status-Berechnung
- `react-hook-form` + `zod` — bereits installiert

## QA Test Results

**Tested:** 2026-04-04
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build Status:** PASS (npm run build succeeds, no TypeScript errors)

### Acceptance Criteria Status

#### AC-1: Event-Felder (Name max 100, Beschreibung max 500, Startdatum, Enddatum, Cover-Foto)
- [x] Name field present with max 100 chars, required -- Zod + HTML maxLength enforced
- [x] Description field present with max 500 chars, optional -- Zod + HTML maxLength enforced
- [x] Start date field present, required -- Zod validated
- [x] End date field present, required -- Zod validated
- [x] Cover photo field present, optional -- CoverPhotoUploader component
- [x] Character counters shown for name and description

#### AC-2: Event-URL /events/[id] with UUID
- [x] Route exists at `src/app/events/[id]/page.tsx`
- [x] UUID validation in API route via `isValidUUID()` regex
- [x] Non-UUID IDs return 400 error

#### AC-3: Oeffentliche URL /e/[slug]
- [x] Slug is generated from event name via `generateSlug()` and stored in DB
- [x] Slug collision handling with `-2`, `-3` suffixes (up to `-100`, then timestamp fallback)
- [ ] BUG: The `/e/[slug]` route does not exist yet (deferred to PROJ-35, but AC says it should exist)

#### AC-4: Agenda (1-30 Tages-Abschnitte)
- [x] Agenda items can be added with date, title, description
- [x] Max 30 items enforced in Zod schema and UI (button hidden at 30, message shown)
- [x] 0 agenda items allowed ("Ohne Agenda erstellen" supported)
- [x] Agenda item date constrained to event date range in calendar picker

#### AC-5: Tages-Admin-Zuweisung
- [ ] BUG: No UI or API support for assigning a Tages-Admin per agenda item. The `admin_member_id` field exists in the data model but there is no way to set it.

#### AC-6: Event-Liste auf /events zeigt nur eigene Events
- [x] GET `/api/events` filters by event_members where member_id matches current user
- [x] Empty state shown when no events

#### AC-7: Event-Status (planned | active | archived) computed on-read
- [x] `computeEventStatus()` correctly computes status from dates
- [x] Status badges shown on EventCard and Event Dashboard
- [x] Status is not stored in DB -- computed client-side from dates

#### AC-8: Nur Organisator kann Event bearbeiten
- [x] PATCH `/api/events/[id]` checks `event.organizer_id !== currentMember.id` returns 403
- [x] Edit button (pencil icon) only shown when `isOrganizer` is true on dashboard

#### AC-9: Nur Organisator kann Event archivieren
- [ ] BUG: No manual archive functionality exists. The "Archive" icon is imported in event-edit-sheet.tsx but never used. Status is only date-based. Spec requires organizer to be able to manually archive.

#### AC-10: Cover-Foto Platzhalter-Gradient
- [x] `generateEventGradient()` creates deterministic teal/amber gradient from name hash
- [x] Gradient shown in EventCard, Event Dashboard header, and CoverPhotoUploader preview

#### AC-11: Event-Erstellungsformular mit Zod-Validierung (client + server)
- [x] Client-side: `formSchema` with zodResolver in react-hook-form
- [x] Server-side: `eventCreateSchema.safeParse(body)` in POST `/api/events`
- [x] Multi-step form: Step 1 (basics) validated before advancing to Step 2 (agenda)

#### AC-12: Organisator automatisch als erstes Mitglied eingetragen
- [x] POST `/api/events` inserts into `event_members` with role "organizer"
- [x] Cleanup: if member insertion fails, event is deleted (rollback)

### Edge Cases Status

#### EC-1: Enddatum vor Startdatum
- [x] Zod refine rule produces error "Enddatum muss nach Startdatum liegen"
- [x] Calendar picker for end date disables dates before start date

#### EC-2: Enddatum gleich Startdatum (single-day event)
- [x] Zod refine allows `end_date >= start_date` (equal is permitted)

#### EC-3: Cover-Foto > 5 MB
- [x] Client-side check: `file.size > COVER_MAX_SIZE_BYTES` shows error before upload
- [x] Client-side compression: `browser-image-compression` with max 1920px, max 500KB

#### EC-4: Event-Name Slug-Kollision
- [x] Slug uniqueness loop in POST and PATCH routes
- [x] Safety: max 100 iterations, then timestamp suffix fallback

#### EC-5: 0 Agenda-Eintraege
- [x] Allowed -- empty state message shown, event can be created without agenda

#### EC-6: 30+ Agenda-Eintraege
- [x] Zod `.max(30, "Maximal 30 Tages-Abschnitte")` in schema
- [x] UI: "Hinzufuegen" button hidden at 30, message "Maximal 30 Tages-Abschnitte erreicht" shown

#### EC-7: Event loeschen -- Bestaetigungs-Dialog
- [x] AlertDialog with destructive warning text present in EventEditSheet
- [x] DELETE `/api/events/[id]` checks organizer_id, returns 403 for non-organizers
- [ ] BUG: Confirmation dialog text says "Alle Beitraege, Fotos und Kommentare werden unwiderruflich geloescht" but spec requires exact text: "Alle Beitraege, Fotos und Kommentare werden unwiderruflich geloescht" -- text uses ASCII replacements (ae/oe/ue) instead of German umlauts. Minor, but deviates from spec.

#### EC-8: Teilnehmer oeffnet /events/[fremdeId]
- [x] GET `/api/events/[id]` checks event_members for membership, returns 403 if not a member
- [x] Frontend redirects to /events on 403

#### EC-9: Organisator aendert Tages-Admin ruckwirkend
- [ ] BUG: Not testable -- Tages-Admin assignment UI does not exist (see AC-5)

### Security Audit Results

#### Authentication
- [x] All API routes (GET, POST, PATCH, DELETE) verify member_token cookie
- [x] Missing/invalid token returns 401
- [x] Middleware validates token against DB on every request

#### Authorization (IDOR)
- [x] GET `/api/events/[id]` checks event_members membership -- non-members get 403
- [x] PATCH `/api/events/[id]` checks organizer_id -- non-organizers get 403
- [x] DELETE `/api/events/[id]` checks organizer_id -- non-organizers get 403
- [ ] BUG-SEC-1: getCurrentMember uses `.select("*")` on members table, loading the auth token into server memory. Should use `.select("id, name, role, avatar_url")` to minimize exposure. (Low severity -- token is not returned in response, but defense-in-depth principle violated.)

#### Input Validation
- [x] POST and PATCH routes validate body with Zod before processing
- [x] UUID format validated with regex in [id] routes
- [x] Invalid JSON body returns 400
- [x] HTML maxLength attributes provide client-side enforcement

#### Injection
- [x] Supabase SDK uses parameterized queries -- SQL injection not possible
- [x] Event name, description, and agenda text are stored as-is but rendered via React JSX (auto-escaped) -- XSS safe
- [ ] BUG-SEC-2: `cover_url` field accepts any URL via Zod `z.string().url()`. An attacker could set cover_url to `javascript:` URI or an external tracking pixel URL. The URL is rendered in an `<img src>` tag which mitigates JS execution, but external URLs could be used for tracking. Should validate that cover_url matches the Supabase storage domain.

#### Rate Limiting
- [x] POST `/api/events` rate-limited (20 req/min/IP)
- [x] PATCH `/api/events/[id]` rate-limited
- [x] DELETE `/api/events/[id]` rate-limited
- [ ] BUG-SEC-3: GET `/api/events` is NOT rate-limited. An attacker could enumerate events rapidly. (Low severity -- data is filtered by membership, but resource exhaustion possible.)

#### Data Exposure
- [x] API responses return only necessary event fields (explicit select, not select *)
- [x] Token is not included in any API response payload
- [ ] BUG-SEC-4: Cover photo is uploaded to `temp/` path in Supabase Storage with predictable naming: `temp/{timestamp}-{randomId}-cover.jpg`. The `randomId` uses `Math.random()` which is not cryptographically secure. Path could be guessed. Since the bucket is public-read, this is a low risk, but the temp/ path is never cleaned up (orphaned files if user changes cover or deletes event).

#### IP Spoofing on Rate Limit
- [ ] BUG-SEC-5: `getRateLimitIp()` trusts `x-forwarded-for` header directly. An attacker can set this header to bypass rate limiting. On Vercel this is mitigated because Vercel overrides x-forwarded-for, but in development or self-hosted environments this is exploitable. (Medium severity in non-Vercel deployments.)

### Cross-Browser Assessment (Code Review)
- [x] No browser-specific APIs used beyond standard fetch, Date, and React
- [x] `browser-image-compression` library handles Web Worker compatibility
- [x] Calendar component uses `react-day-picker` which has broad browser support
- [x] date-fns locale used for German date formatting
- NOTE: Manual cross-browser testing not performed (no running browser available). Code review shows no browser-specific concerns.

### Responsive Assessment (Code Review)
- [x] Events page: `max-w-2xl` centered layout, padding px-4
- [x] Event create form: `max-w-lg` centered, `grid-cols-2` for date pickers
- [x] Event dashboard: responsive cover height `h-48 md:h-64`, tab labels hidden on mobile (`hidden sm:inline`)
- [x] Event edit sheet: `w-full sm:max-w-lg` with ScrollArea for long content
- [ ] BUG-RESP-1: The date picker `grid-cols-2` layout on the create form at 375px width may cause the date buttons to be very narrow. Each column would be approximately 150px minus padding. Not critical but could be cramped.

### Bugs Found

#### BUG-1: Missing Tages-Admin Assignment UI
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Go to `/events/new` and create an event with agenda items
  2. Expected: Each agenda item has a dropdown to assign a Tages-Admin from event members
  3. Actual: No admin assignment field exists on agenda items
- **Note:** The `admin_member_id` field exists in the AgendaItem type and DB schema, but no UI to set it
- **Priority:** Fix in next sprint (depends on PROJ-26 for member list)

#### BUG-2: Missing Manual Archive Functionality
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Go to `/events/[id]` as organizer
  2. Click edit (pencil icon)
  3. Expected: "Event archivieren" button in the edit sheet
  4. Actual: Only "Event loeschen" button exists in danger zone. Archive icon is imported but unused.
- **Note:** Status is only date-based. Spec says "Nur Organisator kann Event archivieren" which implies manual control.
- **Priority:** Fix in next sprint

#### BUG-3: Umlaut-Free Text in Delete Confirmation Dialog
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open event edit sheet
  2. Click "Event loeschen"
  3. Expected: German text with proper umlauts
  4. Actual: Text uses ASCII replacements ("loeschen", "Beitraege", "rueckgaengig")
- **Priority:** Nice to have

#### BUG-4: getCurrentMember Selects All Fields Including Token
- **Severity:** Low (Security)
- **Steps to Reproduce:**
  1. Inspect `getCurrentMember()` in both `src/app/api/events/route.ts` and `src/app/api/events/[id]/route.ts`
  2. Both use `.select("*")` on members table
  3. Expected: `.select("id, name, role, avatar_url")`
  4. Actual: Token field loaded into server memory unnecessarily
- **Priority:** Fix before deployment (defense-in-depth)

#### BUG-5: cover_url Accepts Any External URL
- **Severity:** Medium (Security)
- **Steps to Reproduce:**
  1. POST `/api/events` with `cover_url: "https://evil-tracker.com/pixel.png"`
  2. Expected: URL validated against Supabase storage domain
  3. Actual: Any valid URL is accepted and rendered as `<img src>`
- **Priority:** Fix before deployment

#### BUG-6: GET /api/events Not Rate-Limited
- **Severity:** Low (Security)
- **Steps to Reproduce:**
  1. Send rapid GET requests to `/api/events`
  2. Expected: Rate limiting after threshold
  3. Actual: No rate limiting on GET endpoint
- **Priority:** Nice to have (data is filtered by membership)

#### BUG-7: Orphaned Cover Photos in Storage
- **Severity:** Low
- **Steps to Reproduce:**
  1. Upload a cover photo during event creation
  2. Change the cover photo to a different one
  3. The first uploaded file remains in `covers/temp/` bucket
  4. Delete an event -- cover photo is not cleaned up from storage
- **Priority:** Fix in next sprint (storage cost concern)

#### BUG-8: Unused Import -- Archive Icon
- **Severity:** Low (Code Quality)
- **Steps to Reproduce:**
  1. Open `src/components/event-edit-sheet.tsx` line 59
  2. `Archive` is imported from lucide-react but never used
- **Priority:** Nice to have

#### BUG-9: /e/[slug] Route Not Implemented
- **Severity:** Low
- **Steps to Reproduce:**
  1. Navigate to `/e/any-slug`
  2. Expected: Public event page (per AC-3)
  3. Actual: 404
- **Note:** This is intentionally deferred to PROJ-35, but the acceptance criterion lists it. The slug generation infrastructure is in place.
- **Priority:** Deferred to PROJ-35

#### BUG-10: Duplicate getCurrentMember Helper in Two Files
- **Severity:** Low (Code Quality)
- **Steps to Reproduce:**
  1. Compare `getCurrentMember()` in `src/app/api/events/route.ts` and `src/app/api/events/[id]/route.ts`
  2. Both files have identical helper functions
- **Note:** Should be extracted to a shared utility (e.g., `src/lib/api-auth.ts`)
- **Priority:** Nice to have (DRY principle)

### Summary
- **Acceptance Criteria:** 10/12 passed (AC-3 partially, AC-5 and AC-9 failed)
- **Edge Cases:** 8/9 passed (EC-7 minor text issue, EC-9 not testable)
- **Bugs Found:** 10 total (0 critical, 2 high [BUG-1, BUG-2 are medium but blocking ACs], 3 medium, 5 low)
- **Security:** 3 issues found (BUG-4 low, BUG-5 medium, BUG-6 low)
- **Production Ready:** NO
- **Recommendation:** Fix BUG-2 (archive button) and BUG-5 (cover_url validation) before deployment. BUG-1 (Tages-Admin UI) can be deferred if PROJ-26 is prerequisite. BUG-4 (select *) should be fixed as a quick win.

## Deployment
_To be added by /deploy_
