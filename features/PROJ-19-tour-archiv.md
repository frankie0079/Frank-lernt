# PROJ-19: Tour-Archiv

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Archiv-Sektion auf der Landing Page
- Related: PROJ-3 (Reisetagebuch) — Archivierte Touren haben ein Tagebuch
- Related: PROJ-4 (Fotogalerie) — Archivierte Touren haben eine Galerie

## Konzept

Vergangene Touren werden im Archiv auf der Landing Page angezeigt. **Auch Touren, die vor der App stattfanden**, können nachträglich erfasst werden — mit Fotos (Upload via PWA) und manuell ergänztem Content (Texte, Statistiken).

## User Stories
- Als Besucher möchte ich vergangene Touren der Wandervögel im Archiv durchstöbern.
- Als Wanderer möchte ich abgeschlossene Touren ins Archiv verschieben.
- Als Wanderer möchte ich nachträglich Touren (vor der App) anlegen mit Fotos und manuellem Content, damit unser gesamtes Tour-Archiv an einem Ort ist.

## Acceptance Criteria
- [ ] Archiv-Sektion auf der Landing Page zeigt alle vergangenen Touren
- [ ] Jede archivierte Tour zeigt: Name, Datum, Strecke (km), Teilnehmer, Cover-Foto
- [ ] Klick auf Tour öffnet das Tagebuch und die Galerie der Tour
- [ ] Aktive Tour erscheint nicht im Archiv
- [ ] Touren sind nach Datum sortiert (neueste zuerst)
- [ ] Retroaktive Touren anlegbar: Name, Datum, Beschreibung, Cover-Foto, Fotos (Upload via PWA)
- [ ] Retroaktive Touren können nachträglich mit Text, Statistiken und Fotos ergänzt werden
- [ ] Fluid Responsive Design

## Edge Cases
- Was wenn keine vergangenen Touren vorhanden sind? → Platzhalter-Text
- Was wenn eine Tour kein Cover-Foto hat? → Standard-Platzhalter-Bild
- Was wenn eine retroaktive Tour keine Fotos hat? → Nur Textinhalt anzeigen

## Technical Requirements
- Touren als Datenbank-Entität mit Status (geplant/aktiv/archiviert)
- Foto-Upload für retroaktive Touren via PWA (PROJ-4/PROJ-5)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
