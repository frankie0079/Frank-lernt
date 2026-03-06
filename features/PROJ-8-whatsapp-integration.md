# PROJ-8: WhatsApp-Integration — Tages-Summary für Friends & Family

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-3 (Reisetagebuch) — Summary wird als Tagebuchseite archiviert
- Requires: PROJ-4 (Fotogalerie) — Fotos als Content-Quelle
- Requires: PROJ-6 (Interaktive Karte) — Kartenausschnitt / Routenanimation
- Requires: PROJ-7 (Tages-Statistiken) — Facts & Figures

## Konzept

WhatsApp ist der **primäre Kanal für Follower** (Friends & Family). Tagsüber sammeln alle Wanderer Content über die PWA. Am Abend wird aus den gesammelten Inhalten eine kreative Tages-Summary erstellt und per WhatsApp gepostet.

**Kein Zwischenposting** — nur eine tägliche Summary.

**Doppelte Verwendung:** Jede Tages-Summary wird automatisch als neue Seite im digitalen Reisetagebuch auf der Landing Page archiviert (siehe PROJ-3).

## Content-Box (Medienbibliothek)

Eine jederzeit erweiterbare Bibliothek mit kreativen Assets für die Summary-Generierung:

**Musik:**
- Landestypische Musik passend zur Tour-Region (z.B. portugiesische Volksmusik / Fado für Rota Vicentina)
- 3-5+ lizenzfreie Tracks
- Bei jeder neuen Tour wird die Musik an das Reiseland angepasst
- Wanderer wählt den Track für die Tages-Summary

**Bilder & Hintergründe:**
- Webbilder der Tour-Region (Rota Vicentina, Fischerpfad, Atlantikküste)
- Hintergründe/Texturen (Landkarten-Optik, Papier, Natur)
- Stimmungsbilder als Zwischenbilder in der Diashow

**Grafische Elemente:**
- Wandervögel-Logo (Logo_Wandervoegel.JPG)
- Rahmen, Trennlinien, Icons (Wanderschuh, Kompass, Höhenmeter)
- Intro/Outro-Templates mit Branding

**Erweiterbar:** Content-Box kann jederzeit ergänzt werden — vor und während der Tour.

## User Flow (Abend-Workflow)

```
1. Wanderer öffnet "Tages-Summary" in der PWA
2. Alle gesammelten Inhalte des Tages werden angezeigt
   (Fotos, Kommentare, Statistiken, Kartenroute — von allen Wanderern)
3. Jeder Inhalt hat einen einfachen Toggle: ✓ auswählen / ✗ abwählen
4. Wanderer wählt einen Musik-Track aus der Content-Box
5. Tap auf "Summary erstellen"
6. Generator baut kreative Summary:
   - Intro mit Logo + Etappenname
   - Karten-Animation der Route
   - Ausgewählte Fotos mit Übergängen
   - Webbilder/Hintergründe aus Content-Box als Zwischenbilder
   - Kommentare als stylische Text-Overlays
   - Facts & Figures als Grafik
   - Outro mit Branding + Rück-Link
   - Gewählter Musik-Track als Hintergrundmusik
7. Vorschau der fertigen Summary
8. Ein Tap → per WhatsApp an Friends & Family senden
9. Summary wird automatisch als neue Seite im Reisetagebuch archiviert
```

## Summary-Formate (automatisch gewählt nach Content-Menge)

- **Video/Diashow (5+ Fotos):** Musik + Intro → Karten-Animation → Foto-Slideshow mit Übergängen + Webbilder als Zwischenbilder → Kommentare → Facts & Figures → Outro mit Rück-Link (30-60 Sek.)
- **Bild-Collage (2-4 Fotos):** Collage der Fotos + Statistiken + Etappenname + Rück-Link
- **Einzelbild-Postkarte (1 Foto):** Foto + Karten-Overlay + Statistiken + Rück-Link

## User Stories
- Als Wanderer möchte ich am Abend alle gesammelten Inhalte des Tages sehen und per Tap auswählen, welche in die Summary kommen.
- Als Wanderer möchte ich einen passenden landestypischen Musik-Track für die Tages-Summary wählen.
- Als Wanderer möchte ich, dass der Generator kreativ eine professionell wirkende Summary baut — mit Musik, Übergängen, Webbildern und Branding.
- Als Wanderer möchte ich die Content-Box jederzeit mit neuen Assets befüllen (Musik, Bilder, Hintergründe).
- Als Wanderer möchte ich die fertige Summary ansehen und mit einem Tap per WhatsApp versenden.
- Als Follower möchte ich jeden Abend eine schöne, kreative Zusammenfassung des Wandertages per WhatsApp erhalten.
- Als Follower möchte ich über einen Rück-Link in der Summary zur Plattform gelangen können.

