# PROJ-27: Wanderer-Screen (Eingabe-Interface)

## Status: In Review (QA Round 3 complete -- PRODUCTION READY)
**Created:** 2026-03-08
**Last Updated:** 2026-04-05

## Dependencies
- Requires: PROJ-24 (Auth & User-Accounts) — Nutzer muss eingeloggt sein
- Requires: PROJ-25 (Event-Erstellung & -Verwaltung) — Event und Agenda müssen existieren
- Requires: PROJ-26 (Teilnehmer-Einladung & Member-Management) — Nutzer muss Mitglied des Events sein

## User Stories
- Als Wanderer möchte ich auf einem einfachen Screen 4 Aktionen sehen: Kamera, Video, Upload, Kommentar, damit ich schnell und ohne Ablenkung dokumentieren kann.
- Als Wanderer möchte ich direkt ein Foto aufnehmen und mit einem kurzen Kommentar versehen.
- Als Wanderer möchte ich meinen Beitrag einem Agenda-Punkt zuordnen, damit alles strukturiert bleibt.
- Als Wanderer möchte ich GPS-Koordinaten automatisch erfassen lassen, damit Fotos auf der Karte erscheinen.

## Acceptance Criteria
- [ ] Screen unter `/capture` oder als untere Tab-Navigation in der PWA erreichbar
- [ ] 4 große, Touch-optimierte Aktions-Buttons: Kamera (Foto direkt aufnehmen), Video (bis 90 s), Upload (aus Galerie wählen), Kommentar (reiner Text)
- [ ] Jeder Beitrag wird dem aktuell aktiven Agenda-Punkt zugeordnet (basierend auf heutigem Datum, anpassbar per Dropdown)
- [ ] GPS wird automatisch beim Öffnen des Screens angefragt (Geolocation API) und bei jedem Beitrag mitgespeichert (optional, überspringbar)
- [ ] Foto-Workflow: Kamera öffnen (`<input capture="environment">`) → Vorschau → optionaler Kommentar (max 1000 Zeichen) → Absenden
- [ ] Upload-Workflow: Mediathek öffnen → Auswahl (1 Datei) → EXIF-Extraktion → Kompression (max 1920px / 1 MB) → Thumbnail (400px) → optionaler Kommentar → Absenden
- [ ] Kommentar-Workflow: Textarea (max 1000 Zeichen) → Agenda-Punkt wählen → Absenden
- [ ] Autoren-Name und Avatar werden automatisch aus dem eingeloggten Profil übernommen (kein manuelles Eingeben)
- [ ] Nach Absenden: Toast "Beitrag gespeichert ✓", Formular wird geleert, GPS-Koordinate wird neu abgerufen
- [ ] Haptic Feedback bei erfolgreichem Absenden (iOS: `navigator.vibrate([50])`)
- [ ] Agenda-Dropdown zeigt nur Agenda-Punkte des aktuellen Events, heutiger Eintrag vorausgewählt
- [ ] Beitrag ohne Agenda-Punkt möglich (Dropdown-Option "Kein Tagesabschnitt")
- [ ] Upload-Fortschrittsbalken während des Speicherns

## Edge Cases
- Kein GPS-Zugriff (verweigert oder nicht verfügbar) → GPS-Feld bleibt leer, Beitrag wird trotzdem gespeichert, kein Fehler
- Kamera-Zugriff verweigert → Fehlermeldung "Kamera-Zugriff benötigt" mit Link zu iOS-Einstellungen
- Datei > 20 MB → Fehlermeldung "Datei zu groß (max. 20 MB)" vor dem Upload, kein Upload-Start
- Datei falsches Format (nicht Bild/Video) → Fehlermeldung "Nur Bilder und Videos erlaubt"
- Kein Agenda-Punkt vorhanden (leere Agenda) → Dropdown ausgeblendet, Beitrag ohne Zuordnung gespeichert
- Offline → Beitrag in lokalem Queue speichern (IndexedDB), Upload-Retry wenn wieder online (PWA Background Sync via Serwist)
- Kommentar 1001+ Zeichen → Zeichenzähler rot, Absenden-Button deaktiviert
- Upload schlägt fehl (Netzwerkfehler) → Fehlermeldung mit Retry-Button, Queue bleibt erhalten
- Nutzer wechselt App während Upload → Upload läuft weiter (Service Worker)
- EXIF-Extraktion fehlgeschlagen → Beitrag ohne EXIF-Daten speichern, kein Fehler für Nutzer

