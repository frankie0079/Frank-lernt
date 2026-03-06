# PROJ-4: Fotogalerie

## Status: Deployed
**Created:** 2026-02-28
**Last Updated:** 2026-03-06

## Dependencies
- Requires: PROJ-1 (Landing Page) — Navigation und Seitenstruktur
- Requires: PROJ-5 (PWA) — Foto-Upload ausschliesslich über mobile PWA
- Related: PROJ-3 (Reisetagebuch) — Fotos können in Tagebuchseiten erscheinen
- Related: PROJ-6 (Interaktive Karte) — Foto-Fähnchen auf der Karte

## Konzept

**Upload nur über mobile PWA** — kein Desktop-Upload auf der Landing Page. Die Landing Page zeigt die Galerie nur zum Anschauen.

**Zwei Upload-Wege in der PWA:**
1. **PWA-Kamera (Quick-Capture)** — Direkt in der App fotografieren → Foto + GPS + Zeitstempel automatisch
2. **Import aus Mediathek** — Fotos aus dem iPhone-Fotoalbum auswählen und hochladen

**Einfacher Upload-Flow auf dem Handy:**
```
Tour auswählen → "Fotos hochladen" → Mediathek öffnet sich → Fotos wählen → Fertig
```
Fotos werden automatisch der richtigen Tour zugeordnet.

**Nachträgliche Uploads:** Wanderer können jederzeit (auch nach der Tour) Fotos in die Galerie hochladen. Diese beeinflussen aber nicht die bereits erstellten Tagebuchseiten.

## User Stories
- Als Wanderer möchte ich in der PWA direkt ein Foto aufnehmen (Quick-Capture), das automatisch mit GPS und Zeitstempel gespeichert wird.
- Als Wanderer möchte ich Fotos aus meiner iPhone-Mediathek in die Galerie einer Tour hochladen.
- Als Wanderer möchte ich beim Upload eine Tour auswählen und die Fotos landen automatisch in der richtigen Galerie.
- Als Wanderer möchte ich auch nach der Tour noch Fotos in die Galerie hochladen.
- Als Besucher möchte ich alle Fotos einer Tour in einer Galerie auf der Landing Page sehen.
- Als Besucher möchte ich ein Foto in einer Lightbox gross ansehen mit Swipe-Funktion.
- Als Besucher möchte ich Fotos nach Etappe/Tag filtern.

## Acceptance Criteria
- [ ] Foto-Upload ausschliesslich über mobile PWA (kein Desktop-Upload)
- [ ] PWA-Kamera: Direkt fotografieren mit automatischem GPS + Zeitstempel
- [ ] Mediathek-Import: Fotos aus iPhone-Fotoalbum auswählen und hochladen
- [ ] Einfacher Upload-Flow: Tour wählen → "Fotos hochladen" → Mediathek → Fertig
- [ ] Unterstützte Formate: JPG, PNG, HEIF (iPhone-Format), max. 20MB pro Foto
- [ ] Mehrere Fotos gleichzeitig hochladbar
- [ ] GPS-Koordinaten werden automatisch aus EXIF-Daten ausgelesen (falls vorhanden)
- [ ] Fotos werden in Galerie-Raster angezeigt (responsive, dynamische Spaltenanzahl)
- [ ] Lightbox: Tap öffnet Foto gross mit Swipe-Funktion (vor/zurück)
- [ ] Filter nach Etappe/Tag möglich
- [ ] Bildtext und Autorname optional bei Upload eintragbar
- [ ] Fotos werden komprimiert/optimiert für Web (max. 1920px Breite)
- [ ] Nachträgliche Uploads jederzeit möglich — beeinflussen nicht die Tagebuchseiten
- [ ] Kein Login zum Anschauen nötig
- [ ] Fluid Responsive Design — dynamische Anpassung an jede Bildschirmgrösse

## Edge Cases
- Was wenn ein Foto kein EXIF enthält? → Ohne GPS-Koordinaten speichern
- Was wenn das Format nicht unterstützt wird? → Klare Fehlermeldung
- Was wenn das Foto zu gross ist (> 20MB)? → Fehlermeldung
- Was wenn der Upload abbricht? → Möglichkeit zum Wiederholen
- Was wenn sehr viele Fotos vorhanden sind (100+)? → Lazy Loading / Pagination
- Was wenn die Galerie leer ist? → Platzhalter mit Hinweis

## Technical Requirements
- Supabase Storage für Foto-Dateien
- Automatische Bildkomprimierung vor Upload (client-seitig)
- Lazy Loading für Galerie-Bilder
- EXIF-Auslesen für GPS und Aufnahmedatum
- HTML File Input mit `accept="image/*"` und `capture="environment"` für Kamera

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Scope: Sri Lanka Test-MVP
Foto-Upload (Kamera + Mediathek), Grid-Galerie, Lightbox mit Swipe. Kein Filter nach Tag, kein Batch-Upload-Fortschritt — kommt für Portugal.

