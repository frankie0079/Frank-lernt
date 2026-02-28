# PROJ-11: Tages-Zusammenfassung (auto-generiert)

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-3 (Reisetagebuch) — Tagebucheinträge als Input
- Requires: PROJ-7 (Tages-Statistiken) — Statistiken als Input
- Requires: PROJ-4 (Fotogalerie) — Beste Fotos des Tages als Input

## User Stories
- Als Follower möchte ich am Abend eine schöne Tages-Zusammenfassung sehen (Highlight-Foto, Statistiken, bester Kommentar), damit ich den Tag auf einen Blick erfassen kann.
- Als Wanderer möchte ich die auto-generierte Zusammenfassung per WhatsApp teilen, damit Follower einen schönen Überblick bekommen.
- Als Besucher möchte ich frühere Tages-Zusammenfassungen lesen können, damit ich vergangene Etappen nacherleben kann.

## Acceptance Criteria
- [ ] Tages-Zusammenfassung wird automatisch am Abend generiert (oder manuell ausgelöst)
- [ ] Enthält: Bestes Foto des Tages, Tages-Statistiken, Highlight-Kommentar, Etappenname
- [ ] Zusammenfassung wird im Tagebuch als eigene "Postkarte" angezeigt
- [ ] Teilbar per WhatsApp (mit Link)
- [ ] Zusammenfassungen früherer Tage bleiben gespeichert und abrufbar
- [ ] Ansprechendes visuelles Design (Postkarten-Look)

## Edge Cases
- Was wenn keine Fotos an dem Tag hochgeladen wurden? → Zusammenfassung ohne Foto, Platzhalter-Bild
- Was wenn keine Statistiken vorhanden sind? → Zusammenfassung ohne Statistik-Block
- Was wenn keine Kommentare vorhanden sind? → Nur Foto + Statistiken
- Was wenn die Generierung fehlschlägt? → Fehler loggen, keine Zusammenfassung anzeigen

## Technical Requirements
- Geplanter Trigger (z.B. Supabase Edge Function via Cron) oder manueller Auslöser
- Optional: KI-generierter Zusammenfassungstext (Claude API) — Nice-to-have

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
