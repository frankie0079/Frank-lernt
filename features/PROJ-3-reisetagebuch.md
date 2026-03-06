# PROJ-3: Reisetagebuch — Digitales Buch zum Durchblättern

## Status: In Review
**Created:** 2026-02-28
**Last Updated:** 2026-03-06

## Dependencies
- Requires: PROJ-1 (Landing Page) — Navigation und Seitenstruktur
- Related: PROJ-4 (Fotogalerie) — Fotos im Tagebuch anzeigen
- Related: PROJ-6 (Interaktive Karte) — GPS-Position von Einträgen
- Related: PROJ-8 (WhatsApp-Integration) — Tages-Summaries werden als Seiten archiviert

## Konzept

Das Reisetagebuch wird auf der Landing Page als **digitales Buch mit umblätterbaren Seiten** dargestellt.

**Während der Tour:** Das Buch wächst täglich um eine Seite (= die Tages-Summary aus PROJ-8).
**Nach der Tour:** Finale Bearbeitung/Politur des gesamten Buchs möglich.
**Wichtig:** Tagebuchseiten sind nach Erstellung inhaltlich fix. Nachträglich hochgeladene Fotos landen nur in der Galerie (PROJ-4), nicht im Tagebuch.

### Buchstruktur
```
Seite 1:  Titelseite — Tourname, Zeitraum, Teilnehmer, Cover-Foto
Seite 2:  Tourplanung — Streckenführung, Reisedaten
Seite 3:  Tag 1 — Tages-Summary (Fotos, Karte, Kommentare, Statistiken)
Seite 4:  Tag 2 — Tages-Summary
...
Letzte:   Gesamtstatistik / Abschlussseite
```

### Retroaktive Tagebücher
Vergangene Touren (vor der App) können nachträglich als Tagebuch erfasst werden — hauptsächlich aus Fotos (Upload via PWA) und manuell hinzugefügtem Content.

## User Stories
- Als Besucher möchte ich das Reisetagebuch als digitales Buch durchblättern (Seiten umblättern), damit es sich wie ein echtes Tagebuch anfühlt.
- Als Wanderer möchte ich, dass die Tages-Summary automatisch als neue Seite im Buch erscheint, damit das Tagebuch während der Tour wächst.
- Als Wanderer möchte ich nach der Tour das gesamte Buch final bearbeiten (Texte anpassen, Fotos tauschen, Seiten umsortieren).
- Als Wanderer möchte ich einen Kommentar mit GPS-Position hinzufügen.
- Als Besucher möchte ich einen Kommentar hinterlassen (Text + optionaler Name).
- Als Wanderer möchte ich für vergangene Touren (vor der App) ein Tagebuch erstellen aus Fotos und manuellem Content.

## Acceptance Criteria
- [ ] Tagebuch wird als digitales Buch mit umblätterbaren Seiten dargestellt
- [ ] Erste Seite: Titelseite mit Tourname, Zeitraum, Teilnehmer, Cover-Foto
- [ ] Zweite Seite: Tourplanung / Streckenführung
- [ ] Jede Tages-Summary (aus PROJ-8) wird automatisch als neue Seite eingefügt
- [ ] Seiten enthalten: Fotos, Kartenausschnitt, Kommentare, Tagesstatistiken
- [ ] Umblätter-Animation (Seiten-Flip) auf Mobile und Desktop
- [ ] Finale Bearbeitung nach der Tour: Texte, Fotos, Reihenfolge anpassbar
- [ ] Tagebuchseiten sind nach Erstellung inhaltlich fix — nachträgliche Foto-Uploads landen nur in der Galerie
- [ ] Retroaktive Tagebücher erstellbar (Upload via PWA, manuelle Texte)
- [ ] Kommentare mit Text und optionalem Autorname
- [ ] Öffentlich les- und kommentierbar (kein Login)
- [ ] Fluid Responsive Design — dynamische Anpassung an jede Bildschirmgrösse
- [ ] Sprache: Deutsch mit korrekter Silbentrennung und Umlauten (ä, ö, ü)