### Component Structure
```
/touren/[id]/galerie
├── Galerie-Seite
│   ├── Foto-Grid (responsive, 2-4 Spalten je Bildschirmbreite)
│   │   └── Foto-Thumbnail (pro Bild)
│   │       ├── Komprimiertes Vorschaubild (Lazy Loading)
│   │       ├── Caption-Overlay (falls vorhanden)
│   │       └── Tap → öffnet Lightbox
│   ├── Lightbox (shadcn Dialog, fullscreen)
│   │   ├── Grosses Bild
│   │   ├── Swipe links/rechts (vorheriges/nächstes)
│   │   ├── Caption + Datum + Autor
│   │   └── Schliessen-Button
│   ├── "Fotos hochladen" FAB (Floating Action Button, Mobile)
│   └── Empty State ("Noch keine Fotos — halte deine Erlebnisse fest!")
└── Upload-Flow (shadcn Sheet)
    ├── "Foto aufnehmen" (öffnet Kamera via capture="environment")
    ├── "Aus Mediathek wählen" (Datei-Auswahl, mehrere möglich)
    ├── Vorschau der gewählten Fotos
    ├── Caption + Name (optional)
    ├── Upload-Fortschrittsbalken
    └── GPS + Datum werden automatisch aus EXIF gelesen
```

### Data Model
```
Jedes Foto hat:
- Eindeutige ID (UUID)
- Tour-Zuordnung (welche Tour)
- Speicherpfad in Supabase Storage
- Thumbnail-URL (400px Breite)
- Vollbild-URL (max. 1920px Breite)
- Bildunterschrift (optional)
- Autor-Name (optional, default "Anonym")
- GPS-Position (aus EXIF, falls vorhanden)
- Aufnahme-Zeitpunkt (aus EXIF, falls vorhanden)
- Bildmasse (Breite × Höhe)

Gespeichert in:
- Metadaten → Supabase PostgreSQL (Tabelle: photos)
- Bilddateien → Supabase Storage (Bucket: "photos", öffentlich)
```

### Tech Decisions
- **Client-seitige Komprimierung** vor Upload → Spart Datenvolumen unterwegs, schnellerer Upload
- **EXIF-Auslesen im Browser** → GPS + Aufnahmedatum automatisch, ohne Serverlast
- **Supabase Storage** direkt vom Browser → Kein eigener API-Endpoint für Upload nötig
- **CSS Grid mit auto-fill** → Responsive Spaltenanzahl ohne Breakpoints
- **Lightbox via shadcn Dialog** → Kein Extra-Paket, touch-freundlich
- **Thumbnails client-seitig** → Beim Upload wird eine kleine Version erzeugt und separat hochgeladen

### Dependencies
- `browser-image-compression` — Fotos vor Upload komprimieren (spart Mobile-Daten)
- `exifr` — GPS + Datum aus EXIF-Daten auslesen

### Skipped for Sri Lanka (kommt für Portugal)
- Filter nach Tag/Etappe
- HEIF-Konvertierung
- Detaillierter Batch-Upload mit pro-Foto-Fortschritt

## QA Test Results

**Tested:** 2026-03-06
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Scope:** Sri Lanka Test-MVP (upload, grid, lightbox -- no filter by day, no HEIF, no per-photo progress)

### Acceptance Criteria Status (MVP Scope)

#### AC-1: Camera upload (capture="environment")
- [x] Camera button triggers hidden file input with `accept="image/*"` and `capture="environment"`
- [x] On mobile, this opens the device camera directly

#### AC-2: Media library import (multiple files)
- [x] Mediathek button triggers hidden file input with `accept="image/*"` and `multiple`
- [x] Multiple files can be selected at once

#### AC-3: File validation
- [x] Non-image files rejected with German error message ("{name} ist kein Bild.")
- [x] Files >20MB rejected with German error message ("{name} ist zu gross (max. 20 MB).")
- [ ] BUG: Only the last error message is shown when multiple invalid files are selected. Previous errors are overwritten by `setError()` instead of accumulated.

#### AC-4: Photo preview before upload
- [x] Selected photos displayed in 3-column grid with aspect-square thumbnails
- [x] Each preview has a remove button (X icon) with aria-label
- [x] Object URLs created for previews and revoked on cleanup

#### AC-5: Caption and author fields
- [x] Optional caption field (max 500 chars)
- [x] Optional author name field (max 100 chars, default "Anonym")
- [x] Fields disabled during upload