## Acceptance Criteria
- [ ] Content-Box: Medienbibliothek für Musik, Webbilder, Hintergründe, grafische Elemente
- [ ] Content-Box ist jederzeit erweiterbar (Upload von Musik, Bildern, etc.)
- [ ] Musik-Tracks sind landestypisch (z.B. portugiesische Volksmusik/Fado für Rota Vicentina)
- [ ] Tages-Übersicht zeigt alle gesammelten Inhalte aller Wanderer des Tages
- [ ] Jeder Inhalt hat einen einfachen Auswahl-Toggle
- [ ] Musik-Track-Auswahl aus der Content-Box (min. 3 Optionen)
- [ ] "Summary erstellen"-Button generiert kreative Zusammenfassung
- [ ] Summary nutzt Content-Box-Assets (Webbilder, Hintergründe, Logo, Rahmen)
- [ ] Musik ist als Hintergrund im Video hörbar (Fade-in/out)
- [ ] Format wird automatisch gewählt: Video (5+ Fotos), Collage (2-4), Postkarte (1)
- [ ] Vorschau der fertigen Summary vor dem Versenden
- [ ] Video ist WhatsApp-kompatibel (MP4, max. 16MB, 30-60 Sekunden)
- [ ] Ein Tap sendet die Summary per WhatsApp (Web Share API)
- [ ] Summary enthält Rück-Link zur Plattform
- [ ] Gesendete Summary wird automatisch als neue Seite im Reisetagebuch archiviert

## Edge Cases
- Was wenn kein Content vorhanden ist? → "Heute noch nichts gesammelt" — keine Summary möglich
- Was wenn nichts ausgewählt wird? → "Summary erstellen"-Button bleibt deaktiviert
- Was wenn keine Musik gewählt wird? → Standard-Track als Default
- Was wenn die Content-Box leer ist (keine Webbilder)? → Summary nur mit Tages-Fotos
- Was wenn das Video zu gross wird (> 16MB)? → Qualität/Länge automatisch reduzieren
- Was wenn WhatsApp nicht installiert ist? → Video/Bild in Zwischenablage kopieren
- Was wenn die Generierung fehlschlägt? → Fallback auf einfachere Variante (Collage statt Video)
- Was wenn kein Internet? → Summary lokal vorbereiten, bei Verbindung senden

## Technical Requirements
- Video-Generierung: Server-seitig (Supabase Edge Function + Remotion/FFmpeg) oder Client-seitig (Canvas API + MediaRecorder)
- Audio-Mixing: Musik + optionale Übergangssounds
- Supabase Storage für Content-Box-Assets und archivierte Summaries
- Web Share API für WhatsApp-Versand (mit Video/Bild-Datei)
- Open Graph Meta-Tags für Rück-Link-Vorschau in WhatsApp
- Touch-optimierte Auswahl-UI

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Scope: Sri Lanka Test-MVP
Share-Button für Tagebuch-Einträge und Fotos per WhatsApp. Schöne Link-Vorschau dank Open Graph Meta-Tags. Kein Video, keine Musik, keine Content-Box — kommt für Portugal.

### Component Structure
```
WhatsApp-Integration (kein eigene Seite — erweitert bestehende Komponenten)
├── Share-Button (wiederverwendbare Komponente)
│   ├── Erscheint bei jedem Tagebuch-Eintrag
│   ├── Erscheint bei jedem Foto in der Lightbox
│   ├── Nutzt Web Share API (natives Share-Sheet auf Mobile)
│   └── Fallback: WhatsApp-Deep-Link (wa.me) auf Desktop
├── Open Graph Meta-Tags (dynamisch pro Seite)
│   ├── /touren/[id]/tagebuch → Tour-Name + Beschreibung + Cover-Foto
│   ├── /touren/[id]/galerie → Tour-Name + Foto-Anzahl + Cover-Foto
│   └── Einzelne Einträge/Fotos → Titel + Vorschaubild
└── Rück-Link
    └── Jeder geteilte Link führt direkt zur richtigen Seite
```

### Data Model
Kein eigenes Datenmodell — nutzt bestehende Tour/Eintrag/Foto-Daten für Meta-Tags.

### Tech Decisions
- **Web Share API** → Natives Share-Sheet auf iPhone, WhatsApp ist ein Tap entfernt
- **Open Graph Meta-Tags** → WhatsApp zeigt automatisch Titel, Beschreibung und Vorschaubild
- **Dynamische Metadata** via Next.js `generateMetadata()` → Pro Tour/Eintrag eigene Vorschau
- **Fallback auf Desktop** → `https://wa.me/?text=...` Deep-Link wenn Web Share API nicht verfügbar

