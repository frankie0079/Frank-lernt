# PROJ-44: Tagebuch- und Archivdarstellung verbessern

## Status: Deployed
**Created:** 2026-05-31
**Last Updated:** 2026-06-01

## Ziel

Die bestehende Tagebuch- und Archivfunktion soll kurzfristig deutlich
brauchbarer werden, ohne die grosse externe Originalmedien-Archivierung jetzt
anzufassen.

Das Archiv soll sich mehr wie ein echtes Reise-Tagebuch anfuehlen und weniger
wie eine reine Fotosammlung. Es soll auf iPhone, iPad und Desktop lesbar sein,
Foto-Kommentare, Notizen, Tour-Tracker-Inhalte und Tagesinformationen sichtbar
einbinden und die bereits gebaute Tagebuchauswahl weiterverwenden.

## Bewusste Produktentscheidung

PROJ-44 ist ein pragmatischer Verbesserungs-Pass fuer die aktuelle Loesung:

- Supabase bleibt vorerst Speicherort fuer Arbeitsmedien und Archivansicht.
- Keine externe Originalmedien-Migration in diesem Feature.
- Keine zweite redaktionelle Auswahl am Eventende.
- Die Tagebuchauswahl bleibt die Quelle der Wahrheit.
- Speicheroptimierung beschraenkt sich vorerst auf bessere Transparenz und
  vorhandene Bereinigungsmoeglichkeiten.

## Geklaerte Layout-Entscheidungen

- Foto-Kommentare und Captions sind im Archiv immer sichtbar, nicht nur in
  einer Lightbox.
- Textnotizen werden wie Medien behandelt: Sie erscheinen als eigene Textkarten
  zwischen Fotos und koennen einen Foto-Slot im Layout belegen.
- Tour-Tracker-Beitraege werden in diesem Feature wie Fotos behandelt und mit
  einem erkennbaren Etappen-/Tour-Label dargestellt.
- Die Desktop-Archivansicht soll breiter und magazinartiger wirken; iPhone und
  iPad bleiben aber erste Qualitaetsbarrieren.

## Dependencies

- Requires: PROJ-36 Post-Event Tagebuch
- Requires: PROJ-42 Storage-Analyse und Bereinigung
- Requires: PROJ-43 Archivansicht und Archivlinks

## User Stories

- Als Organisator moechte ich, dass der Archivlink auf iPhone, iPad und Desktop
  gut lesbar ist, damit ich ihn ohne Erklaerung verschicken kann.
- Als Organisator moechte ich Foto-Kommentare im Tagebuch sehen, damit Bilder
  nicht ohne Kontext im Raster stehen.
- Als Organisator moechte ich Notizen ins Tagebuch aufnehmen koennen, damit der
  Reiseverlauf als Geschichte lesbar wird.
- Als Organisator moechte ich Tour-Tracker-Inhalte im Tagebuch platzieren
  koennen, damit Etappen und Strecken Teil der Erinnerung sind.
- Als Leser moechte ich pro Tag einen Kapitelkopf mit Datum, Titel,
  Beschreibung und Ort sehen, damit ich den Tag einordnen kann.
- Als Organisator moechte ich in der Tagebuch-Erstellung besser verstehen, wie
  die Seite spaeter im Archiv aussieht.
- Als Betreiber moechte ich die aktuelle Speicherlage nach Eventabschluss
  verstaendlich sehen, damit ich entscheiden kann, ob ich Slideshows oder
  verwaiste Dateien bereinige.
- Als Organisator moechte ich nach Eventabschluss einzelne Speicherbereiche
  gezielt loeschen koennen, damit ich Supabase fuer das naechste Event
  freihalte, ohne das Tagebuch zu beschaedigen.

## Acceptance Criteria

- [ ] Archivseiten passen sich sichtbar an iPhone, iPad und Desktop an.
- [ ] Layouts mit vielen Fotos bleiben auf iPhone lesbar; ein 9er-Raster darf
      mobil nicht als zu kleine dreispaltige Kachelwand erscheinen.
