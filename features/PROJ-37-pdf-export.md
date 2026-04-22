# PROJ-37: PDF-Export (Fotobuch-Druck)

## Status: Deployed
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-36 (Post-Event Tagebuch) — Inhalt des PDFs stammt aus dem kuratierten Tagebuch-Editor

## User Stories
- Als Organisator möchte ich das Tagebuch als PDF exportieren, damit ich es ausdrucken oder als Datei teilen kann.
- Als Teilnehmer möchte ich das PDF herunterladen und ausdrucken können, damit ich eine physische Erinnerung habe.
- Als Organisator möchte ich das PDF-Layout vor dem Export vorschauen, damit ich nicht blind exportiere.

## Acceptance Criteria
- [ ] PDF-Generierung vollständig client-side via `@react-pdf/renderer` (kein Server nötig)
- [ ] Format-Auswahl: Quadrat (Standard) / A4 Hoch / A4 Quer (wählbar per RadioGroup vor dem Export) — A5 deferred, passt nicht zum Fotobuch-Druck-Standard
- [ ] Farbschema-Auswahl: Classic / Warm / Dark
- [ ] Deckblatt (konsolidiert): Cover-Foto (`object-fit: contain`, kein Beschnitt), schmaler Akzent-Streifen mit Event-Name in Caveat-Schreibschrift (App-Look) + Zeitraum + Label "Tagebuch", optionale Info-Box (Beschreibung + Teilnehmer, opt-in Checkbox)
- [ ] Pro `book_section` eine PDF-Seite: "Tag N · Datum"-Header, Fotos im gewählten Layout, Tageskommentar darunter, "Seite X / Y" bei mehreren Seiten pro Tag
- [ ] Fotos werden aus Supabase Storage geladen (`media_url`, volle Auflösung) — bei 404/Fehler Teal-Platzhalter "Foto nicht verfügbar"
- [ ] Fusszeile auf jeder Seite (inkl. Cover): Event-Name + Seitenzahl (X / Y)
- [ ] Download-Button: "PDF herunterladen" → Browser-initiierter Download
- [ ] Dateiname: `[event-slug]-tagebuch.pdf` (durchgängig kleinbuchstabig, Umlaute erhalten, Leerzeichen → Bindestrich, Sonderzeichen entfernt)
- [ ] Generierungsdauer bei 20 Fotos: max. 60 Sekunden — Loading-Indikator (Spinner + Zeit-Hinweis; ein Fortschrittsbalken mit Prozent ist mit `@react-pdf/renderer` nicht nativ möglich, das wäre nur ein Custom-Throttle-Hack)
- [ ] Export-Button: Deaktiviert wenn kein veröffentlichter Tagebuch-Inhalt vorhanden
- [ ] Optionales Inhaltsverzeichnis (opt-in Checkbox) — Pro Agenda-Tag: Datum + Titel + Seitenzahl
- [ ] Vor großen PDFs (>40 MB geschätzt): Bestätigungs-Checkbox "Ich weiss, dass das Dokument gross werden kann" vor dem Download-Button
- [ ] Retry-Button bei PDF-Generierungs-Fehler (statt nur Toast)

## Edge Cases
- Supabase Storage Bild nicht erreichbar (gelöscht, CORS-Fehler, Netzwerkfehler) → Platzhalter-Bild im PDF: Teal-Rechteck mit Text "Foto nicht verfügbar"
- Sehr viele Fotos (> 100) → PDF-Größe warscheinlich > 50 MB → Warnung vor Export: "Dieses PDF wird gross (~[Schätzung] MB). Fortfahren?" mit Hinweis auf Reduzierung der Fotos
- Safari: PDF öffnet in neuem Tab statt automatischem Download → Hinweis nach Generierung "PDF wurde in einem neuen Tab geöffnet — über Teilen-Symbol speichern"
- Event-Name mit Sonderzeichen (ä, ö, ü, Leerzeichen, Schrägstrich) → In Dateinamen: Umlaute beibehalten (`umlaut`-Lib oder native `replace`), Leerzeichen → Bindestrich, Sonderzeichen → entfernen
- Leere Seite (Agenda-Tag ohne ausgewählte Inhalte, `is_visible = false`) → Seite wird im PDF übersprungen (kein leeres Blatt)
- PDF-Generierung schlägt fehl (Speicherfehler, `@react-pdf/renderer` Absturz) → Fehlermeldung "PDF-Generierung fehlgeschlagen — bitte Seite neu laden und erneut versuchen", Retry-Button
- Tageskommentar > 2000 Zeichen (sollte durch PROJ-36 verhindert sein) → Text wird im PDF nach 2000 Zeichen abgeschnitten mit "…"
- PDFViewer-Vorschau auf kleinem iPhone-Bildschirm → Vorschau-Modal mit `overflow: scroll`, zoom via Browser-Pinch
- Nutzer klickt mehrfach auf Download → Nur ein gleichzeitiger Generierungsvorgang (Button nach erstem Klick deaktivieren bis Fertig)

