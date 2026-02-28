# PROJ-18: Highlight-Galerie (Voting)

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-4 (Fotogalerie) — Fotos als Basis zum Voten

## User Stories
- Als Besucher möchte ich für meine Lieblingsfotos abstimmen (👍), damit die besten Fotos als Highlights hervorgehoben werden.
- Als Besucher möchte ich die Highlight-Galerie sehen (die Fotos mit den meisten Votes), damit ich die besten Momente der Tour auf einen Blick sehe.

## Acceptance Criteria
- [ ] Jedes Foto hat einen Vote-Button (👍 / Herz)
- [ ] Vote-Zähler wird bei jedem Foto angezeigt
- [ ] Highlight-Galerie zeigt Top-Fotos nach Votes sortiert
- [ ] Voting ohne Login (1 Vote pro Foto pro Browser)
- [ ] Eigene Votes sind visuell markiert

## Edge Cases
- Was wenn jemand Vote-Button mehrfach drückt? → Zweiter Klick nimmt Vote zurück (Toggle)
- Was wenn alle Fotos gleich viele Votes haben? → Chronologische Sortierung als Fallback
- Was wenn keine Fotos vorhanden sind? → Leere Galerie mit Platzhalter

## Technical Requirements
- LocalStorage für Vote-Status pro Gerät
- Supabase für Vote-Zähler

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