### Dependencies
Keine zusätzlichen — nutzt native Browser-APIs und Next.js Metadata API.

### Skipped for Sri Lanka (kommt für Portugal)
- Tages-Summary Generator
- Video/Diashow mit Musik
- Content-Box (Medienbibliothek)
- Postkarten-Generator (Foto + Overlay)
- Automatische Archivierung im Tagebuch

## QA Test Results

**Tested:** 2026-03-06
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Scope:** Sri Lanka Test-MVP (ShareButton component + OG meta tags -- no video, no music, no content box, no summary generator)

### Acceptance Criteria Status (MVP Scope)

Note: The full acceptance criteria include features explicitly deferred to the Portugal release
(content box, music, video/collage/postcard generation, summary editor, auto-archiving).
Testing below covers only the **implemented Sri Lanka Test-MVP scope** as defined in the Tech Design.

#### AC-1: ShareButton component (Web Share API)
- [x] ShareButton uses `navigator.share()` as primary sharing method (native share sheet on mobile)
- [x] Passes `title`, `text`, and `url` to the native share API
- [x] On successful share, shows Check icon for 2 seconds (visual feedback)
- [x] Handles `AbortError` gracefully (user cancelled native share -- no fallback triggered)
- [x] Falls through to WhatsApp fallback on share API error or unsupported browser

#### AC-2: WhatsApp fallback (Desktop)
- [x] When Web Share API is unavailable (e.g., desktop Chrome), falls back to `https://wa.me/?text=...` deep link
- [x] WhatsApp text includes title, text, and URL separated by newlines
- [x] Text properly URI-encoded via `encodeURIComponent()`
- [x] Opens in new tab with `_blank` and `noopener` (security: prevents window.opener access)
- [x] Shows Check icon after fallback trigger

#### AC-3: ShareButton variants
- [x] `variant="icon"`: Renders as a small icon-only button (Share2 icon, 16x16)
- [x] `variant="button"`: Renders as a shadcn Button with outline variant, size sm, "Teilen" label
- [x] Default variant is "icon"
- [x] Both variants have accessible `aria-label`: "{title} teilen" (icon variant), visible "Teilen" text (button variant)

#### AC-4: ShareButton integration -- Diary entries
- [x] ShareButton rendered on each diary entry card (in CardHeader, top-right)
- [x] Not shown while entry is in pending state (optimistic UI)
- [x] Title format: "{entry.title} -- {tourName}"
- [x] Text format: "{entry.title} -- Tagebuch von {tourName}"
- [x] URL: current page URL (window.location.href)

#### AC-5: ShareButton integration -- Lightbox
- [x] ShareButton rendered in lightbox top bar (next to close button)
- [x] Title: photo caption or "Foto -- {tourName}"
- [x] Text: "Schau dir dieses Foto an! -- {tourName}"
- [x] URL: current page URL
- [x] Icon variant used (small, fits in toolbar)

#### AC-6: Open Graph meta tags -- Tagebuch
- [x] `generateMetadata()` in tagebuch/page.tsx fetches tour data
- [x] Title: "Tagebuch -- {tour.name} -- Die Wandervoegel"
- [x] Description: "Reisetagebuch der Tour {name} ({subtitle})."
- [x] OpenGraph title: "Tagebuch -- {tour.name}"
- [x] OpenGraph images: tour cover_photo_url (if present)
- [x] Fallback title when tour not found

#### AC-7: Open Graph meta tags -- Galerie
- [x] `generateMetadata()` in galerie/page.tsx fetches tour data
- [x] Title: "Galerie -- {tour.name} -- Die Wandervoegel"
- [x] Description: "Fotogalerie der Tour {name} ({subtitle})."
- [x] OpenGraph title: "Galerie -- {tour.name}"
- [x] OpenGraph images: tour cover_photo_url (if present)
- [x] Fallback title when tour not found

#### AC-8: Open Graph meta tags -- Karte
- [x] `generateMetadata()` in karte/page.tsx fetches tour data
- [x] Title: "Karte -- {tour.name} -- Die Wandervoegel"
- [x] Description: "Interaktive Karte der Tour {name} ({subtitle})."
- [x] OpenGraph title: "Karte -- {tour.name}"
- [x] OpenGraph images: tour cover_photo_url (if present)
- [x] Fallback title when tour not found