- [ ] Auf iPad und Desktop duerfen Tagebuchseiten breiter dargestellt werden
      als aktuell.
- [ ] Foto-Captions oder Kommentare werden im Tagebuch und Archiv sichtbar
      dargestellt, wenn sie vorhanden sind.
- [ ] Fotos lassen sich per Tippen/Klicken gross anzeigen.
- [ ] Textnotizen koennen im Tagebuch verwendet und im Archiv als eigene
      Tagebuchbausteine gelesen werden.
- [ ] Tour-Tracker-Beitraege koennen im Tagebuch verwendet und im Archiv
      sinnvoll dargestellt werden.
- [ ] Agenda-Tagesinformationen erscheinen als Kapitelkopf:
      Datum, Tagesname, Beschreibung und, falls vorhanden, Ort.
- [ ] Die interne Tagebuch-Leseansicht und die Archivansicht bleiben inhaltlich
      konsistent.
- [ ] Der Editor bietet eine klare Moeglichkeit, die spaetere Archivansicht zu
      pruefen.
- [ ] Die Speicherkarte erklaert nach Eventabschluss verstaendlich, welche
      Daten sicher noetig sind und welche Kandidaten fuer Bereinigung sind.
- [ ] Die Speicherkarte bietet getrennte Aktionen fuer verwaiste Dateien,
      Slideshows und loeschbare Videos.
- [ ] Videos, die im Tagebuch verwendet werden, werden von der Video-Loeschung
      ausgenommen.
- [ ] Die Dry-Run-Schaltflaeche ist nicht mehr Teil der UI.
- [ ] Keine Medien werden automatisch geloescht.
- [ ] Build, TypeScript, Lint und Production-Smoke laufen ohne Fehler.

## Edge Cases

- Ein Foto hat keine Caption und keinen Kommentar.
- Ein Foto hat eine lange Caption, die auf Mobile nicht ueberlaufen darf.
- Eine Seite enthaelt viele Fotos und mehrere Textbeitraege.
- Ein Tour-Tracker-Beitrag liegt technisch als Bild im Content-Pool, soll aber
  als Etappeninhalt erkennbar sein.
- Ein Agenda-Tag hat keine Beschreibung oder keinen Ort.
- Ein privater Archivlink wird auf iPhone Safari geoeffnet.
- Ein Desktop-Browser ist sehr breit; die Seite darf nicht verloren wirken.
- Ein bestehendes Hong-Kong-Tagebuch muss nach dem Update weiterhin dieselben
  Tage und Seiten anzeigen.
- Video-Uploads koennen in alten Tagesfilmen kuratiert sein; die
  Speicheroptimierung darf deshalb die Tagebuchauswahl nicht implizit
  veraendern.

## Non-Goals

- Keine externe Originalmedien-Archivierung.
- Keine Umstellung auf `diewandervoegel.eu` in diesem Feature.
- Keine neue redaktionelle Endauswahl.
- Keine automatische Supabase-Bereinigung.
- Kein vollstaendiges Canvas/Layout-Studio.
- Kein Poster- oder Fotobuch-Produktionslayout mit Originalqualitaet.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

Archivseite
+-- Event-Hero
+-- Tages-Kapitel
    +-- Kapitelkopf
    |   +-- Datum
    |   +-- Tagesname
    |   +-- Beschreibung
    |   +-- Ort, falls vorhanden
    +-- Tagebuchseiten
        +-- Responsive Page Frame
        +-- Responsive Book Layout
            +-- Foto-Karte mit sichtbarer Caption
            +-- Textnotiz-Karte
            +-- Tour-Tracker-Karte

Interne Tagebuchansicht
+-- App-Navigation
+-- gleicher Kapitel-/Layout-Kern wie Archivseite
+-- PDF-Export
+-- Bearbeiten-Link fuer Organisator