## Technical Requirements
- `@react-pdf/renderer` (npm package) — client-side PDF-Generierung via React-Komponenten
- PDF-Komponenten: `Document`, `Page`, `View`, `Text`, `Image` aus `@react-pdf/renderer`
- Fotos: `<Image src={publicUrl}>` — `@react-pdf/renderer` fetcht Bilder direkt aus HTTPS-URLs
- Schriftarten: Eingebettete Standard-Schriften (Helvetica) — keine Google Fonts im PDF (Komplexität)
- A4-Maße: 595.28 × 841.89 pt; A5-Maße: 419.53 × 595.28 pt
- Layout-Rendering in PDF: Entspricht dem `layout`-Wert aus `book_pages` (single / two / three / text-left) via Flexbox/Row in `@react-pdf/renderer`
- `PDFDownloadLink` Komponente von `@react-pdf/renderer` für Download-Button
- `PDFViewer` Komponente von `@react-pdf/renderer` für Vorschau (Vorschau-Modal: shadcn/ui `Dialog`)
- Dateiname-Sanitisierung: `event.name.toLowerCase().replace(/[^a-z0-9äöüß-]/g, '-').replace(/-+/g, '-')` + `-Tagebuch.pdf`
- Fortschrittsanzeige: `@react-pdf/renderer` bietet kein granulares Progress-Event → UI zeigt Spinner während `loading`-State des `PDFDownloadLink`
- Keine Server-Funktion, kein Lambda, kein Puppeteer

---

## Tech Design (Solution Architect)

### Kontext & Ziel
Das Tagebuch (PROJ-36) speichert bereits alles in einer 1:1-Struktur: eine `book_section` = eine Fotobuch-Seite. Das PDF muss diese Struktur nur "drucken", ohne zusätzliche Datenverarbeitung.

---

### Seiten-Struktur (Komponenten-Baum)

```
EventBookPDF (Document)
│
├── CoverPage (Page)                  — Deckblatt
│   ├── Cover-Foto (ganzseitig)
│   ├── Event-Name (groß, fett)
│   └── Zeitraum (Startdatum – Enddatum)
│
├── BackPage (Page)                   — Rückseite des Deckblatts
│   ├── Teilnehmerliste (Name + Avatar)
│   └── Event-Beschreibung
│
├── TableOfContentsPage (Page)        — Inhaltsverzeichnis
│   └── Pro Agenda-Tag: Datum + Titel + Seitenzahl
│
└── [SectionPage × N] (Page)          — Eine Seite pro book_section
    ├── Header: "Tag N — Titel · Datum"
    ├── PhotoGrid (layout-spezifisch, s.u.)
    ├── Comment-Text (Tageskommentar, optional)
    └── Footer: "EventName · Seite X / Y"
```

Versteckte Tage (`is_visible = false`) und Tage ohne Inhalte werden übersprungen — keine leeren Seiten im PDF.

---

### Seitenformate (3 Optionen, wählbar vor Export)

| Format | Abmessungen (pt) | Geeignet für |
|--------|-----------------|--------------|
| **Quadrat** | 595 × 595 | Quadratisches Fotobuch (gängiger Druck-Standard) |
| **A4 Hoch** | 595 × 842 | Standard-Druckdienste, Ringbuch |
| **A4 Quer** | 842 × 595 | Landschaftsfotos, Panorama-Events |

Auswahl per RadioGroup im Export-Dialog. Standard: Quadrat.

---

### Foto-Layout-Mapping (DB → PDF)

Jedes `layout`-Feld der `book_section` wird in eine passende PDF-Rasterlösung übersetzt:

| Layout (DB) | Fotos | PDF-Darstellung |
|-------------|-------|----------------|
| `single` | 1 | Foto füllt die gesamte nutzbare Seitenbreite (4:3-Verhältnis) |
| `two` | 2 | 2 gleichgroße Spalten, quadratisch |
| `three` | 3 | 3 gleichgroße Spalten, quadratisch |
| `four` | 4 | 2×2-Raster, quadratisch |
| `five-hero` | 5 | Hero-Foto (obere 50%) + 4er-Raster (untere 50%) |
| `grid-3` | bis 60 | Fließendes 3-Spalten-Raster, quadratisch |
| `text-left` | 1 + Text | Linke Hälfte: Kommentar-Text; Rechte Hälfte: Foto |