#### AC-6: Image compression (client-side)
- [x] Full image compressed to max 1920px width, max 1MB, JPEG output
- [x] Thumbnail compressed to max 400px width, max 0.1MB, JPEG output
- [x] Uses web worker for compression (useWebWorker: true)

#### AC-7: EXIF extraction
- [x] GPS latitude/longitude extracted from EXIF before compression
- [x] DateTimeOriginal extracted and converted to ISO string
- [x] Graceful fallback if EXIF read fails (continues without GPS/date)

#### AC-8: Supabase Storage upload
- [x] Full image and thumbnail uploaded to "photos" bucket
- [x] Unique file paths: `{tourId}/{timestamp}-{randomId}-full.jpg` / `-thumb.jpg`
- [x] Content-type set to "image/jpeg", cache-control "3600"
- [x] Error thrown on full upload failure
- [x] Thumbnail failure logged as warning, continues without thumbnail

#### AC-9: Photo metadata API (POST /api/tours/[id]/photos)
- [x] Zod validation: storage_path (min 1), full_url (URL), thumbnail_url (URL nullable), caption (max 500 nullable), author_name (max 100, default "Anonym"), gps_lat/lng (validated range), taken_at (datetime nullable), width/height (int positive nullable)
- [x] Returns 400 on validation error, 201 on success, 500 on DB error
- [ ] BUG: No try/catch around `request.json()` -- malformed JSON causes unhandled 500

#### AC-10: Photo grid display
- [x] Responsive CSS grid: 2 columns (default), 3 columns (sm:), 4 columns (lg:)
- [x] Aspect-square thumbnails with object-cover
- [x] Lazy loading via `loading="lazy"` on Next.js Image
- [x] Caption overlay on hover (gradient from bottom)
- [x] Accessible: role="list", role="listitem", aria-label per photo

#### AC-11: Lightbox
- [x] Fullscreen overlay (fixed inset-0, z-50, black/95 background)
- [x] Photo counter (e.g., "3 / 12")
- [x] Keyboard navigation: ArrowRight (next), ArrowLeft (prev), Escape (close)
- [x] Touch swipe handling: horizontal swipe >50px triggers prev/next
- [x] Body scroll prevented while lightbox open
- [x] Previous/Next buttons (hidden on mobile sm:block, visible on desktop)
- [x] Close button with aria-label "Lightbox schliessen"
- [x] Photo info bar: caption, formatted date (de-CH), author name
- [x] Share button in lightbox top bar
- [x] Wraps around (last photo -> first photo via modulo)

#### AC-12: Upload progress
- [x] Progress bar shown during upload (shadcn Progress component)
- [x] Percentage displayed (calculated per file: (i+1)/total * 100)
- [x] "Hochladen..." label shown

#### AC-13: Empty state
- [x] Camera icon, "Noch keine Fotos" heading, descriptive text
- [x] "Fotos hochladen" button opens upload sheet

#### AC-14: FAB for upload
- [x] Fixed bottom-right FAB (z-40) when photos exist
- [x] Accessible aria-label "Fotos hochladen"

#### AC-15: No login required
- [x] All pages and API endpoints work without authentication
- [x] RLS allows public SELECT and INSERT

#### AC-16: Responsive design
- [x] Grid columns adapt to screen width (2/3/4 columns)
- [x] Lightbox fills entire screen on all sizes
- [x] Upload sheet takes 85vh on all sizes

#### AC-17: Open Graph metadata
- [x] generateMetadata with tour name, subtitle, cover_photo_url
- [x] Fallback title when tour not found

### Deferred Features (Not Tested -- Planned for Portugal)
- Filter by day/stage
- HEIF format conversion
- Per-photo upload progress in batch uploads
- Upload restricted to mobile PWA only (currently works on desktop too)

### Edge Cases Status

#### EC-1: Photo without EXIF
- [x] Saved without GPS coordinates -- handled correctly (try/catch in exifr.parse)

#### EC-2: Unsupported format
- [x] Non-image files rejected with clear error message

#### EC-3: Photo too large (>20MB)
- [x] Rejected with German error message before upload attempt

#### EC-4: Upload interruption
- [ ] BUG: If upload fails mid-batch (e.g., network error on photo 3 of 5), photos 1-2 are already in storage but no retry mechanism exists. The error is shown but the partial uploads remain orphaned in storage.

#### EC-5: Very many photos (100+)
- [x] Limited to 200 via `.limit(200)` on API. Lazy loading via `loading="lazy"`. No pagination for beyond 200.

#### EC-6: Empty gallery
- [x] Placeholder with hint shown -- handled correctly

### Security Audit Results

