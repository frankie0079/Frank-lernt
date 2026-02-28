# PROJ-13: Countdown vor der Reise

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Countdown wird auf der Landing Page angezeigt

## User Stories
- Als Besucher möchte ich auf der Landing Page einen Countdown zur nächsten Tour sehen (Tage, Stunden, Minuten), damit die Vorfreude steigt.
- Als Wanderer möchte ich den Countdown konfigurieren (Startdatum der Tour), damit er korrekt anzeigt.

## Acceptance Criteria
- [ ] Countdown zeigt Tage, Stunden, Minuten bis zum Tourstart
- [ ] Countdown verschwindet wenn die Tour gestartet hat
- [ ] Startdatum ist konfigurierbar (nicht hard-coded)
- [ ] Countdown ist prominent auf der Landing Page platziert
- [ ] Ansprechendes visuelles Design

## Edge Cases
- Was wenn das Startdatum nicht konfiguriert ist? → Countdown nicht anzeigen
- Was wenn die Tour bereits begonnen hat? → "Tour läuft gerade!" anzeigen statt Countdown
- Was wenn die Tour beendet ist? → "Tour beendet — schaut ins Archiv!" anzeigen

## Technical Requirements
- Client-seitiger Timer (JavaScript setInterval)
- Konfiguration in Supabase (Tour-Startdatum als Datenbankfeld)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