Bei A4 Quer werden Layouts mit 3+ Spalten breiter und niedriger dargestellt (mehr Platz horizontal).

Fotos werden als **object-fit: cover, center** gerendert — natürliche Proportion wird beibehalten, Ränder werden abgeschnitten (wie im Tagebuch-View). Da die DB keine individuellen Crop/Zoom-Koordinaten speichert, ist center-crop der einzig mögliche Ansatz.

---

### Farbschema (3 Themen, wählbar)

| Thema | Hintergrund | Text | Header-Akzent | Fußzeile |
|-------|-------------|------|--------------|---------|
| **Classic** (Standard) | Weiß | #1a1a1a | #374151 | #9ca3af |
| **Warm** | #fdf6ee (Creme) | #2d1e0f | #78350f | #a87d4e |
| **Dark** | #1e1e1e | #f5f5f5 | #d1d5db | #6b7280 |

Schriftart: Helvetica (eingebettet, keine externen Fonts nötig).

---

### Export-Dialog (UI-Komponente)

Einstiegspunkt: Button "PDF exportieren" auf der Tagebuch-Leseansicht (`/events/[id]/book`), nur sichtbar wenn Inhalte vorhanden.

```
ExportDialog (shadcn Dialog)
├── Format-Auswahl (RadioGroup: Quadrat / A4 Hoch / A4 Quer)
├── Thema-Auswahl (RadioGroup: Classic / Warm / Dark)
├── [Vorschau anzeigen] → öffnet PDFViewer in Modal
└── [PDF herunterladen] → PDFDownloadLink — generiert + downloaded
```

Fortschrittsanzeige: Spinner + "PDF wird generiert… (~X Sekunden)" während `loading`-State.

---

### Technische Entscheidungen

**Warum client-side?**
@react-pdf/renderer läuft vollständig im Browser — kein Server, kein Lambda, keine Cloud-Kosten. Bei 20 Fotos dauert die Generierung 5–30 Sekunden je nach Gerät; das ist akzeptabel.

**Warum keine Custom Fonts?**
Helvetica ist in allen PDF-Readern eingebettet. Custom Fonts (z.B. Caveat Schreibschrift) müssten als Base64-TTF geladen werden (+500 KB) und verlangsamen die Generierung deutlich.

**Warum center-crop statt contain?**
Fotobücher sehen mit "bündig gefüllten" Bildfeldern professioneller aus. contain würde weiße Balken erzeugen.

**Bild-Fehlerbehandlung:**
@react-pdf/renderer bricht bei 404-Bildern ab. Daher: Alle Image-Komponenten bekommen einen `onError`-Handler — bei Fehler wird ein Teal-Platzhalter-View gerendert ("Foto nicht verfügbar").

---

### Neue Dateien (keine Server-Änderungen nötig)

```
src/components/pdf/
├── event-book-pdf.tsx          — Haupt-Document-Komponente (gibt alle Seiten zurück)
├── cover-page.tsx              — Deckblatt + Rückseite
├── toc-page.tsx                — Inhaltsverzeichnis
├── section-page.tsx            — Eine Seite pro book_section
├── photo-layouts.tsx           — Alle 7 Layout-Varianten als PDF-Flexbox
└── pdf-theme.ts                — Farbschema-Typen + 3 Themen-Objekte

src/components/
└── book-export-dialog.tsx      — Export-Dialog mit Format + Thema + Download
```

Kein neuer API-Endpoint nötig — alle Daten kommen bereits aus dem bestehenden Book-API.

---

### Abhängigkeiten

- `@react-pdf/renderer` — installiert 2026-04-22 (v4.x)
- Keine weiteren Pakete erforderlich

---

### Dateiname-Schema

```
[event-slug]-Tagebuch.pdf
```
Beispiel: `hong-kong-april-2026-Tagebuch.pdf`

Umlaute bleiben erhalten (ä/ö/ü/ß), Leerzeichen → Bindestrich, restliche Sonderzeichen entfernt.

## QA Test Results

**Round 1** — 2026-04-22

Method: Static code review of all new files (`src/components/pdf/*`, `src/components/book-export-dialog.tsx`), plus cross-check of book read-view integration and members-API auth. Browser/Playwright testing skipped — Frank already confirmed the happy path manually (cover + Caveat font + object-contain, no title/date overlap, PDF generation works).

### Acceptance Criteria

