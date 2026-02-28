# PROJ-10: Push-Benachrichtigungen

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-5 (PWA) — Service Worker Basis
- Requires: PROJ-9 (Live-Ticker) — Ticker-Events als Trigger

## User Stories
- Als Follower möchte ich Push-Benachrichtigungen erhalten wenn eine neue Etappe startet oder endet, damit ich nichts verpasse.
- Als Follower möchte ich eine Benachrichtigung erhalten wenn neue Fotos hochgeladen werden, damit ich sie mir sofort anschauen kann.
- Als Follower möchte ich Push-Benachrichtigungen ein- und ausschalten können, damit ich nicht gestört werde.

## Acceptance Criteria
- [ ] Push-Benachrichtigung beim Start einer Etappe
- [ ] Push-Benachrichtigung beim Ende einer Etappe (mit Tages-Statistiken)
- [ ] Push-Benachrichtigung bei neuen Fotos (Batch, nicht für jedes einzelne Foto)
- [ ] Nutzer kann Benachrichtigungen in den App-Einstellungen ein-/ausschalten
- [ ] Benachrichtigung enthält Link direkt zum relevanten Inhalt
- [ ] Funktioniert auf iPhone (iOS Web Push ab iOS 16.4 mit installierten PWAs)

## Edge Cases
- Was wenn der Nutzer die Benachrichtigungs-Permission ablehnt? → App funktioniert weiterhin, keine Benachrichtigungen
- Was wenn viele Ereignisse gleichzeitig passieren? → Batch-Benachrichtigung statt Einzelbenachrichtigungen
- Was wenn iOS Push nicht unterstützt wird? → Graceful Degradation, Feature nicht anzeigen

## Technical Requirements
- Web Push API mit VAPID-Keys
- Service Worker für Push-Empfang im Hintergrund
- Supabase Edge Functions als Push-Trigger

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