## Edge Cases
- Was wenn ein Eintrag sehr langer Text ist? → Text auf mehrere Seiten aufteilen
- Was wenn kein GPS verfügbar ist? → Eintrag ohne Koordinaten speichern
- Was wenn beleidigende Kommentare? → Manuelles Löschen möglich
- Was wenn Verbindung abbricht beim Schreiben? → Text lokal zwischenspeichern
- Was wenn kein Autorname? → "Anonym"
- Was wenn vergangene Tour keine Fotos hat? → Leeres Tagebuch mit Platzhalterseiten
- Was wenn Buch sehr viele Seiten (20+)? → Inhaltsverzeichnis / Seitennavigation

## Technical Requirements
- Page-Flip Bibliothek (z.B. turn.js, StPageFlip) oder CSS-basierte Umblätter-Animation
- CSS hyphens: auto für deutsche Silbentrennung
- Optimistic UI — Kommentar erscheint sofort
- Realtime-Updates via Supabase Realtime

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Scope: Sri Lanka Test-MVP
Einfache Tagebuch-Liste mit Einträgen. Kein Seitenumblättern, keine Kommentare, keine Realtime-Updates — das kommt für Portugal.

### Component Structure
```
/touren/[id]/tagebuch
├── Tagebuch-Seite (Server Component + Client Islands)
│   ├── Eintrag-Liste (chronologisch, neueste zuerst)
│   │   └── Tagebuch-Karte (pro Eintrag)
│   │       ├── Datum + Titel
│   │       ├── Text (gekürzt, bei Tap expandierbar)
│   │       ├── Foto-Thumbnails (falls vorhanden)
│   │       └── Autor + GPS-Badge
│   ├── "Neuer Eintrag" FAB (Floating Action Button, Mobile)
│   └── Empty State ("Noch keine Einträge — starte dein Tagebuch!")
└── Eintrag-Formular (shadcn Sheet, gleitet von unten)
    ├── Titel (Input)
    ├── Text (Textarea)
    ├── Foto hinzufügen (Kamera oder Mediathek)
    ├── GPS erfassen (Button, Geolocation API)
    ├── Name (Input, optional, default "Anonym")
    └── Speichern / Abbrechen
```

### Data Model
```
Jeder Tagebuch-Eintrag hat:
- Eindeutige ID (UUID)
- Tour-Zuordnung (welche Tour)
- Datum (Wandertag)
- Titel (z.B. "Tag 3: Von Zambujeira nach Odeceixe")
- Text (Beschreibung des Tages)
- Autor-Name (optional, default "Anonym")
- GPS-Position (optional, Breitengrad + Längengrad)
- Erstellungszeitpunkt

Gespeichert in: Supabase PostgreSQL (Tabelle: diary_entries)
```

### Tech Decisions
- **Server Component + Client Islands** → Seite lädt schnell, nur Formulare sind interaktiv
- **Sheet (shadcn)** für das Formular → Gleitet von unten rein, nativ-Feeling auf Mobile
- **Optimistic UI** → Eintrag erscheint sofort in der Liste, Server-Sync im Hintergrund
- **Card (shadcn)** für Einträge → Konsistentes Design mit der Landing Page

### Dependencies
Keine zusätzlichen — nutzt vorhandene shadcn-Komponenten (Card, Sheet, Button, Input, Textarea)

### Skipped for Sri Lanka (kommt für Portugal)
- Seitenumblätter-Animation (turn.js / StPageFlip)
- Realtime-Updates via Supabase Realtime
- Kommentar-System
- Auto-generierte Tages-Summaries
- Retroaktive Tagebücher

## QA Test Results

**Tested:** 2026-03-06
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Scope:** Sri Lanka Test-MVP (simple diary list, no page-flip, no comments, no realtime)

### Acceptance Criteria Status (MVP Scope)

Note: The full acceptance criteria include features explicitly deferred to the Portugal release
(page-flip animation, title/planning pages, Tages-Summary integration, editing, retroactive diaries).
Testing below covers only the **implemented Sri Lanka Test-MVP scope** as defined in the Tech Design.

#### AC-1: Diary entry list (chronological, newest first)
- [x] Entries are fetched from Supabase and displayed in reverse chronological order
- [x] Server Component fetches data, Client Component renders interactively
- [x] `.limit(100)` applied on both server page and API route