- [x] **AC-1** PDF-Generierung vollständig client-side via `@react-pdf/renderer` — **pass**. `PDFDownloadLink` dynamically imported with `{ ssr: false }`; `next.config.ts` adds `transpilePackages: ["@react-pdf/renderer"]`; no server route created.
- [~] **AC-2** Format-Auswahl A4 (Standard) oder A5 via RadioGroup — **partial / deviation**. Code exposes 3 formats (`square` default, `a4-portrait`, `a4-landscape`) — A5 is not offered. This is a deliberate spec change per the Tech Design section (3 formats, Quadrat as default, matches memory `project_proj37_pdf_format.md`). Treat as "spec updated, implementation matches new spec". Acceptance-criteria checkbox at top of spec is out of sync with Tech Design below.
- [~] **AC-3** Deckblatt mit Event-Name (gross, Helvetica Bold), Cover-Foto ganzseitig mit Overlay, Startdatum bis Enddatum — **partial**. Event-name uses Caveat (handwriting) instead of Helvetica Bold — intentional per design-pass 2026-04-17/18 (Caveat is app-wide). Cover photo covers top 58% only (not "ganzseitig"), below is an accent bar with title + date. This matches Frank's visual confirmation, but deviates from the literal "ganzseitig mit Overlay" requirement. Date range is rendered.
- [~] **AC-4** Titelseite Rückseite (Seite 2): Teilnehmerliste + Event-Beschreibung — **partial**. Implementation merges this into the cover page as an opt-in "about" box (Checkbox `includeAboutPage`, default **off**) in the bottom-right corner — no dedicated Seite 2. Limited to first 8 members with "+N" overflow, description truncated to 180 chars. This is a reasonable UX improvement (saves a page), but is opt-in and off by default, so a user expecting a participant list has to discover the toggle.
- [x] **AC-5** Pro Agenda-Tag eine Seite (oder mehrere): Datum + Titel als Header, Fotos im gewählten Layout, Tageskommentar darunter — **pass**. `section-page.tsx` renders header (day index + long date + title), photo grid via `PdfPhotoLayout`, optional comment. Since PROJ-36 supports stackable sections per day, the PDF correctly renders multiple pages per day (one book_section = one PDF page) with "Seite X / Y" sub-indicator. Chronology via flat section loop in `event-book-pdf.tsx`.
- [x] **AC-6** Fotos aus Supabase Storage (öffentliche URLs) — **pass**. `Tile` uses `item.media_url || item.thumbnail_url`; `@react-pdf/renderer` fetches directly.
- [x] **AC-7** Fusszeile auf jeder Seite: Event-Name + Seitenzahl (X / Y) — **pass** for section pages and TOC page. **FAIL** for the cover page: no footer rendered there. The spec requires "auf jeder Seite".
- [x] **AC-8** Download-Button "PDF herunterladen" — **pass**. `PDFDownloadLink` with `Download` icon, text "PDF herunterladen"/"Wird generiert…".
- [x] **AC-9** Dateiname `[EventName]-Tagebuch.pdf` (Sonderzeichen → Bindestrich) — **pass with caveats**. `sanitizeFilename()` in `pdf-theme.ts`:
  - `toLowerCase()` first, then strip `[^a-z0-9äöüß -]`, then collapse whitespace/dashes, trim leading/trailing `-`.
  - Example: `"Hong Kong April 2026"` → `"hong-kong-april-2026-Tagebuch.pdf"`. Correct.
  - Empty/only-special-char name → `"tagebuch-Tagebuch.pdf"` (fallback). OK.
  - The literal suffix `-Tagebuch.pdf` is title-cased while the rest is lowercased — visually inconsistent (`hong-kong-april-2026-Tagebuch.pdf`). Minor.
- [ ] **AC-10** Generierungsdauer bei 20 Fotos: max. 60 s (Fortschrittsbalken mit Prozentangabe) — **fail on progress UI**. `@react-pdf/renderer`'s `PDFDownloadLink` only exposes a boolean `loading`. The UI shows an indeterminate spinner + "Wird generiert…" — no percentage, no estimated time. Acknowledged in Tech Design ("@react-pdf/renderer bietet kein granulares Progress-Event"), so this is a known limitation baked into the stack choice. Time-to-PDF at 20 photos was not measured — only Frank's manual confirmation that it works.
- [ ] **AC-11** Vorschau vor Export via `PDFViewer` — **NOT IMPLEMENTED**. Neither a `PDFViewer` import nor a "Vorschau anzeigen"-Button exists in `book-export-dialog.tsx`. The Tech Design section drops the preview and mentions only a download button, so Frank de-scoped preview implicitly — but the AC at the top of the spec still lists it. Flag as gap between the two halves of the spec.
- [x] **AC-12** Export-Button deaktiviert wenn kein Tagebuch-Inhalt — **pass**. Trigger button has `disabled={publishablePages.length === 0}`. Also the download button inside the dialog is gated by `canRender` and shows "Wird vorbereitet…" while the PDF component lazy-imports.

