# PROJ-20: Kulinarik-Tagebuch

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-3 (Reisetagebuch) — Kulinarik als eigene Kategorie von Einträgen
- Requires: PROJ-4 (Fotogalerie) — Essens-Fotos

## User Stories
- Als Wanderer möchte ich Restaurants und Essen dokumentieren (Name, Ort, Bewertung, Foto), damit wir Empfehlungen für andere haben.
- Als Follower möchte ich das Kulinarik-Tagebuch lesen und die Essen-Fotos sehen, damit ich am kulinarischen Erlebnis teilhabe.

## Acceptance Criteria
- [ ] Kulinarik-Eintrag erstellen: Restaurant-Name, Ort, Bewertung (1-5 Sterne), Freitext, Foto
- [ ] Kulinarik-Einträge in eigenem Tab/Sektion sichtbar
- [ ] Fotos von Gerichten hochladbar
- [ ] Kein Login zum Erstellen oder Lesen nötig

## Edge Cases
- Was wenn kein Restaurant-Name angegeben wird? → Als "Unbekanntes Restaurant" speichern
- Was wenn keine Bewertung angegeben wird? → Eintrag ohne Bewertung

## Technical Requirements
- Eigene Datenbank-Tabelle für Kulinarik-Einträge
- Verknüpfung mit Tagesetappe (welcher Tag/Etappe)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
