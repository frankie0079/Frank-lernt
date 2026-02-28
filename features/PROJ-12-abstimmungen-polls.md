# PROJ-12: Abstimmungen / Polls

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Polls werden auf der Plattform angezeigt
- Related: PROJ-9 (Live-Ticker) — Neue Polls als Ticker-Ereignis

## User Stories
- Als Wanderer möchte ich eine schnelle Abstimmung erstellen ("Welches Restaurant heute Abend?"), damit wir Gruppenentscheidungen einfach treffen können.
- Als Follower möchte ich bei Abstimmungen mitmachen, damit ich einbezogen bin.
- Als Besucher möchte ich das Ergebnis einer Abstimmung sehen, damit ich weiss wie die Gruppe entschieden hat.

## Acceptance Criteria
- [ ] Poll erstellen: Frage + 2-4 Antwortoptionen
- [ ] Abstimmen ohne Login (1 Stimme pro Browser/Gerät)
- [ ] Ergebnis wird live angezeigt (Balkendiagramm mit Prozenten)
- [ ] Poll kann als "beendet" markiert werden (kein weiteres Abstimmen möglich)
- [ ] Polls erscheinen in der PWA und auf der Landing Page
- [ ] Neuer Poll wird im Live-Ticker angezeigt

## Edge Cases
- Was wenn jemand mehrfach abstimmt (anderer Browser)? → Für MVP kein harter Schutz, Vertrauen in Gruppe
- Was wenn ein Poll keine Stimmen hat? → "Noch keine Stimmen" anzeigen
- Was wenn ein Poll abgelaufen ist? → Ergebnis weiterhin anzeigen, Abstimmen deaktiviert

## Technical Requirements
- Supabase Realtime für Live-Ergebnis-Updates
- LocalStorage um Mehrfachabstimmung zu erschweren

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