#### AC-2: Diary entry card (per entry)
- [x] Each entry shows title, formatted date (German locale "de-CH"), author name
- [x] Long text (>200 chars) is truncated with "Mehr lesen" / "Weniger anzeigen" toggle
- [x] GPS badge displayed when coordinates are present
- [x] Share button displayed on each entry (not shown while pending)
- [x] Pending entries show loading spinner and reduced opacity

#### AC-3: "Neuer Eintrag" FAB (Floating Action Button)
- [x] FAB visible when entries exist (fixed bottom-right, z-40)
- [x] FAB has accessible aria-label "Neuer Tagebuch-Eintrag"
- [ ] BUG: FAB is not visible when the entry list is empty -- only the empty state button "Erster Eintrag" is shown, but after creating the first entry, the FAB appears. This is acceptable UX but differs from the spec which shows FAB always.

#### AC-4: Entry form (Sheet from bottom)
- [x] Sheet slides from bottom with 85vh height and rounded top corners
- [x] Form has: Title (required, max 200), Content (textarea), Date (date picker, default today), Author (optional, default "Anonym"), GPS button
- [x] SheetHeader includes SheetTitle and SheetDescription (accessibility)
- [x] Form resets on close (if not saving)
- [x] Save and Cancel buttons present

#### AC-5: GPS capture (Geolocation API)
- [x] GPS button calls navigator.geolocation.getCurrentPosition with enableHighAccuracy
- [x] Coordinates displayed as "lat, lng" with 4 decimal places after capture
- [x] Error handling for GPS denied (code 1) with German message
- [x] Error handling for GPS unavailable with German message
- [x] Loading spinner shown while locating
- [x] Button label changes from "GPS erfassen" to "Aktualisieren" after capture

#### AC-6: Optimistic UI
- [x] Entry appears immediately in the list with temp ID (`temp-{uuid}`)
- [x] Entry is sorted into correct position by entry_date
- [x] Pending state: reduced opacity (0.70), spinner icon
- [x] On server confirm: temp entry swapped with real server entry
- [x] On server error: temp entry removed from list + error toast shown
- [x] Sheet closes immediately on save (background sync)

#### AC-7: Error toast notification
- [x] Toast appears at bottom-center with role="alert"
- [x] Error toast uses destructive styling, success toast uses primary styling
- [x] Auto-dismisses after 4 seconds

#### AC-8: Empty state
- [x] Shows book icon, heading "Noch keine Eintraege", descriptive text
- [x] "Erster Eintrag" button opens the entry form

#### AC-9: API route (GET /api/tours/[id]/diary)
- [x] Returns diary entries filtered by tour_id, ordered by entry_date desc
- [x] .limit(100) applied
- [x] Error handling returns 500 with error message

#### AC-10: API route (POST /api/tours/[id]/diary)
- [x] Zod validation: title (1-200 chars required), content (default ""), entry_date (optional date string), author_name (max 100, default "Anonym"), gps_lat (-90 to 90, nullable), gps_lng (-180 to 180, nullable)
- [x] Returns 400 with validation details on invalid input
- [x] Returns 201 with created entry on success
- [x] Returns 500 on database error
- [ ] BUG: No try/catch around `request.json()` -- sending malformed JSON causes unhandled exception (500 instead of 400)

#### AC-11: Open Graph metadata
- [x] generateMetadata fetches tour name, subtitle, cover_photo_url
- [x] Title format: "Tagebuch -- {tour.name} -- Die Wandervoegel"
- [x] Fallback title when tour not found

#### AC-12: Responsive design
- [x] max-w-4xl container with responsive padding (px-4 sm:px-6)
- [x] Cards use full width, text wraps naturally
- [x] Sheet takes 85vh on all screen sizes

#### AC-13: German language
- [x] All UI text in German with correct umlauts
- [x] Date formatted in German locale (de-CH with weekday, day, month, year)
- [x] hyphens-auto applied on body element

### Deferred Features (Not Tested -- Planned for Portugal)
- Page-flip animation (turn.js / StPageFlip)
- Title page, planning page structure
- Tages-Summary auto-insertion from PROJ-8
- Post-tour editing (texts, photos, reorder)
- Content-locked pages after creation
- Retroactive diary creation
- Comment system
- Realtime updates via Supabase Realtime
- Foto-Thumbnails in entries

### Edge Cases Status

