# PROJ-15: Interaktive Gesamtkarte mit Foto-Pins (alle Etappen)

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-6 (Interaktive Karte) — Basis-Karten-Implementation
- Requires: PROJ-4 (Fotogalerie) — Foto-Pins auf der Karte
- Requires: PROJ-3 (Reisetagebuch) — Alle Etappen der Tour

## User Stories
- Als Besucher möchte ich eine Gesamtübersicht aller Etappen auf einer Karte sehen, damit ich die komplette Route der Tour verstehe.
- Als Besucher möchte ich alle Fotos als Pins auf der Gesamtkarte sehen und anklicken, damit ich die Erlebnisse räumlich einordnen kann.
- Als Besucher möchte ich zwischen Etappen-Ansicht und Gesamtansicht wechseln, damit ich Details und Überblick kombinieren kann.

## Acceptance Criteria
- [ ] Gesamtkarte zeigt alle Etappen der Tour als zusammenhängende Route
- [ ] Alle Fotos sind als anklickbare Pins auf der Karte sichtbar
- [ ] Klick auf Foto-Pin zeigt Foto-Vorschau + Link zu vollständigem Eintrag
- [ ] Etappen sind farblich unterschiedlich markiert
- [ ] Zoom auf einzelne Etappe möglich
- [ ] Karte funktioniert auf Mobile und Desktop

## Edge Cases
- Was wenn sehr viele Foto-Pins vorhanden sind? → Clustering ab bestimmtem Zoom-Level
- Was wenn eine Etappe keine GPS-Daten hat? → Etappe ohne Linie, nur Startpunkt markiert
- Was wenn die Tour nur eine Etappe hat? → Gesamtkarte = Etappenkarte

## Technical Requirements
- Aufbauend auf PROJ-6 Karten-Implementation
- GeoJSON für alle Etappen-Routen kombiniert

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
