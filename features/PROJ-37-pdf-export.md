# PROJ-37: PDF-Export (Fotobuch-Druck)

## Status: Planned
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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
