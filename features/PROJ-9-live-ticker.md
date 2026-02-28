# PROJ-9: Live-Ticker

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-3 (Reisetagebuch) — Ticker-Events kommen aus Tagebucheinträgen
- Requires: PROJ-5 (PWA) — Ticker-Events kommen aus GPS-Events
- Related: PROJ-11 (Tages-Zusammenfassung) — Tages-Ende als Ticker-Event

## User Stories
- Als Follower möchte ich einen Live-Ticker sehen (wie beim Sport), der automatisch neue Ereignisse anzeigt, damit ich die Tour in Echtzeit mitverfolge.
- Als Wanderer möchte ich schnelle Ticker-Meldungen posten ("Pause am Strand!"), ohne einen vollständigen Tageseintrag zu schreiben.
- Als Follower möchte ich, dass neue Ticker-Einträge automatisch erscheinen ohne die Seite neu zu laden.
- Als Follower möchte ich den Ticker chronologisch sehen (neuestes oben), damit ich sofort den aktuellen Stand sehe.

## Acceptance Criteria
- [ ] Ticker-Ansicht zeigt Ereignisse chronologisch (neuestes oben)
- [ ] Ereignis-Typen: Manueller Post, Etappe gestartet, Etappe beendet, Foto hochgeladen, Kommentar erstellt
- [ ] Wanderer können kurze Ticker-Meldungen posten (max. 280 Zeichen, optionales Emoji)
- [ ] Neue Ereignisse erscheinen automatisch (Realtime ohne Reload)
- [ ] Jedes Ticker-Ereignis zeigt: Zeit, Typ-Icon, Text
- [ ] Ticker ist auf Landing Page und in der PWA sichtbar
- [ ] Kein Login zum Lesen oder Posten nötig

## Edge Cases
- Was wenn der Ticker sehr viele Einträge hat (100+)? → Pagination oder "Ältere laden"
- Was wenn keine Ereignisse vorhanden sind? → "Noch keine Updates — die Tour startet bald!"
- Was wenn die Verbindung abbricht? → Letzten Stand behalten, Reconnect automatisch

## Technical Requirements
- Supabase Realtime für Live-Updates
- Optimistic UI für eigene Posts

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