#### AC-9: Shared links lead to correct page (Rueck-Link)
- [x] URLs shared via WhatsApp lead directly to the page being viewed
- [x] Tour pages use dynamic routes: `/touren/{tourId}/tagebuch`, `/galerie`, `/karte`
- [x] No authentication required to view shared links
- [x] Pages render server-side with OG meta tags (correct preview in WhatsApp)

### Deferred Features (Not Tested -- Planned for Portugal)
- Content Box (media library: music, backgrounds, graphics)
- Tages-Summary generator (select content, choose music, auto-generate)
- Video/Diashow with music (5+ photos)
- Bild-Collage (2-4 photos)
- Einzelbild-Postkarte (1 photo with map overlay)
- Summary preview before sending
- Auto-archiving in Reisetagebuch
- WhatsApp-compatible video format (MP4, max 16MB)

### Edge Cases Status

#### EC-1: Web Share API not available (desktop browsers)
- [x] WhatsApp deep link fallback works correctly
- [x] `navigator.share` availability checked before calling

#### EC-2: User cancels native share sheet
- [x] AbortError caught, no fallback triggered, no error shown -- handled correctly

#### EC-3: URL is empty or undefined
- [x] Fallback to `window.location.href` when url prop is empty string
- [ ] BUG: If `window` is undefined (SSR context), the fallback `typeof window !== "undefined" ? window.location.href : ""` could result in an empty URL being shared. However, since ShareButton is a client component ("use client"), this is only relevant during server-side rendering of the component tree, not during actual click handling. Impact is minimal.

#### EC-4: Very long title or text in share
- [x] No truncation applied -- WhatsApp handles long text in share content
- [ ] NOTE: The `encodeURIComponent()` of a very long text + URL could exceed URL length limits in some browsers for the wa.me fallback (max ~2000 chars). Not a bug for typical use but worth noting for future.

### Security Audit Results

- [x] No user input is rendered as HTML (title, text are text-only)
- [x] WhatsApp fallback URL uses `encodeURIComponent()` (prevents URL injection)
- [x] `window.open()` uses `noopener` to prevent reverse tabnapping
- [x] No secrets exposed in shared content
- [x] OG meta tags are generated server-side from Supabase data (not user-editable)
- [x] ShareButton does not send any data to third-party services (only native APIs or WhatsApp)
- [ ] BUG: Share URL uses `window.location.href` which includes the full URL. If query parameters with sensitive data are ever added to tour pages, they would be shared. Currently no query params are used, so impact is zero, but this pattern should be monitored.

### Cross-Feature Integration

- [x] ShareButton works correctly within Tagebuch entry cards (PROJ-3)
- [x] ShareButton works correctly within Photo Lightbox (PROJ-4)
- [x] No ShareButton on Map page (correct -- map is view-only, no per-item sharing needed)
- [x] OG meta tags consistent across all three tour sub-pages
- [x] OG fallback titles consistent when tour not found

### Bugs Found

#### BUG-1: OG meta tags share the same cover_photo_url across all sub-pages
- **Severity:** Low
- **Steps to Reproduce:**
  1. Share the Galerie page via WhatsApp
  2. Share the Karte page via WhatsApp
  3. Expected: Each page could have a more contextual preview image (e.g., first gallery photo for galerie, map screenshot for karte)
  4. Actual: All three sub-pages (tagebuch, galerie, karte) use the same `cover_photo_url` from the tour record
- **Note:** This is not a bug per se -- using the tour cover photo is reasonable. However, for a richer WhatsApp preview, page-specific images would be better.
- **Priority:** Nice to have (cosmetic improvement)

#### BUG-2: Share URL does not include specific entry/photo context
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open diary entry #5 and click Share
  2. Expected: Shared URL links to the specific entry (e.g., via anchor or query param)
  3. Actual: Shared URL is the page URL (`/touren/{id}/tagebuch`) -- user lands on the page but must scroll to find the specific entry
- **Note:** This is a known limitation of the MVP. Deep-linking to specific entries would require individual entry pages or URL fragments.
- **Priority:** Fix in next sprint

#### BUG-3: Share photo from lightbox shares page URL, not specific photo
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open photo #7 in lightbox and click Share
  2. Expected: Shared URL opens the specific photo (e.g., via query param `?photo=7`)
  3. Actual: URL is the gallery page URL -- user must find the photo manually
- **Note:** Same limitation as BUG-2. Implementing photo deep-links would improve UX.
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria (MVP Scope):** 9/9 passed
- **Bugs Found:** 3 total (0 critical, 0 high, 0 medium, 3 low)
- **Security:** Pass (no issues found)
- **Production Ready:** YES
- **Recommendation:** Deploy. The 3 low-severity bugs are UX improvements for the next sprint (deeper link context in shared URLs).

## Deployment
_To be added by /deploy_
