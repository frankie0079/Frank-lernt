# PROJ-37: PDF-Export (Fotobuch-Druck)

## Status: In Progress
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
- [ ] Format-Auswahl: A4 (Standard) oder A5 (wählbar per RadioGroup vor dem Export)
- [ ] Deckblatt: Event-Name (groß, Schriftart Helvetica Bold), Cover-Foto (ganzseitig mit Overlay), Startdatum bis Enddatum
- [ ] Titelseite Rückseite (Seite 2): Teilnehmerliste (Avatar-Platzhalter + Name), Event-Beschreibung
- [ ] Pro Agenda-Tag eine Seite (oder mehrere bei vielen Fotos): Datum + Tages-Titel als Seitenheader, Fotos im gewählten Layout (wie im Tagebuch-Editor), Tageskommentar des Organisators darunter
- [ ] Fotos werden aus Supabase Storage geladen (öffentliche URLs, keine lokale Verarbeitung nötig)
- [ ] Fusszeile auf jeder Seite: Event-Name + Seitenzahl (X / Y)
- [ ] Download-Button: "PDF herunterladen" → Browser-initiierter Download
- [ ] Dateiname: `[EventName]-Tagebuch.pdf` (Sonderzeichen ersetzt durch Bindestrich)
- [ ] Generierungsdauer bei 20 Fotos: max. 60 Sekunden (Fortschrittsbalken mit Prozentangabe)
- [ ] Vorschau vor Export: `@react-pdf/renderer` `PDFViewer` Komponente (embedded in Modal)
- [ ] Export-Button: Deaktiviert wenn kein veröffentlichter Tagebuch-Inhalt vorhanden

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
_To be added by /qa_

## Deployment
_To be added by /deploy_