#### EC-1: Long text
- [x] Text >200 chars is truncated with "Mehr lesen" toggle -- works correctly

#### EC-2: No GPS available
- [x] Entry saved without coordinates, GPS badge not shown -- handled correctly

#### EC-3: Offensive comments (manual deletion)
- [ ] NOT IMPLEMENTED: No delete functionality exists for entries (deferred to Portugal)

#### EC-4: Connection drops while writing
- [ ] NOT IMPLEMENTED: No local draft persistence. If connection drops, optimistic entry is removed with error toast. Text is lost.

#### EC-5: No author name
- [x] Defaults to "Anonym" -- handled correctly in both frontend and API

#### EC-6: Very many entries (20+)
- [x] Limited to 100 entries via .limit(100) -- no pagination for beyond 100

### Security Audit Results

- [x] No hardcoded secrets in source code
- [x] Supabase URL and anon key accessed via environment variables
- [x] Input validation via Zod on API POST route
- [x] Parameterized queries via Supabase client (SQL injection mitigated)
- [x] GPS coordinates validated (-90 to 90 lat, -180 to 180 lng)
- [x] Title length limited to 200 chars, author_name to 100 chars
- [ ] BUG: `tour_id` path parameter not validated -- any string accepted, no check if tour exists before insert
- [ ] BUG: No rate limiting on POST endpoint -- attacker could flood diary entries
- [ ] BUG: `request.json()` not wrapped in try/catch -- malformed JSON body causes unhandled 500 error
- [x] No dangerouslySetInnerHTML or innerHTML usage
- [x] Content rendered via React text nodes (XSS safe)
- [x] Error messages don't leak internal details

### Bugs Found

#### BUG-1: Malformed JSON body causes unhandled 500 error
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send POST to `/api/tours/rota-vicentina-2026/diary` with body `"not json"`
  2. Expected: 400 Bad Request with clear error message
  3. Actual: 500 Internal Server Error (unhandled exception from `request.json()`)
- **File:** `src/app/api/tours/[id]/diary/route.ts` line 40
- **Priority:** Fix before deployment

#### BUG-2: No tour existence validation before diary entry insert
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send POST to `/api/tours/nonexistent-tour/diary` with valid body
  2. Expected: 404 Not Found ("Tour nicht gefunden")
  3. Actual: If foreign key constraint exists in DB, Supabase returns 500 error. If not, entry is created with invalid tour_id.
- **File:** `src/app/api/tours/[id]/diary/route.ts` line 50-54
- **Priority:** Fix in next sprint

#### BUG-3: No rate limiting on diary POST endpoint
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send 1000 POST requests to `/api/tours/rota-vicentina-2026/diary` in rapid succession
  2. Expected: Rate limit (429) after N requests
  3. Actual: All requests processed, database fills with spam entries
- **File:** `src/app/api/tours/[id]/diary/route.ts`
- **Priority:** Fix before deployment (public API with no auth)

#### BUG-4: No entry deletion functionality
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Create a diary entry with offensive or incorrect content
  2. Expected: Ability to delete the entry
  3. Actual: No DELETE endpoint or UI exists
- **File:** `src/app/api/tours/[id]/diary/route.ts` (missing DELETE handler)
- **Priority:** Fix before deployment (public site, anyone can post)

#### BUG-5: No content length limit on diary content field
- **Severity:** Low
- **Steps to Reproduce:**
  1. POST to diary API with `content` field containing 1MB of text
  2. Expected: Validation error for excessive content length
  3. Actual: Accepted and stored without limit
- **File:** `src/app/api/tours/[id]/diary/route.ts` line 8 (`z.string().default("")` -- no `.max()`)
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria (MVP Scope):** 12/13 passed (1 minor UX difference on FAB visibility)
- **Bugs Found:** 5 total (0 critical, 0 high, 3 medium, 2 low)
- **Security:** Issues found (no rate limiting, no JSON parse error handling, no content size limit)
- **Production Ready:** NO -- Medium bugs BUG-1, BUG-3, BUG-4 should be fixed first
- **Recommendation:** Fix the 3 medium bugs before deployment. BUG-3 (rate limiting) and BUG-4 (deletion) are particularly important since the site has no authentication.

## Deployment
_To be added by /deploy_