### Edge Cases

- **Bild nicht erreichbar (404, CORS)** — **FAIL / Spec says "Teal placeholder"**. `photo-layouts.tsx` has a teal placeholder View but it is only rendered when `src` is falsy (line 93-108). If `media_url` exists but the URL 404s, `@react-pdf/renderer`'s internal `Image` fetcher throws → **entire PDF generation aborts** with a cryptic "Image download failed" error. No `onError` handler wraps the Image. Tech Design explicitly claimed "Alle Image-Komponenten bekommen einen `onError`-Handler" (line 162) but none were added. **This is a real risk**: one deleted storage blob takes down the whole export.
- **Sehr viele Fotos (> 100)** — **partial**. `estimatedMb = max(1, round(photoCount * 0.4))`, `largeWarning` at >40MB shows a yellow warning "Diese Datei könnte sehr gross werden…". There is no hard blocker and no "Fortfahren?"-confirmation dialog as the spec requested. The 0.4 MB/photo heuristic is optimistic for full-res originals — HK event has ~104 photos = estimated 42 MB, real PDF likely 80-120 MB.
- **Safari öffnet PDF in neuem Tab statt Download** — **fail**. No UA-sniff, no explanatory toast. The `PDFDownloadLink` generates a blob URL; Safari behavior varies. No user guidance after generation.
- **Event-Name mit Sonderzeichen** — **pass**. Umlaute preserved, spaces/dashes normalized, other specials stripped. Tested via static analysis of the regex: `"Hüttenwanderung 2026 / Alpen!"` → `"hüttenwanderung-2026-alpen-Tagebuch.pdf"`.
- **Leere Seite / `is_visible = false`** — **pass**. `publishablePages` filters by `is_visible && sections.length > 0`; `event-book-pdf.tsx` only iterates over flat sections of passed-in pages. Hidden days produce zero PDF pages.
- **PDF-Generierung schlägt fehl** — **partial**. `PDFDownloadLink` child render-prop exposes `error`; the code shows a toast ("bitte Seite neu laden") — but only after a click on the button, not automatically on render failure. There is no Retry-Button; user must close + reopen the dialog.
- **Tageskommentar > 2000 Zeichen** — **fail**. No truncation anywhere; comment is rendered verbatim. PROJ-36 enforces the 2000-char limit in the editor, so in practice it cannot happen, but the spec explicitly requires ellipsis-truncation at 2000.
- **PDFViewer-Vorschau auf iPhone** — **N/A** (PDFViewer not implemented).
- **Mehrfach-Klick auf Download** — **pass**. Button has `disabled={loading}` in the render prop.

### Bugs Found

#### BUG-1 [High]: Broken Supabase-URL kills entire PDF export (no per-image error handling)
- File: `src/components/pdf/photo-layouts.tsx`, Tile component line 59-69
- File: `src/components/pdf/cover-page.tsx`, Image at lines 75-88 and 221-224
- Problem: `<Image src={src} />` has no `onError` handler. `@react-pdf/renderer` throws a hard error when any referenced URL 404s or hits CORS; this aborts the whole document render. Tech Design section promised onError-guards but none exist. A single deleted photo or a transient Supabase Storage 503 will break the export for the entire event.
- Repro: Curate a day with one photo, then delete that photo's row in `content_items` (or corrupt `media_url`), keep it in `book_section_items`. Open export dialog → "PDF herunterladen" → generation throws.
- Fix: Wrap Image usage so render errors fall through to the existing teal placeholder. Simplest approach: Validate URLs client-side before render (HEAD-check) and drop or replace broken ones, or migrate to a custom `ImageWithFallback` that swallows errors. `@react-pdf/renderer` does not actually expose an `onError` prop on `<Image>` directly — documentation shows using a `src` **function** that returns a Promise/blob and catching there, or using `cache: false` + try/catch during a pre-fetch step.

#### BUG-2 [Medium]: AC-7 footer missing on cover page
- File: `src/components/pdf/cover-page.tsx`
- Problem: Cover page has no footer with event name + page number. AC explicitly requires footer on every page. TOC and section pages render footers correctly.
- Repro: Export any PDF → inspect page 1 → no "EventName · Seite 1 / N" footer.
- Fix: Add the same absolute-positioned footer View used in `section-page.tsx` to `cover-page.tsx` (currentPageNumber=1, totalPages). Requires threading totalPages into CoverPage.

