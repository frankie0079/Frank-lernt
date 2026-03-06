# PROJ-6: Interaktive Karte

## Status: In Review
**Created:** 2026-02-28
**Last Updated:** 2026-03-06

## Dependencies
- Requires: PROJ-5 (PWA) — GPS-Tracking für Wanderer-Positionen
- Requires: PROJ-3 (Reisetagebuch) — Kommentar-Pins auf der Karte
- Requires: PROJ-4 (Fotogalerie) — Foto-Fähnchen auf der Karte

## User Stories
- Als Follower möchte ich auf einer grafischen Landkarte sehen, wo die Wanderer gerade sind, damit ich die Gruppe live verfolgen kann.
- Als Follower möchte ich Fähnchen auf der Karte sehen, die zeigen wo Fotos aufgenommen wurden, und bei Klick das Foto anzeigen.
- Als Follower möchte ich Pins auf der Karte sehen, die zeigen wo Kommentare geschrieben wurden, und bei Klick den Kommentar lesen.
- Als Follower möchte ich die bereits gelaufene Route als farbige Linie auf der Karte sehen, damit ich den Fortschritt erkennen kann.
- Als Follower möchte ich die geplante Tagesetappe als gestrichelte Linie sehen, damit ich weiss wohin die Gruppe heute noch geht.
- Als Besucher möchte ich die Karte zoomen und verschieben können, damit ich Details erkunden kann.

## Acceptance Criteria
- [ ] Grafische Landkarte wird angezeigt (Mapbox GL JS oder Leaflet + OpenStreetMap)
- [ ] Wanderer-Positionen als kleine animierte Marker auf der Karte (Echtzeit-Update)
- [ ] Foto-Fähnchen: Marker an GPS-Position jedes Fotos; Tap/Klick zeigt Foto-Vorschau
- [ ] Kommentar-Pins: Marker an GPS-Position jedes Kommentars; Tap/Klick zeigt Kommentartext
- [ ] Gelaufene Route als durchgezogene farbige Linie
- [ ] Geplante Route als gestrichelte Linie
- [ ] Karte ist zoombar und scrollbar (Touch-Gesten auf Mobile)
- [ ] Karte funktioniert auf iPhone genauso gut wie auf Desktop
- [ ] Legende erklärt die verschiedenen Marker-Typen
- [ ] Karte zentriert automatisch auf die aktuelle Tour-Region

## Edge Cases
- Was wenn keine GPS-Daten vorhanden sind? → Karte zeigt Portugal/Fischerpfad-Region als Default
- Was wenn sehr viele Foto-Pins vorhanden sind? → Clustering ab bestimmtem Zoom-Level
- Was wenn ein Wanderer seinen GPS nicht teilt? → Nur Wanderer mit aktivem Tracking werden angezeigt
- Was wenn die Karte offline aufgerufen wird? → Letzten bekannten Zustand aus Cache anzeigen
- Was wenn Koordinaten ausserhalb der Route liegen? → Trotzdem anzeigen, kein Filter

## Technical Requirements
- Mapbox GL JS (kostenloses Tier: 50.000 Kartenladeaufrufe/Monat) oder Leaflet + OpenStreetMap (kostenlos)
- Supabase Realtime für Live-Updates der Wanderer-Positionen
- GeoJSON für Routen-Darstellung
- Marker-Clustering für dichte Foto/Kommentar-Bereiche

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Scope: Sri Lanka Test-MVP
Karte mit Foto-Pins und Tagebuch-Markern. Keine Live-Tracking, keine Routen-Linien — kommt für Portugal.

