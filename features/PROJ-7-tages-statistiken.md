# PROJ-7: Tages-Statistiken

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-5 (PWA) — GPS-Tracking als Datenquelle
- Related: PROJ-3 (Reisetagebuch) — Statistiken werden im Tageseintrag angezeigt

## User Stories
- Als Wanderer möchte ich am Ende einer Tagesetappe automatisch die Statistiken sehen (km, Höhenmeter, Gehzeit), damit ich den Tag mit Zahlen festhalte.
- Als Follower möchte ich die Tages-Statistiken im Tagebuch sehen, damit ich mir vorstellen kann wie anstrengend die Etappe war.
- Als Wanderer möchte ich Statistiken manuell korrigieren können, falls das GPS-Tracking ungenau war.
- Als Besucher möchte ich eine Gesamtstatistik der Tour sehen (alle km, alle Höhenmeter, Gehzeit total), damit ich den Umfang der Reise verstehe.

## Acceptance Criteria
- [ ] Automatische Berechnung aus GPS-Track: Distanz (km), Aufstieg (Hm), Abstieg (Hm), Gehzeit (h:mm), Durchschnittsgeschwindigkeit (km/h)
- [ ] Temperatur wird angezeigt (aktuell via Wetter-API für die Tour-Region)
- [ ] Statistiken pro Tagesetappe werden im Tagebucheintrag angezeigt
- [ ] Gesamtstatistik der Tour wird auf der Landing Page angezeigt (kumuliert)
- [ ] Manuelle Eingabe/Korrektur der Statistiken möglich
- [ ] Statistiken als schöne visuelle Karten dargestellt (Icon + Zahl + Einheit)
- [ ] Statistiken sind öffentlich sichtbar (kein Login)

## Edge Cases
- Was wenn kein GPS-Track vorhanden ist? → Manuelle Eingabe als einzige Option
- Was wenn der GPS-Track lückenhaft ist (schlechter Empfang)? → Lücken interpolieren oder Warnung anzeigen
- Was wenn die manuell eingegebenen Werte unrealistisch sind? → Keine Validierung, Vertrauen in User
- Was wenn eine Etappe noch läuft? → Live-Statistiken anzeigen (aktueller Stand)

## Technical Requirements
- Haversine-Formel für Distanzberechnung aus GPS-Koordinaten
- Elevation-Daten aus GPS-Track (Höhenprofil)
- Echtzeit-Update während aktiver Etappe

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