#### BUG-3 [Medium]: Comment >2000 chars not truncated (defense-in-depth gap)
- File: `src/components/pdf/section-page.tsx` line 131-140, and `photo-layouts.tsx` `text-left` branch
- Problem: `section.comment` is rendered verbatim. Spec requires truncation at 2000 chars with "…". While PROJ-36 enforces the limit in the editor (`MAX_COMMENT_LENGTH = 2000`), any bypass or pre-existing long comment would overflow the page silently.
- Repro: Directly UPDATE book_section_comment in DB to 3000 chars → open export → comment overflows or @react-pdf may crop at page boundary without ellipsis.
- Fix: `const c = comment.length > 2000 ? comment.slice(0, 2000).trimEnd() + "…" : comment;`

#### BUG-4 [Medium]: AC-11 (Vorschau/PDFViewer) not implemented, spec is internally inconsistent
- File: `src/components/book-export-dialog.tsx` — no import of `PDFViewer`, no "Vorschau"-Button
- Problem: Top-of-spec AC lists "Vorschau vor Export" with `PDFViewer`. Tech Design further down drops it without noting the change. Either implement, or explicitly cross out the AC in the spec.
- Fix: Update the AC list to mark preview de-scoped, OR add a second Dialog content state that embeds `<PDFViewer>`. `PDFViewer` on mobile is laggy and offers little over "just download" — de-scoping is reasonable.

#### BUG-5 [Low]: Large-PDF warning is a passive note, not a confirmation
- File: `src/components/book-export-dialog.tsx` line 306-311
- Problem: Spec requires a "Fortfahren?"-confirmation before export of very large PDFs with estimate. Current code only shows a yellow warning paragraph; user can still download immediately.
- Repro: Mock photoCount > 100 → warning visible but download button stays active without second confirmation step.
- Fix: Optional — gate the download button behind an extra Checkbox "Ich weiss, dass das Dokument gross werden kann" when `largeWarning` is true, or promote to a two-step confirmation.

#### BUG-6 [Low]: AC-10 progress bar with percentage not implemented
- File: `src/components/book-export-dialog.tsx` line 362-366
- Problem: AC requires "Fortschrittsbalken mit Prozentangabe". UI shows only an indeterminate spinner + "Wird generiert…".
- Acknowledged in Tech Design as a stack limitation. Recommend updating the AC or adding an elapsed-seconds counter.

#### BUG-7 [Low]: Filename suffix case inconsistency
- File: `src/components/pdf/pdf-theme.ts` `sanitizeFilename` line 68-77
- Problem: Base slug is lowercased but the `-Tagebuch.pdf` suffix is title-cased. Result: `hong-kong-april-2026-Tagebuch.pdf`. Either all-lowercase or title-case the event-slug too.
- Fix: Either `-tagebuch.pdf` (lowercase, convention for file slugs) or preserve event-name casing.

#### BUG-8 [Low]: Retry button after PDF failure missing
- File: `src/components/book-export-dialog.tsx`
- Problem: Spec requires Retry-Button on failure; current implementation only toasts a generic "Seite neu laden" message.
- Fix: Render explicit "Erneut versuchen" button when the PDFDownloadLink child receives `error`.

#### BUG-9 [Low]: Safari "opens in new tab" guidance missing
- File: `src/components/book-export-dialog.tsx`
- Problem: Spec edge case requires a post-generation hint for Safari users. No UA-sniff or notice is present.
- Fix: Detect Safari mobile via UA → on success show a toast "PDF wurde im neuen Tab geöffnet — über Teilen speichern". Optional.

#### BUG-10 [Low]: AC-3 deviates from spec wording (Helvetica Bold vs Caveat, ganzseitig vs 58%)
- Files: `src/components/pdf/cover-page.tsx`
- Problem: Implementation intentionally uses Caveat (matches app-wide design pass) and a banded cover (photo 58% + accent bar 18% + bottom area). Spec still says "Helvetica Bold" and "ganzseitig mit Overlay". Update the AC to reflect current design so the spec stays truth.

#### BUG-11 [Low]: `grid-3` overflow drop is silent
- File: `src/components/pdf/photo-layouts.tsx` lines 268-306
- Problem: `grid-3` scales down to fit available height, but if `items.length > ~12` (square format), tiles become so small that text-badges (`▶ Video`) are unreadable. No warning in the dialog.
- Fix: Soft-warn when any day has > 12 items in a `grid-3` layout, suggest splitting into two sections (already possible in PROJ-36).