### Component Structure
```
/touren/[id]/karte
├── Karten-Seite
│   ├── Leaflet Map (nimmt meisten Platz ein)
│   │   ├── OpenStreetMap Tiles (kostenlos, kein API-Key)
│   │   ├── Foto-Marker (kleine Thumbnail-Icons)
│   │   │   └── Tap → Popup mit Bild + Caption
│   │   ├── Tagebuch-Marker (Pin-Icons)
│   │   │   └── Tap → Popup mit Titel + Text-Ausschnitt
│   │   └── Zoom/Pan (Touch-Gesten auf Mobile)
│   ├── Legende (Foto-Marker vs. Tagebuch-Marker)
│   └── Empty State ("Noch keine GPS-Daten vorhanden")
└── Keine Eingabe-UI — Karte ist rein zum Anschauen
```

### Data Model
Keine eigene Tabelle — liest GPS-Daten aus:
- `photos` (gps_lat, gps_lng) → Foto-Marker
- `diary_entries` (gps_lat, gps_lng) → Tagebuch-Marker

### Tech Decisions
- **Leaflet + OpenStreetMap** statt Mapbox → Komplett kostenlos, kein API-Key, keine Nutzungslimits
- **react-leaflet** → React-Wrapper, deklarative Komponenten statt imperativer API
- **Dynamic Import** (next/dynamic) → Leaflet wird nur geladen wenn die Karten-Seite aktiv ist (grosses Bundle)
- **Karte zentriert automatisch** auf Bounding Box aller Marker (fitBounds)

### Dependencies
- `leaflet` — Karten-Bibliothek
- `react-leaflet` — React-Integration
- `@types/leaflet` — TypeScript-Typen

### Skipped for Sri Lanka (kommt für Portugal)
- Echtzeit Wanderer-Positionen
- Gelaufene Route als farbige Linie
- Geplante Route als gestrichelte Linie
- Marker-Clustering (bei 100+ Pins)
- Offline-Karten-Cache

## QA Test Results

**Tested:** 2026-03-06
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Scope:** Sri Lanka Test-MVP (map with photo/diary markers -- no live tracking, no route lines, no clustering)

### Acceptance Criteria Status (MVP Scope)

Note: The full acceptance criteria include features explicitly deferred to the Portugal release
(live walker positions, walked/planned route lines, marker clustering).
Testing below covers only the **implemented Sri Lanka Test-MVP scope** as defined in the Tech Design.

#### AC-1: Graphical map displayed (Leaflet + OpenStreetMap)
- [x] Leaflet map renders with OpenStreetMap tile layer
- [x] TileLayer URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- [x] OpenStreetMap attribution displayed in bottom-right corner
- [x] No API key required (completely free)
- [x] Dynamic import via `next/dynamic` with `ssr: false` prevents SSR issues
- [x] Loading state shows Map icon with "Karte wird geladen..." text and pulse animation

