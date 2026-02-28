# PROJ-17: Auto-Zusammenfassung nach der Reise

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-7 (Tages-Statistiken) — Gesamtstatistiken
- Requires: PROJ-4 (Fotogalerie) — Highlight-Fotos
- Requires: PROJ-3 (Reisetagebuch) — Alle Einträge der Tour

## User Stories
- Als Besucher möchte ich nach der Tour eine schöne Gesamtzusammenfassung sehen ("Die Wandervögel 2026: 7 Tage, 120km, 847 Fotos"), damit ich die Reise als Ganzes erfasse.
- Als Wanderer möchte ich die Zusammenfassung als Andenken aufrufen können, damit die Tour als schöne Erinnerung erhalten bleibt.

## Acceptance Criteria
- [ ] Gesamtstatistiken der Tour: km total, Höhenmeter total, Gehzeit total, Tage, Teilnehmer
- [ ] Highlight-Fotos aus allen Etappen (automatisch ausgewählt oder manuell kuratiert)
- [ ] Wird automatisch nach Tour-Ende generiert
- [ ] Ansprechendes Design (Jahresbericht-Stil)
- [ ] Teilbar per Link und WhatsApp

## Edge Cases
- Was wenn die Tour noch läuft? → Zusammenfassung nicht anzeigen
- Was wenn keine Statistiken vorhanden sind? → Nur Fotos und Text

## Technical Requirements
- Supabase Edge Function als Trigger nach Tour-Ende
- Optional: KI-generierter Reisebericht (Claude API)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