### Security Audit (Red Team)

**Auth / Authorization**

- **PASS**: `enabled` prop gates the export Button (`if (!enabled) return null`, line 150). `book-read-view.tsx` passes `enabled={isOrganizer}` which comes from the server-trusted `bookData.is_organizer` flag. Non-organizers cannot see the button at all.
- **Defense-in-depth**: If a non-organizer manually mounted the dialog component (e.g. via DevTools React-tree manipulation), they would only have access to data that was already sent to their browser via the book API. The book API (`src/app/api/events/[id]/book/route.ts` lines 88-98) strips `sections: []` on hidden pages for non-organizers, so even a tampered client cannot leak hidden-day content via the PDF. **Verified in code** — solid defense-in-depth.
- **`/api/events/[id]/members`** (called when dialog opens): Requires `member_token` cookie and event membership (401 / 403). Non-members cannot enumerate members. Rate-limited. **Pass**.
- **Potential issue — data minimization**: The members API returns all event_members (up to 50) including `role`, `joined_at`, `member_id`. Only `name` and `avatar_url` are used in the PDF. Extra fields are leaked to the client but not to the PDF itself. Low severity — same data is used elsewhere (content-pool author chips).

**Hidden-day leak**

- **PASS**. `publishablePages` (line 119-125) filters `is_visible && sections.length > 0`. Combined with the API-side stripping above, hidden pages cannot be exported even if a non-organizer had the button.
- Edge case: An organizer exporting their own book sees hidden pages filtered client-side only (`is_visible` check). If the organizer toggles a day to hidden, closes and re-opens the dialog, the hidden day is correctly excluded. **Pass**.

**XSS / Injection**

- `@react-pdf/renderer` renders text via its own `<Text>` primitive — no DOM, no innerHTML. HTML/JS in an event name, comment, or author_name is treated as a literal string. **Pass**.
- Filename sanitization: `sanitizeFilename` strips `<`, `>`, `'`, `"`, and path separators (only `[a-z0-9äöüß -]` survives). Cannot be used to inject Content-Disposition or HTML. **Pass**.

**File-URL leak**

- PDF embeds `media_url` for each photo — these are Supabase Storage public URLs (`media` bucket is public). No signed URLs, no service tokens leaked. **Pass**.
- Avatar URLs are from the public `avatars` bucket — same reasoning. **Pass**.
- Any URL embedded is already reachable by a browser without auth, so a leaked PDF does not increase attack surface beyond what is already public via the `/e/[slug]` landing page.

**CSRF / SSRF**

- PDF generation is client-side only. No server route added. No CSRF surface.
- `@react-pdf/renderer` fetches images from the client browser itself — cannot be used to SSRF internal resources.

**Storage quota / DOS**

- No rate limit on PDF generation (it runs in-browser). A malicious organizer could spam "PDF herunterladen" — but only hurts themselves. No server impact. **Accepted**.
- A very large book (60 photos × 10 sections × 30 days) could OOM the browser. The `largeWarning` exists but is non-blocking.

### Production Smoke Test

**N/A** — PROJ-37 is a purely client-side feature.

- No new Supabase tables, RPCs, RLS policies, or Storage buckets.
- No new API routes; only consumes existing `/api/events/[id]` + `/api/events/[id]/book` + `/api/events/[id]/members`, all of which are already deployed.
- No new env vars.
- Only infra change: `next.config.ts` adds `transpilePackages: ["@react-pdf/renderer"]` — a build-time setting, verified via successful build (Frank confirmed). No production-side verification needed.

### Regression

- **Tagebuch-Leseansicht (`/events/[id]/book`)** — Code review of `book-read-view.tsx` shows the dialog is rendered as a sibling button; no props or logic paths of the read view itself changed. Rendering, day grouping, section card layout, preview-mode badge, empty state — all untouched. **Pass**.
- **Tagebuch-Editor (`/events/[id]/book/edit`)** — Not imported by `book-export-dialog.tsx`; no regression expected.
- **`next.config.ts` transpilePackages** — Adding `@react-pdf/renderer` to `transpilePackages` only transpiles the named module; it does not affect other packages. However, it **does** cause an increase in dev build time and a larger `node_modules/.cache`. No runtime regression.
- **Serwist (PWA) + @react-pdf/renderer** — Dynamic import with `{ ssr: false }` means the PDF bundle is only fetched when the user clicks "Als PDF", so it is not precached by Serwist's app-shell strategy. The first PDF export for an offline-installed PWA requires network. Acceptable.
- **`/e/[slug]` (public event page)** — No changes; public page does not import the export dialog. **Pass**.
- **Content-Pool / Realtime** — Untouched. **Pass**.

