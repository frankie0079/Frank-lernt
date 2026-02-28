# PROJ-21: Export als PDF-Fotobuch

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-3 (Reisetagebuch) — Inhalte für das PDF
- Requires: PROJ-4 (Fotogalerie) — Fotos für das PDF
- Requires: PROJ-7 (Tages-Statistiken) — Statistiken für das PDF

## User Stories
- Als Wanderer möchte ich das komplette Reisetagebuch als PDF exportieren, damit ich es ausdrucken oder digital aufbewahren kann.
- Als Wanderer möchte ich das PDF-Fotobuch als schönes Andenken an die Tour haben.

## Acceptance Criteria
- [ ] Export-Button generiert PDF mit: Titelseite, alle Tageseinträge, Fotos, Statistiken
- [ ] PDF ist gut formatiert und druckfertig (A4)
- [ ] Fotos werden in guter Qualität eingebettet
- [ ] Generierung läuft im Hintergrund (keine Browser-Blockierung)
- [ ] Download-Link wird nach Fertigstellung bereitgestellt

## Edge Cases
- Was wenn sehr viele Fotos vorhanden sind? → PDF-Generierung kann mehrere Minuten dauern; Fortschrittsanzeige
- Was wenn die Generierung fehlschlägt? → Fehlermeldung mit Retry-Option
- Was wenn kein Inhalt vorhanden ist? → Export-Button deaktiviert

## Technical Requirements
- Supabase Edge Function für server-seitige PDF-Generierung
- Puppeteer oder pdfkit für PDF-Erstellung
- Supabase Storage für temporäre PDF-Dateien

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