## Technical Requirements
- Mobile-first Design, optimiert für iPhone (375px Breite, Touch-Targets min. 44px)
- `<input type="file" accept="image/*" capture="environment">` für Kamera-Direktzugriff
- EXIF-Extraktion via `exifr` (GPS, Datum, Kameramodell) vor Kompression
- Bildkompression via `browser-image-compression` (max 1920px, 1 MB)
- Thumbnail-Generierung via Canvas API (400px, JPEG 0.8)
- Upload zu Supabase Storage (Bucket: `media`, Pfad: `[event_id]/[user_id]/[timestamp]-[uuid]`)
- `content_items` Tabelle (id UUID PK, event_id UUID FK, agenda_item_id UUID FK nullable, author_id UUID FK profiles, type TEXT CHECK ('photo'|'video'|'text'|'audio'), media_url TEXT, thumbnail_url TEXT, caption TEXT, latitude FLOAT8, longitude FLOAT8, exif_date TIMESTAMPTZ, created_at TIMESTAMPTZ)
- Zod-Schema für Beitrag-Validierung (caption max 1000 Zeichen, type enum)
- Rate-Limiting: 30 POST-Requests pro Minute pro IP (in-memory)
- PWA Background Sync: Serwist `BackgroundSyncPlugin` für fehlgeschlagene Uploads

---

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
/events/[id]/capture (Seite)
├── GpsStatusBadge           ← GPS-Status (grün/grau/rot), oben rechts
├── AgendaSelector           ← Select-Dropdown: heutiger Agenda-Punkt vorausgewählt
│                               (ausgeblendet wenn Agenda leer)
└── ActionButtonGrid         ← 2×2 Grid mit 4 großen Touch-Buttons
    ├── [Kamera]             ← Foto direkt aufnehmen
    ├── [Video]              ← Platzhalter → PROJ-29 (deaktiviert)
    ├── [Upload]             ← Bild aus Mediathek wählen
    └── [Kommentar]          ← Reiner Text-Beitrag

PhotoSheet (Bottom Sheet für Kamera + Upload)
├── PhotoPreview             ← Vorschau des Bildes
├── CaptionTextarea          ← Optionaler Kommentar (max 1000 Z., Zeichenzähler)
├── UploadProgressBar        ← Sichtbar während Upload
└── SubmitButton / CancelButton