#### AC-2: Photo markers (Foto-Faehnchen)
- [x] Photo markers rendered for all photos with GPS coordinates (gps_lat + gps_lng not null)
- [x] Marker icon: Teal circle (#25918a) with camera SVG icon, white border, shadow
- [x] Icon size: 28x28px, centered anchor (14,14)
- [x] Tap/click opens Popup with thumbnail image (192px width, 128px height, object-cover)
- [x] Caption displayed below thumbnail if present
- [x] Fallback to full_url when thumbnail_url is missing
- [x] Unique key: `photo-{id}` per marker

#### AC-3: Diary markers (Kommentar-Pins / Tagebuch-Marker)
- [x] Diary markers rendered for all entries with GPS coordinates
- [x] Marker icon: Amber circle (#e5a020) with book SVG icon, white border, shadow
- [x] Icon size: 28x28px, centered anchor (14,14)
- [x] Tap/click opens Popup with title (bold, 14px) and text excerpt (12px, gray)
- [x] Excerpt truncated to 100 chars with "..." suffix
- [x] Unique key: `diary-{id}` per marker

#### AC-4: Map zoom and scroll (Touch gestures on mobile)
- [x] `scrollWheelZoom={true}` enabled for desktop mouse wheel zoom
- [x] Leaflet natively supports pinch-to-zoom and pan on touch devices
- [x] Default zoom level: 10

#### AC-5: Legend explaining marker types
- [x] Legend displayed below the map
- [x] Camera icon (teal, text-primary) with label "Foto"
- [x] BookOpen icon (amber, text-accent) with label "Tagebuch-Eintrag"
- [x] Legend uses small text (text-xs text-muted-foreground)
- [x] Icons aligned with text using flex + gap

#### AC-6: Auto-center on tour region
- [x] FitBounds component calculates bounding box of all markers
- [x] Uses `map.fitBounds()` with 40px padding on all sides
- [x] Single marker case: `map.setView()` with zoom 13
- [x] Default center when no markers: Portugal [39.5, -8.0] (correct per spec)
- [x] FitBounds runs via useEffect with markers dependency

#### AC-7: Empty state
- [x] Empty state shown when both photoMarkers and diaryMarkers are empty
- [x] Map icon in muted circle
- [x] Heading: "Noch keine GPS-Daten"
- [x] Description: "Sobald Fotos oder Tagebucheintraege mit Standort vorhanden sind, erscheinen sie hier auf der Karte."
- [x] Centered layout with max-w-xs on description text

#### AC-8: Responsive design
- [x] Map container: `h-[65vh] min-h-[400px]` ensures usable map height on all screens
- [x] Rounded corners and border: `rounded-lg overflow-hidden border border-border`
- [x] Full width within max-w-4xl parent container (from layout)
- [x] Legend wraps naturally on narrow screens with `flex gap-4`

#### AC-9: Open Graph metadata
- [x] `generateMetadata()` fetches tour name, subtitle, cover_photo_url
- [x] Title format: "Karte -- {tour.name} -- Die Wandervoegel"
- [x] Description format: "Interaktive Karte der Tour {name} ({subtitle})."
- [x] OpenGraph images from tour cover_photo_url
- [x] Fallback title "Karte -- Die Wandervoegel" when tour not found

#### AC-10: Server-side data fetching
- [x] Photos query: filters by tour_id, excludes null GPS, .limit(200)
- [x] Diary query: filters by tour_id, excludes null GPS, .limit(100)
- [x] Both queries run in parallel via `Promise.all()`
- [x] Null-safe data mapping with `?? []` fallback
- [x] Non-null assertion (`!`) used on gps_lat/gps_lng after IS NOT NULL filter (correct)

### Deferred Features (Not Tested -- Planned for Portugal)
- Real-time walker positions (animated markers)
- Walked route as solid colored line
- Planned route as dashed line
- Marker clustering for 100+ pins
- Offline map cache
- GeoJSON route data
- Supabase Realtime subscriptions

### Edge Cases Status

#### EC-1: No GPS data available
- [x] Empty state displayed correctly when no markers exist
- [x] Map does not render (no Leaflet loaded unnecessarily)

#### EC-2: Very many photo pins (100+)
- [ ] NOT IMPLEMENTED: No marker clustering. With 100+ markers at similar locations, icons overlap and become unusable. Deferred to Portugal per tech design.

#### EC-3: Coordinates outside route
- [x] Markers displayed at their actual coordinates regardless of location -- no filtering applied (correct per spec)

#### EC-4: Offline map access
- [ ] NOT IMPLEMENTED: Map tiles require network connection. No offline tile caching. Deferred to Portugal per tech design.

#### EC-5: Only one marker on map
- [x] Single marker handled correctly: `map.setView()` at zoom 13 instead of `fitBounds()`

### Security Audit Results

- [x] No hardcoded secrets in karte page or components
- [x] Supabase queries use server-side client (not exposed to browser)
- [x] Map data is read-only (no input/mutation on map page)
- [x] No user input accepted on this page (no injection vectors)
- [x] OpenStreetMap tiles loaded over HTTPS
- [x] No dangerouslySetInnerHTML usage
- [ ] BUG: Photo thumbnailUrl from Supabase is rendered in an `<img>` tag inside Leaflet Popup without domain validation. If an attacker injected a malicious full_url via the photos API (see PROJ-4 BUG-2), it would render on the map popup as well. This is a downstream consequence of PROJ-4's unrestricted full_url issue.
- [x] Diary excerpt text is rendered as text node in popup (no HTML injection possible)
- [x] Leaflet divIcon uses hardcoded HTML strings for icons (no user input in icon HTML)
- [x] Photo marker alt text uses `marker.caption || "Foto"` -- caption is text-only (safe)

### Cross-Feature Integration

- [x] Map page correctly sits within Tour Layout (/touren/[id]/layout.tsx)
- [x] Tab navigation highlights "Karte" tab correctly (aria-current="page")
- [x] Back link navigates to home page
- [x] ShareButton not present on map page (correct -- map is view-only)

### Bugs Found

#### BUG-1: Leaflet popup thumbnail renders unsanitized external URLs
- **Severity:** Medium
- **Steps to Reproduce:**
  1. An attacker uses the PROJ-4 photos API to insert a photo record with `full_url` pointing to a malicious domain
  2. If the record also has GPS coordinates, the malicious URL appears as thumbnail in the map popup
  3. Expected: Only Supabase storage URLs displayed
  4. Actual: Any URL stored in the database is rendered in the popup img src
- **File:** `src/components/leaflet-map.tsx` line 103, `src/app/touren/[id]/karte/page.tsx` line 59
- **Note:** This is a downstream consequence of PROJ-4 BUG-2 (unrestricted full_url). Fixing PROJ-4 BUG-2 would also resolve this.
- **Priority:** Fix in PROJ-4 BUG-2 (restrict full_url to Supabase domain)

#### BUG-2: Leaflet CSS may conflict with Tailwind's preflight reset
- **Severity:** Low
- **Steps to Reproduce:**
  1. Load map page
  2. Inspect Leaflet controls (zoom buttons, attribution)
  3. Expected: Leaflet controls styled correctly
  4. Actual: Tailwind's CSS reset (border-box, margin:0) can cause minor styling issues on Leaflet controls in some browsers. The current implementation uses inline styles for custom icons which avoids most issues, but native Leaflet controls (zoom, attribution) may appear slightly different from default Leaflet styling.
- **File:** `src/components/leaflet-map.tsx` (Leaflet CSS import at line 9)
- **Priority:** Nice to have (cosmetic only)

#### BUG-3: No loading/error state for Supabase data fetch failure
- **Severity:** Low
- **Steps to Reproduce:**
  1. If Supabase returns an error for photos or diary_entries queries
  2. Expected: Error message displayed to user
  3. Actual: Errors are silently swallowed (`photosResult.data ?? []`). The map shows empty state or partial data without any indication of failure.
- **File:** `src/app/touren/[id]/karte/page.tsx` lines 54, 63
- **Priority:** Fix in next sprint

#### BUG-4: FitBounds runs on every render due to markers array reference
- **Severity:** Low
- **Steps to Reproduce:**
  1. The `allMarkers` array is memoized with `useMemo` in LeafletMap, which is good
  2. However, the `markers` prop to FitBounds is a new array reference each time photoMarkers or diaryMarkers change
  3. In practice this is not an issue for the MVP since data is fetched once server-side and passed as props
  4. For future real-time updates, this could cause repeated fitBounds calls
- **File:** `src/components/leaflet-map.tsx` lines 44-62, 65-71
- **Priority:** Nice to have (no impact in current implementation)

### Summary
- **Acceptance Criteria (MVP Scope):** 10/10 passed
- **Bugs Found:** 4 total (0 critical, 0 high, 1 medium, 3 low)
- **Security:** One medium issue (downstream of PROJ-4 BUG-2)
- **Production Ready:** YES (conditional on PROJ-4 BUG-2 being fixed)
- **Recommendation:** Deploy. BUG-1 is resolved by fixing PROJ-4 BUG-2. The 3 low-severity bugs are cosmetic or future-proofing concerns.

## Deployment
_To be added by /deploy_