Tagebuch-Editor
+-- Bestehender Seiteneditor
+-- Archiv-Vorschau-Link
+-- Hinweis, dass Textnotizen und Tour-Beitraege als eigene Kacheln im Archiv
    erscheinen

Event-Einstellungen
+-- Bestehende Speicherkarte
+-- Klarere Nach-Event-Erklaerung:
    +-- benoetigt fuer Tagebuch
    +-- optional bereinigbar
    +-- nie automatisch loeschen

### Data Model

Es wird kein neues redaktionelles Auswahlmodell eingefuehrt. Die bestehenden
Tagebuchseiten und ihre `book_section_items` bleiben die Quelle der Wahrheit.

Ein Tagebuch-Item kann sein:

- Foto oder Video: wird als Medienkarte angezeigt.
- Textnotiz: wird als Textkarte angezeigt.
- Tour-Tracker-Bild: wird wie eine Medienkarte angezeigt, aber visuell als
  Tour/Etappe markiert, wenn es anhand vorhandener Metadaten erkennbar ist.

Agenda-Daten werden nicht dupliziert. Kapitelkoepfe lesen weiter aus den
vorhandenen Agenda-/Eventdaten.

### UX Decisions

- Mobile Lesbarkeit hat Vorrang vor starrer Fotobuch-Seitenlogik.
- Layouts duerfen je nach Viewport anders umbrechen, solange die Reihenfolge
  der Tagebuch-Items erhalten bleibt.
- Ein 9er-Raster wird auf iPhone nicht als drei winzige Spalten gerendert.
- Desktop bekommt breitere Seiten, damit das Archiv nicht wie eine kleine
  Mobile-Karte in der Mitte wirkt.
- Captions bleiben sichtbar und duerfen nicht die Fotos unlesbar ueberdecken.
- Textnotizen sollen zwischen Fotos gleichwertig wirken, nicht wie technische
  Platzhalter.

### Backend Need

Voraussichtlich kein neues Kern-Datenmodell. Backend-Arbeit ist nur noetig,
wenn die bestehenden API-Antworten nicht genug Agenda-Ortsdaten, Item-Typen,
Captions oder Tour-Erkennung liefern.

### Dependencies

Keine neuen NPM-Pakete geplant.

## QA Test Results

### Local QA Round 1 — 2026-05-31

Checks:

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS mit bestehenden Warnungen.
- `npm run build`: PASS.
- Lokaler Browser-Smoke auf
  `/archiv/privat/a21e6d9e87b00f6685531b104ce9dae0`: PASS.

Acceptance Criteria:

- Archivseiten passen sich an iPhone, iPad und Desktop an: PASS.
  - 390px: Seitenkarte ca. 343px, Fotokacheln ca. 302px breit.
  - 768px: Seitenkarte ca. 705px, zweispaltige Fotokacheln ca. 322px breit.
  - 1440px: Seitenkarte ca. 920px, magazinartig breiter als vorher.
- 9er-Raster auf iPhone nicht mehr als winzige dreispaltige Kachelwand: PASS.
- Desktop-Seiten breiter als vorher: PASS.
- Captions/Kommentare sichtbar: PASS fuer vorhandene Captions.
- Foto-Lightbox per Tippen/Klicken: PASS lokal. Klick auf die erste
  Hong-Kong-Fotokarte oeffnet einen Dialog mit grossem Bild. Doppeltipp ist
  nicht als einzige Geste noetig.
- Textnotizen als Tagebuchbausteine: IMPLEMENTIERT, Testdaten im HK-Archiv
  dafuer noch nicht vorhanden.
- Tour-Tracker als Foto mit Tour-Label: IMPLEMENTIERT, Testdaten im HK-Archiv
  dafuer noch nicht vorhanden.
- Agenda-Tagesinformationen als Kapitelkopf: PASS fuer Beschreibung und
  Koordinaten.
