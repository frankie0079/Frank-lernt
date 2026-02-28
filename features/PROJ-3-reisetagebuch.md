# PROJ-3: Reisetagebuch — Digitales Buch zum Durchblättern

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