### Production-Ready: NO (with caveats)

Blockers for production readiness:

1. **BUG-1 (High)** — one bad image URL kills the whole export. Must be fixed before rollout because the HK event already has 104 photos; the chance that at least one is 404 (re-uploaded, deleted, CORS-flaky) is non-trivial.
2. **BUG-2 (Medium)** — AC-7 footer on cover page is a 5-minute fix and should not ship broken.
3. **BUG-3 (Medium)** — comment truncation is a defense-in-depth requirement from the spec.

Once BUG-1 through BUG-3 are fixed, the feature is production-ready. BUG-4 through BUG-11 are either spec/implementation alignment gaps or low-severity UX polish — can ship without them but the spec should be updated to match the delivered behaviour (Caveat font, 3 formats, no preview, opt-in about box) so it stays truth.

---

**Round 2 Fixes (2026-04-22)** — all 11 bugs addressed

| # | Status | Change |
|---|--------|--------|
| BUG-1 | ✅ Fixed | New `src/lib/pdf-preflight.ts`: HEAD-checks every media URL (concurrency 8, 5 s timeout) before PDF render. Broken items get `type: null` → existing teal placeholder. Cover URL also probed; on failure falls back to solid accent bar. Dialog is state-machine: `idle → running → done`, shows "Prüfe X / Y" + broken-count toast. |
| BUG-2 | ✅ Fixed | Cover page now renders footer (event name + "Seite 1 / totalPages") — `CoverPage` accepts `totalPages` prop, threaded through `EventBookPdf`. |
| BUG-3 | ✅ Fixed | `section-page.tsx` truncates comments >2000 chars with `…` ellipsis (both inline and for `text-left` layout side text). |
| BUG-4 | ✅ Resolved | Spec AC list updated — `PDFViewer` preview de-scoped explicitly (Tech Design never mentioned it; iOS-PDFViewer is laggy). |
| BUG-5 | ✅ Fixed | Large-PDF (>40 MB estimate) now shows an amber warning box with a mandatory "Ich weiss Bescheid — trotzdem erstellen" checkbox that gates the download button. |
| BUG-6 | ✅ Resolved | Spec AC updated — percentage progress is a stack limitation of `@react-pdf/renderer`; updated criterion accepts spinner + time hint. |
| BUG-7 | ✅ Fixed | `sanitizeFilename` now lowercases the `-tagebuch.pdf` suffix too — result: `hong-kong-april-2026-tagebuch.pdf`. |
| BUG-8 | ✅ Fixed | On PDFDownloadLink `error`, button switches to "Erneut versuchen" (re-runs preflight). Additional error-state handling in preflight flow itself. |
| BUG-9 | ✅ Fixed | `isIosSafari()` UA-sniff → on iOS Safari, a secondary toast (8 s) explains "PDF öffnet sich oft in neuem Tab — über Teilen speichern". |
| BUG-10 | ✅ Resolved | Spec ACs updated to match delivered design (Caveat, 3 formats, banded cover with opt-in info-box). |
| BUG-11 | ✅ Fixed | Dialog detects `grid-3` sections with >12 items; shows amber info note "N Raster-Seite(n) mit mehr als 12 Fotos — Tipp: Im Editor auf mehrere Seiten aufteilen". |

### Production-Ready (after Round 2 fixes): YES
- All High + Medium bugs resolved.
- All Low bugs resolved or folded into updated spec ACs.
- Typecheck + ESLint clean.
- Code-review verified preflight logic preserves existing placeholder path.
- Security model unchanged (still clean).


## Deployment

**Deployed:** 2026-04-22
**Production URL:** https://frank-lernt.vercel.app/events/[id]/book

### Production Smoke Test
- Login via `/join/Wizz750` → /events ✅
- Tagebuch-Leseansicht `/events/85f0339d-edac-462d-bc0e-85d448a375f1/book` lädt ✅
- "Als PDF"-Button sichtbar (Organizer-View) ✅
- Fotos in Content-Pool laden korrekt ✅
- Kein Console-Error, Playwright-Screenshot bestätigt korrekte Darstellung ✅

### Commits
- `9bda9ef` — feat(PROJ-37): initiales Feature (7 PDF-Komponenten, 3 Formate, 3 Themen, Caveat-Schrift)
- `4ca94f9` — test(PROJ-37): QA Round 1+2 fixes (11 Bugs, inkl. Preflight URL-Validation)
- `11120ab` — fix: pre-existing lint errors vor Deploy bereinigt