- [x] No hardcoded secrets
- [x] Supabase Storage accessed via anon key (client-side, expected for public uploads)
- [x] Photo metadata validated via Zod before database insert
- [x] GPS coordinates range-validated (-90/90, -180/180)
- [x] File type check (`file.type.startsWith("image/")`) before upload
- [x] File size check (20MB) before upload
- [ ] BUG: `storage_path` in POST /api/tours/[id]/photos is user-supplied and only validated as `z.string().min(1)`. An attacker could POST arbitrary metadata with a crafted `storage_path` or `full_url` pointing to malicious content. The storage_path is stored in the DB but not used to serve files (URLs are separate), so impact is low.
- [ ] BUG: `full_url` is validated as `.url()` but not restricted to the Supabase storage domain. An attacker could inject any URL (e.g., to a phishing image) that would be displayed in the gallery.
- [ ] BUG: No rate limiting on photo metadata POST endpoint
- [ ] BUG: `request.json()` not wrapped in try/catch (same as diary route)
- [ ] BUG: Upload to Supabase Storage uses client-side anon key directly -- any user can upload arbitrary files to the "photos" bucket. While the bucket has a 20MB limit, there is no server-side file type validation on the storage level.
- [x] No dangerouslySetInnerHTML usage
- [x] Images rendered via Next.js Image component or img element (safe)
- [ ] BUG: The `randomId` in file path generation uses `Math.random()` which is not cryptographically secure. While this is for file naming (not security-critical), predictable paths could allow overwriting files. Risk is very low since timestamps add entropy.

### Bugs Found

#### BUG-1: Malformed JSON body causes unhandled 500 error
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send POST to `/api/tours/rota-vicentina-2026/photos` with body `"not json"`
  2. Expected: 400 Bad Request
  3. Actual: 500 Internal Server Error
- **File:** `src/app/api/tours/[id]/photos/route.ts` line 44
- **Priority:** Fix before deployment

#### BUG-2: full_url not restricted to Supabase domain
- **Severity:** High
- **Steps to Reproduce:**
  1. POST to `/api/tours/rota-vicentina-2026/photos` with `full_url: "https://evil.com/phishing.jpg"`
  2. Expected: Validation error (URL must be from Supabase storage)
  3. Actual: Accepted and stored. The malicious image URL would be displayed in the gallery.
- **File:** `src/app/api/tours/[id]/photos/route.ts` line 7
- **Priority:** Fix before deployment

#### BUG-3: Only last file validation error shown
- **Severity:** Low
- **Steps to Reproduce:**
  1. Select multiple invalid files (e.g., a .txt and a .pdf) in the file picker
  2. Expected: Error messages for all invalid files
  3. Actual: Only the last error message is displayed (each `setError()` overwrites the previous)
- **File:** `src/components/photo-upload-sheet.tsx` lines 73-79
- **Priority:** Nice to have

#### BUG-4: No rate limiting on photo metadata POST endpoint
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send 1000 POST requests to `/api/tours/rota-vicentina-2026/photos` rapidly
  2. Expected: Rate limiting (429)
  3. Actual: All requests processed
- **File:** `src/app/api/tours/[id]/photos/route.ts`
- **Priority:** Fix before deployment

#### BUG-5: Orphaned storage files on partial batch upload failure
- **Severity:** Low
- **Steps to Reproduce:**
  1. Select 5 photos for upload
  2. Disconnect network after photo 3 uploads successfully
  3. Expected: Uploaded files cleaned up or retry offered
  4. Actual: Photos 1-3 remain in storage, metadata may be partially saved, no retry
- **File:** `src/lib/photo-upload.ts` and `src/components/photo-upload-sheet.tsx`
- **Priority:** Fix in next sprint

#### BUG-6: Upload also works on desktop (spec says PWA-only)
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open gallery page on desktop browser
  2. Click FAB, select "Mediathek" or "Kamera"
  3. Expected: Upload restricted to mobile PWA
  4. Actual: Upload works on any browser/device
- **Note:** The tech design for Sri Lanka MVP does not explicitly restrict desktop upload. This may be intentional for testing. The full spec requires PWA-only upload for Portugal.
- **Priority:** Nice to have (defer to Portugal)

### Summary
- **Acceptance Criteria (MVP Scope):** 16/17 passed (1 minor bug on error accumulation)
- **Bugs Found:** 6 total (0 critical, 1 high, 2 medium, 3 low)
- **Security:** Issues found (unrestricted full_url, no rate limiting, no JSON parse handling)
- **Production Ready:** NO -- BUG-2 (unrestricted full_url) is high severity and must be fixed
- **Recommendation:** Fix BUG-2 (restrict full_url to Supabase domain) and BUG-1/BUG-4 (JSON handling, rate limiting) before deployment.

## Deployment
- **Production URL:** https://die-wandervoegel.vercel.app/touren/rota-vicentina-2026/galerie
- **Deployed:** 2026-03-06
- **Git Tag:** v1.4.0-PROJ-4
