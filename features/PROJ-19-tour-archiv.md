# PROJ-19: Tour-Archiv

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Archiv-Sektion auf der Landing Page

## User Stories
- Als Besucher möchte ich vergangene Touren der Wandervögel im Archiv durchstöbern, damit ich alte Abenteuer nacherleben kann.
- Als Wanderer möchte ich abgeschlossene Touren ins Archiv verschieben, damit die Landing Page übersichtlich bleibt.

## Acceptance Criteria
- [ ] Archiv-Sektion auf der Landing Page zeigt alle vergangenen Touren
- [ ] Jede archivierte Tour zeigt: Name, Datum, Strecke (km), Teilnehmer, Cover-Foto
- [ ] Klick auf Tour öffnet das vollständige Tagebuch und die Galerie der Tour
- [ ] Aktive Tour erscheint nicht im Archiv
- [ ] Touren sind nach Datum sortiert (neueste zuerst)

## Edge Cases
- Was wenn keine vergangenen Touren vorhanden sind? → "Noch keine archivierten Touren — die erste kommt bald!"
- Was wenn eine Tour kein Cover-Foto hat? → Standard-Platzhalter-Bild

## Technical Requirements
- Touren als eigene Datenbank-Entität mit Status (aktiv/archiviert)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