- Interne Tagebuch-Leseansicht und Archivansicht konsistent: PARTIAL.
  Gemeinsamer Layout-Kern ist implementiert; lokaler Browser-Smoke der
  internen Ansicht war ohne localhost-Cookie nicht aussagekraeftig.
- Editor bietet Archiv-Vorschau: PASS, Button ist als "Archiv-Vorschau"
  beschriftet.
- Speicherkarte erklaert Nach-Event-Speicher besser: PASS.
- Keine Medien automatisch geloescht: PASS.

Security / Data:

- Keine neuen Tabellen, Buckets oder Policies.
- Keine Loeschoperationen wurden ausgefuehrt.
- Archivansicht liest weiterhin nur veroeffentlichte/private Archivdaten.

### Local QA Round 2 — 2026-06-01

Scope: Speicherkarte unter Event-Einstellungen.

Checks:

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS mit bestehenden Warnungen.
- `npm run build`: PASS.

Acceptance Criteria:

- Getrennte Aktionen fuer verwaiste Dateien, Slideshows und Videos:
  IMPLEMENTIERT.
- Dry-Run-Schaltflaeche entfernt: IMPLEMENTIERT.
- Slideshow-Loeschung entfernt Storage-Dateien und setzt `slideshow_url`,
  `slideshow_published_at` und `slideshow_duration_sec` zurueck, ohne
  Tagebuchseiten, Fotos oder Notizen zu loeschen: IMPLEMENTIERT.
- Video-Loeschung entfernt nur Video-Content, der nicht in `book_page_items`
  oder `book_section_items` verwendet wird: IMPLEMENTIERT.
- Keine Medien werden automatisch geloescht; jede Aktion hat eine
  Bestaetigung: PASS.

### Local QA Round 3 — 2026-06-01

Scope: Lightbox-Rotation und Slideshow-Storyboard-Intro.

Checks:

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS mit bestehenden Warnungen.
- `npm run build`: PASS.
- Lokaler Browser-Smoke auf
  `/archiv/privat/a21e6d9e87b00f6685531b104ce9dae0`: PASS.

Acceptance Criteria:

- Lightbox oeffnet als echter Fullscreen-Dialog statt als zentriertes
  Desktop-Modal: PASS.
- Foto bleibt bei Querformat-Resize voll sichtbar und nutzt `object-fit:
  contain`: PASS.
- Storyboard-Prompt fordert keine `cover`-/Intro-Szene mehr an: PASS.
- Legacy-Storyboards werden vor Render/Reconcile um `cover`-Szenen und leere
  Textkarten bereinigt: PASS.

### Production QA — 2026-06-01

- Production-Smoke Archiv-Lightbox gegen
  `https://frank-lernt.vercel.app/archiv/privat/...`: PASS.
  - Dialog-Bounding-Box beginnt bei `x=0`, `y=0`.
  - Bild liegt voll im Viewport.
  - CSS `object-fit` ist `contain`.
- Production-Smoke Hong-Kong-Speicherkarte unter `/events/.../settings`: PASS.
  - `Dry-Run` nicht mehr sichtbar.
  - Buttons `Bereinigbare loeschen`, `Slideshows loeschen`, `Videos loeschen`
    sichtbar.
  - Werte sichtbar: ca. 6,6 MB bereinigbar, 112 MB Slideshows, 29,9 MB
    loeschbare Videos.
- Production-Smoke Admin-Seite `/events/.../admin`: PASS, aktuelle Seite laedt.
- Keine produktive Loeschaktion ausgefuehrt.

## Deployment

- Deployed via GitHub/Vercel am 2026-06-01.
- Commits:
  - `82fa0f2 feat(PROJ-44): improve diary archive reading experience`
  - `84564e3 fix(PROJ-44): simplify diary photo lightbox controls`
  - `48a7cf9 feat(PROJ-44): add targeted storage cleanup actions`
  - `44fad99 fix(PROJ-44): prevent cropped lightbox and duplicate slideshow intro`