TextCommentSheet (Bottom Sheet für Text)
├── CaptionTextarea          ← Pflichtfeld (max 1000 Z., Zeichenzähler)
└── SubmitButton / CancelButton
```

### Datenmodell

**`agenda_items` Tabelle** (falls noch nicht aus PROJ-25 vorhanden):
- ID, Event-Zugehörigkeit, Titel, Datum, Tages-Admin, Reihenfolge

**`content_items` Tabelle** (neu, Kern von PROJ-27):
- ID (eindeutig)
- Event-Zugehörigkeit
- Agenda-Punkt (optional)
- Autor (verknüpft mit members)
- Typ: "photo" | "video" | "text" | "audio"
- Medien-URL (Supabase Storage)
- Thumbnail-URL (400px Vorschau)
- Bildunterschrift / Kommentar (max 1000 Zeichen)
- GPS-Koordinaten: Breitengrad + Längengrad (optional)
- EXIF-Datum (optional)
- Erstellt am

**Supabase Storage Bucket: `media`** (neu, öffentlich, max 20 MB, Pfad: `[event_id]/[user_id]/[timestamp]-[uuid]`)

### API

| Methode | Route | Zweck |
|---------|-------|-------|
| `GET` | `/api/events/[id]/agenda` | Agenda-Punkte laden (Dropdown) |
| `POST` | `/api/events/[id]/content` | Neuen Beitrag speichern |

Ablauf Foto/Upload: Datei → EXIF-Extraktion → Kompression → Thumbnail (Browser) → Storage Upload → POST mit URL + Metadaten

### Tech-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Bottom Sheet statt Dialog | Auf iPhone natürlicher, Touch-freundlicher |
| `<input capture="environment">` (versteckt) | Öffnet direkt Rück-Kamera auf iOS |
| EXIF vor Kompression | browser-image-compression entfernt EXIF — GPS muss vorher extrahiert werden |
| Canvas-Thumbnail (400px) | Kleines Vorschaubild für Content-Pool (PROJ-28) |
| Video-Button als Platzhalter | Video-Logik kommt in PROJ-29 |
| GPS non-blocking | Kein GPS → Beitrag trotzdem gespeichert |
| Offline-Queue (IndexedDB + Serwist) | Wandergebiete haben schlechtes Netz |
| RLS auf content_items | Nur Event-Mitglieder dürfen Beiträge sehen/erstellen |

### Wiederverwendbare Komponenten

- `cover-photo-uploader.tsx` → Foto-Kompression-Logik als Vorlage
- `auth-provider.tsx` → `useAuth()` für Autor-ID + Name
- shadcn: Sheet, Select, Textarea, Button, Progress, Badge, Sonner (Toast)

### Neue Pakete

Keine — `exifr` und `browser-image-compression` bereits im Projekt.

### Scope-Abgrenzung

- **In PROJ-27:** Foto, Upload, Text, GPS, Agenda-Zuordnung, Offline-Queue
- **In PROJ-29:** Video-Aufnahme (nur Platzhalter-Button)
- **In PROJ-30:** Sprachmemo (kommt später)
- **In PROJ-28:** Content-Pool zeigt die hier gespeicherten Beiträge an

## QA Test Results

### Round 1 (2026-04-05)

**Result:** 7 bugs found (0 critical, 1 high, 2 medium, 4 low). All 7 fixed in commit `847657e`.

---

### Round 2 (2026-04-05) -- Re-QA After Bug Fixes

**Tested:** 2026-04-05
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build:** Production build succeeds with no TypeScript errors.

### Acceptance Criteria Status

#### AC-1: Screen accessible under `/capture` or as tab navigation
- [x] WandererScreen is embedded as the default "capture" tab on `/events/[id]` page
- [x] Tab is the first/default tab when opening an event dashboard

#### AC-2: 4 large, touch-optimized action buttons (Kamera, Video, Upload, Kommentar)
- [x] ActionButtonGrid renders 2x2 grid with all 4 buttons
- [x] Buttons have h-28 (mobile) / h-32 (sm+) height -- touch-friendly
- [x] Video button is disabled placeholder with "Kommt bald" label (deferred to PROJ-29)
- [x] All buttons have aria-labels for accessibility

#### AC-3: Beitrag assigned to active agenda item (today auto-selected, changeable via dropdown)
- [x] `findTodayAgendaItem()` matches today's date to agenda items
- [x] AgendaSelector uses shadcn Select component with proper labeling
- [x] Selected agenda ID passed through to PhotoSheet and TextCommentSheet

#### AC-4: GPS auto-requested on screen open, saved with each contribution
- [x] `useGeolocation` hook triggers `getCurrentPosition` on mount
- [x] GPS position passed to both PhotoSheet and TextCommentSheet
- [x] GPS is non-blocking (denied/unavailable status handled gracefully)

#### AC-5: Photo workflow (camera -> preview -> optional caption -> submit)
- [x] Hidden `<input capture="environment">` opens rear camera on iOS
- [x] PhotoSheet shows image preview via `URL.createObjectURL`
- [x] CaptionTextarea with 1000 char limit and counter
- [x] Submit calls `processAndUploadImage` pipeline then POST API

#### AC-6: Upload workflow (gallery -> EXIF -> compression -> thumbnail -> caption -> submit)
- [x] Separate upload input with specific accept types (JPEG, PNG, WebP, HEIC, HEIF)
- [x] EXIF extraction via `exifr` happens before compression (correct order)
- [x] Compression to max 1920px / 1MB via `browser-image-compression`
- [x] Thumbnail generated at 400px / 0.1MB
- [x] Both full and thumbnail uploaded to Supabase Storage (`media` bucket)

#### AC-7: Comment workflow (textarea -> agenda select -> submit)
- [x] TextCommentSheet with required textarea
- [x] Empty text blocked (submit disabled when isEmpty)
- [x] 1000 char limit enforced client-side and server-side (Zod schema)
- [x] GPS coordinates included if available

#### AC-8: Author name and avatar auto-populated from logged-in profile
- [x] `userId` (member.id) passed from authenticated page context
- [x] `author_id` set server-side from cookie token lookup (cannot be spoofed)

#### AC-9: Toast "Beitrag gespeichert" after submit, form cleared, GPS refreshed
- [x] Toast shows "Beitrag gespeichert" with Unicode checkmark (BUG-6 FIXED)
- [x] Sheet closes and state resets (caption cleared, progress reset)
- [x] `refreshGps()` called after successful submit

#### AC-10: Haptic feedback on successful submit
- [x] `navigator.vibrate([50])` called in both PhotoSheet and TextCommentSheet
- [x] Conditional check (`if (navigator.vibrate)`) prevents errors on unsupported devices

#### AC-11: Agenda dropdown shows only current event items, today preselected
- [x] AgendaSelector receives `agendaItems` filtered by event from API
- [x] Items sorted by `sort_order`
- [x] Date labels formatted in German locale

#### AC-12: Beitrag without agenda possible ("Kein Tagesabschnitt" option)
- [x] `NO_AGENDA_VALUE = "__none__"` option available in dropdown
- [x] Server accepts `agenda_item_id: null` (Zod schema allows nullable)

#### AC-13: Upload progress bar during save
- [x] Progress component rendered during upload
- [x] Progress updates: 0% -> 5% (EXIF) -> 30% (compress) -> 100% (upload complete)
- [x] Percentage text shown below bar

### Round 1 Bug Fix Verification

| Bug | Status | Verification |
|-----|--------|-------------|
| BUG-1: Offline queue | PARTIALLY FIXED | IndexedDB queue + `startOnlineSync` listener implemented. Text comments queue correctly. **Photo queue is broken** -- see BUG-R2-1 below. |
| BUG-2: Rate limit 20 vs 30 | FIXED | `rate-limit.ts` now uses `MAX_REQUESTS = 30`. |
| BUG-3: media_url domain validation | FIXED | POST handler validates `media_url` and `thumbnail_url` start with `${NEXT_PUBLIC_SUPABASE_URL}/storage/`. |
| BUG-4: Math.random file naming | FIXED | `content-upload.ts` now uses `crypto.randomUUID().slice(0, 8)`. |
| BUG-5: No retry button | FIXED | PhotoSheet error alert includes "Erneut versuchen" button that re-triggers `handleSubmit`. |
| BUG-6: Toast missing checkmark | FIXED | Toast text is `"Beitrag gespeichert \u2713"`. |
| BUG-7: Camera denied error | FIXED | `handleCamera` checks `navigator.permissions.query({ name: "camera" })` and shows custom error with iOS settings hint. |

### Edge Cases Status

#### EC-1: No GPS access (denied or unavailable)
- [x] GPS field stays null, contribution saved without GPS
- [x] GpsStatusBadge shows "GPS blockiert" or "Kein GPS" with retry option

#### EC-2: Camera access denied
- [x] Custom error "Kamera-Zugriff blockiert..." with iOS settings hint (BUG-7 FIXED)

#### EC-3: File > 20 MB
- [x] `CONTENT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024` checked before upload
- [x] Error message "Datei zu gross (max. 20 MB)" shown in Alert

#### EC-4: Wrong file format (not image/video)
- [x] File type validation against `CONTENT_ALLOWED_IMAGE_TYPES`
- [x] Fallback regex check for files with empty MIME type (`.heic`, `.heif`)

#### EC-5: No agenda items (empty agenda)
- [x] AgendaSelector returns `null` when `agendaItems.length === 0`
- [x] Contribution saved without agenda assignment

#### EC-6: Offline mode (IndexedDB queue + Background Sync)
- [x] IndexedDB queue implemented (`offline-queue.ts`)
- [x] `startOnlineSync` listens for `online` event and auto-flushes
- [x] Text comments correctly queued and retried
- [ ] BUG-R2-1: Photo offline queue does NOT store image blobs -- retry always fails (see below)

#### EC-7: Caption 1001+ characters
- [x] CaptionTextarea shows character counter in red when over limit
- [x] Submit button disabled when `isOverLimit`
- [x] Server-side Zod validation also enforces max 1000

#### EC-8: Upload fails (network error)
- [x] Error caught and displayed in Alert
- [x] Retry button available in error state (BUG-5 FIXED)

#### EC-9: User switches app during upload
- [ ] Still no Service Worker upload support. Upload runs in main thread only. Acceptable for MVP -- Serwist BackgroundSyncPlugin integration deferred.

#### EC-10: EXIF extraction failed
- [x] `extractExif()` catches all errors, returns nulls
- [x] Contribution saved without EXIF data, no error shown to user

### Security Audit Results (Round 2)

- [x] Authentication: API checks `member_token` cookie, returns 401 if missing/invalid
- [x] Authorization: Event membership verified before GET and POST on content
- [x] Authorization: DELETE only allowed for content author or event organizer
- [x] Input validation: Zod schema validates all fields (type enum, caption length, coordinates range, UUIDs)
- [x] UUID validation: Event ID and content ID validated with regex before DB queries
- [x] IDOR prevention: `author_id` set server-side from cookie lookup, cannot be spoofed by client
- [x] Rate limiting: Now correctly set to 30 req/min (BUG-2 FIXED)
- [x] media_url domain validation: Validates against Supabase storage domain (BUG-3 FIXED)
- [x] Storage file naming: Now uses `crypto.randomUUID()` (BUG-4 FIXED)
- [x] No service role key exposed in client code
- [x] Storage path includes eventId/userId scoping
- [x] XSS: Caption stored as plain text, rendering depends on PROJ-28 to escape properly
- [x] SQL injection: Supabase client uses parameterized queries
- [ ] BUG-R2-2: GET API `singleId` query param not UUID-validated (low risk -- parameterized queries prevent injection, but inconsistent with event ID validation)
- [ ] BUG-R2-3: GET API `cursor` and `agendaId` query params not validated (cursor not ISO-validated, agendaId not UUID-validated)

### Cross-Browser Testing (Code Review)

- [x] Chrome: Standard APIs used (Geolocation, File, Canvas, IndexedDB) -- expected to work
- [x] Firefox: Same standard APIs -- expected to work
- [x] Safari/iOS: `capture="environment"` attribute for rear camera -- iOS-optimized
- [x] `navigator.vibrate` check prevents Safari errors (Safari does not support Vibration API)
- [x] `navigator.permissions.query` for camera wrapped in try/catch (not supported everywhere)

### Responsive Testing (Code Review)

- [x] 375px (Mobile): Action buttons h-28, single-column text, max-w-lg sheets
- [x] 768px (Tablet): Buttons scale to h-32 at sm breakpoint, max-w-2xl container
- [x] 1440px (Desktop): Content centered in max-w-2xl container, sheets capped at max-w-lg
- [x] Tab labels hidden on mobile (icon-only), shown on sm+ breakpoints

### Regression Testing

- [x] PROJ-24 (Auth): No API route changes, auth flow unaffected
- [x] PROJ-25 (Event): No API route changes, event dashboard loads correctly with new WandererScreen tab
- [x] PROJ-26 (Teilnehmer): No API route changes, invitation flow unaffected
- [x] Build: Production build succeeds with zero TypeScript errors

### New Bugs Found (Round 2)

#### BUG-R2-1: Photo offline queue does not store image blobs -- retry always fails
- **Severity:** High
- **Steps to Reproduce:**
  1. Go to `/events/[id]` capture tab
  2. Select a photo (camera or gallery)
  3. Disable network before submitting
  4. Submit the photo
  5. Expected: Photo binary + metadata queued in IndexedDB, uploaded when back online
  6. Actual: Only metadata (type, caption, GPS) is queued. No `media_url` is stored because the image was never uploaded to Supabase Storage. When `flushQueue` retries the POST, the server rejects it with "Medien-URL ist erforderlich fuer diesen Beitragstyp" (line 193-196 of route.ts).
- **Root Cause:** `photo-sheet.tsx` lines 131-137 enqueue the API payload without `media_url` or `thumbnail_url` because those are only available after the Storage upload succeeds. The image blob itself is not stored in IndexedDB.
- **Impact:** Photo offline queue is fundamentally broken. Only text comments work offline. This is a design flaw, not a simple bug -- the offline queue would need to store raw image blobs in IndexedDB and re-run the full pipeline (EXIF + compress + upload + API call) on retry.
- **Priority:** Fix before deployment (critical for hiking/outdoor use case)

#### BUG-R2-2: Fragile network error detection for offline queueing
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Review `photo-sheet.tsx` line 129: `err instanceof TypeError && err.message.includes("fetch")`
  2. Review `text-comment-sheet.tsx` line 98: same pattern
  3. The Supabase Storage upload failure (from `processAndUploadImage`) may throw errors that are NOT `TypeError` with "fetch" in the message (e.g., Supabase SDK wraps errors differently).
  4. Expected: All network failures trigger offline queueing
  5. Actual: Only `TypeError` containing "fetch" triggers queueing; other network errors show generic error without queueing
- **Impact:** Some network failures during photo upload will not be queued for offline retry
- **Priority:** Fix in next sprint

#### BUG-R2-3: GET API query parameters not validated
- **Severity:** Low (Security)
- **Steps to Reproduce:**
  1. Call `GET /api/events/[id]/content?id=not-a-uuid` -- `singleId` not UUID-validated
  2. Call `GET /api/events/[id]/content?agenda=not-a-uuid` -- `agendaId` not UUID-validated
  3. Call `GET /api/events/[id]/content?cursor=not-a-date` -- `cursor` not ISO-date-validated
  4. Expected: 400 error for invalid parameters
  5. Actual: Query executes with invalid values, returns empty results or Supabase error bubbled as 500
- **Impact:** Low -- parameterized queries prevent SQL injection. Invalid params return empty results or 500 errors. No data exposure risk.
- **Priority:** Nice to have

### Summary (Round 2)
- **Acceptance Criteria:** 13/13 passed
- **Edge Cases:** 8/10 handled (EC-6 partial for photos, EC-9 Service Worker deferred)
- **Round 1 Bugs Fixed:** 7/7 fixed (BUG-1 partially -- text works, photos do not)
- **New Bugs Found:** 3 total (1 high, 1 medium, 1 low)
- **Security:** No critical/high security issues remaining. 1 low finding (BUG-R2-3: query param validation).
- **Production Ready:** CONDITIONAL YES
- **Recommendation:** BUG-R2-1 (photo offline queue) is High severity and critical for the hiking use case. However, all online functionality works correctly and all 13 acceptance criteria pass. Two options:
  1. **Deploy now** with a known limitation that photo uploads require network connectivity. Text comments work offline. Acceptable for MVP if users will mostly have intermittent (not zero) connectivity.
  2. **Fix BUG-R2-1 first** by storing image blobs in IndexedDB and re-running the full pipeline on retry. This is a significant implementation effort.
  BUG-R2-2 and BUG-R2-3 can be fixed in the next sprint.

---

### Round 3 (2026-04-05) -- Re-QA After Round 2 Bug Fixes

**Tested:** 2026-04-05
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Build:** Production build succeeds with 0 errors, 7 warnings (all `<img>` vs `<Image>` -- acceptable for dynamic Supabase Storage URLs). ESLint: 0 errors.

### Round 2 Bug Fix Verification

| Bug | Status | Verification |
|-----|--------|-------------|
| BUG-R2-1: Photo offline queue broken | FIXED | `offline-queue.ts` upgraded to DB_VERSION=2. `enqueue()` now accepts optional `file` param and stores as `fileBlob` in IndexedDB. `flushQueue()` checks `payload.type === "photo" && item.fileBlob` and re-runs full `processAndUploadImage` pipeline (EXIF, compress, upload) before POSTing. Verified in code: `photo-sheet.tsx` line 133 passes `file` to `enqueue()`. |
| BUG-R2-2: Fragile network error detection | FIXED | New `network-utils.ts` with `isNetworkError()` helper checks: (1) `navigator.onLine === false`, (2) TypeError with multiple patterns (fetch, network, failed to fetch, networkerror, load failed for Safari), (3) DOMException AbortError. Both `photo-sheet.tsx` and `text-comment-sheet.tsx` now import and use this helper. |
| BUG-R2-3: GET API query params not validated | FIXED | `route.ts` lines 75-84 now validate `singleId` and `agendaId` with `isValidUUID()`, and `cursor` with `isNaN(Date.parse(cursor))`. Returns 400 for invalid values. |

### Acceptance Criteria Re-verification

All 13 acceptance criteria continue to pass. No regressions introduced by the bug fixes.

- [x] AC-1 through AC-13: All verified passing (same as Round 2)

### Security Audit (Round 3 -- Deep Dive)

- [x] No service role key exposed in any client or API file
- [x] No `dangerouslySetInnerHTML` usage in PROJ-27 components
- [x] `media_url` domain validation uses `startsWith` against Supabase URL -- prevents arbitrary domain injection
- [x] `author_id` set server-side from cookie lookup -- cannot be spoofed
- [x] DELETE endpoint properly scopes by both `event_id` and `contentId`, checks author or organizer
- [x] Rate limiting on both POST and DELETE endpoints (30 req/min)
- [x] All UUID parameters validated before DB queries
- [x] Cursor parameter validated as parseable date
- [x] File naming uses `crypto.randomUUID()` -- not guessable
- [x] Zod schema validates coordinate ranges (-90/90 latitude, -180/180 longitude)
- [x] `caption` field stored as plain text (no HTML), XSS risk depends on rendering in PROJ-28 (verified: PROJ-28 content-card uses React JSX which auto-escapes)

### New Bugs Found (Round 3)

#### BUG-R3-1: IndexedDB QuotaExceededError not handled in offline queue
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Go offline
  2. Take multiple large photos (e.g., 5-10 photos at ~15MB each)
  3. Submit each -- they get queued in IndexedDB with the full file blob
  4. Expected: Graceful error when storage is full, user informed
  5. Actual: `enqueue()` throws unhandled `QuotaExceededError` from IndexedDB (typical limit 50-100MB per origin). The `catch` block in `photo-sheet.tsx` line 148 catches it and shows "Upload fehlgeschlagen. Bitte versuche es erneut." but does not indicate the real cause (storage full) or suggest clearing old queued items.
- **Impact:** User does not understand why offline queueing suddenly fails after several photos. The generic error message is misleading.
- **Priority:** Fix in next sprint

#### BUG-R3-2: Object URL memory leak when PhotoSheet unmounts while open
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open a photo in PhotoSheet (creates `URL.createObjectURL`)
  2. Navigate away from the page (e.g., browser back) while the sheet is still open
  3. Expected: Object URL is revoked on unmount
  4. Actual: `handleOpenChange` only revokes the URL when the sheet closes normally. There is no `useEffect` cleanup that calls `URL.revokeObjectURL` on unmount. Each leaked URL holds a reference to the image blob in memory.
- **Impact:** Minor memory leak, one blob per occurrence. Only matters for repeated navigation patterns. Browsers eventually GC these on page unload.
- **Priority:** Nice to have

#### BUG-R3-3: Orphaned storage files when DELETE endpoint fails to remove from Supabase Storage
- **Severity:** Low
- **Steps to Reproduce:**
  1. Create a photo content item
  2. Delete it via `DELETE /api/events/[id]/content/[contentId]`
  3. If Supabase Storage `.remove()` fails (network issue, permission error), the code at `[contentId]/route.ts` line 97-99 does not check the result
  4. Expected: Either retry storage deletion or log warning
  5. Actual: Storage file remains orphaned, `content_items` row is deleted successfully
- **Impact:** Orphaned files accumulate in storage over time. No data exposure (files are public bucket, but URLs are random UUIDs). Storage cost is minimal on free tier.
- **Priority:** Nice to have

#### BUG-R3-4: Stale offline queue items never cleaned up (retryCount >= 5)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Queue items offline that will permanently fail (e.g., v1 photo items without fileBlob, or items for deleted events)
  2. Go online -- `flushQueue` retries them 5 times
  3. After 5 retries, items are skipped but never deleted from IndexedDB
  4. Expected: Items exceeding max retries are purged or marked as failed
  5. Actual: Items remain in IndexedDB forever, wasting storage and adding overhead to each `flushQueue` call
- **Impact:** Very minor -- stale items are small (except photo blobs which could be large). Over time, `getPending()` returns increasingly large arrays.
- **Priority:** Nice to have

### Cross-Browser & Responsive (Round 3)

No changes from Round 2 -- all standard Web APIs used. No regressions from bug fixes.

### Regression Testing (Round 3)

- [x] PROJ-24 (Auth): No changes to auth files
- [x] PROJ-25 (Event): Event dashboard page updated with PROJ-28 ContentPool tab -- loads correctly
- [x] PROJ-26 (Teilnehmer): No changes to invitation files
- [x] PROJ-28 (Content-Pool): New feature added in parallel commit -- ContentPool component renders in "pool" tab
- [x] Build: Production build succeeds, ESLint 0 errors

### Summary (Round 3)
- **Acceptance Criteria:** 13/13 passed
- **Round 2 Bugs Fixed:** 3/3 verified fixed (BUG-R2-1, BUG-R2-2, BUG-R2-3)
- **New Bugs Found:** 4 total (0 critical, 0 high, 1 medium, 3 low)
- **Security:** No critical, high, or medium security issues. All prior security fixes verified.
- **Production Ready:** YES
- **Recommendation:** All 13 acceptance criteria pass. All previous high-severity bugs are fixed. The 4 new findings are medium/low severity edge cases that do not affect core online functionality. BUG-R3-1 (IndexedDB quota) is the most impactful for the outdoor/hiking use case but only triggers after queuing many large photos offline -- an uncommon scenario for MVP. Deploy now, address BUG-R3-1 in the next sprint alongside PROJ-28.

## Deployment
_To be added by /deploy_
