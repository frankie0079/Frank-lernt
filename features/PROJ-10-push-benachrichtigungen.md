# PROJ-10: Push-Benachrichtigungen

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-5 (PWA) — Service Worker Basis
- Requires: PROJ-9 (Live-Ticker) — Ticker-Events als Trigger

## User Stories
- Als Follower möchte ich einmal am Tag eine Push-Benachrichtigung erhalten wenn die Tages-Summary bereit ist, damit ich den Tag nacherleben kann.
- Als Follower möchte ich Push-Benachrichtigungen ein- und ausschalten können, damit ich nicht gestört werde.

## Acceptance Criteria
- [ ] Push-Benachrichtigung nur einmal am Tag: wenn die Tages-Summary erstellt und versendet wurde
- [ ] Benachrichtigung enthält: Etappenname, kurze Statistik, Link zur Summary auf der Plattform
- [ ] Keine Push-Benachrichtigungen für einzelne Fotos, Kommentare oder Etappen-Starts
- [ ] Nutzer kann Benachrichtigungen ein-/ausschalten
- [ ] Funktioniert auf iPhone (iOS Web Push ab iOS 16.4 mit installierten PWAs)

## Edge Cases
- Was wenn der Nutzer die Benachrichtigungs-Permission ablehnt? → App funktioniert weiterhin, keine Benachrichtigungen
- Was wenn keine Summary an einem Tag erstellt wird? → Keine Benachrichtigung
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
