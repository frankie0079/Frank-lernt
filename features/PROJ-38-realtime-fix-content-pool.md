# PROJ-38: Realtime-Fix Content-Pool

## Status: Planned
**Created:** 2026-04-22
**Last Updated:** 2026-04-22

## Dependencies
- Requires: PROJ-35 (Öffentliche Event-Seite / anon-Lockdown) — dieser Lockdown ist die Ursache der Regression
- Requires: PROJ-28 (Content-Pool) — zu fixender Screen

## Hintergrund (Root Cause)
PROJ-35 BUG-1 (2026-04-08) sperrte `SELECT ON content_items` für die `anon`-Datenbankrolle via SQL-`REVOKE`, um zu verhindern, dass unauthentizierte Anfragen Member-Tokens über JOIN-Queries leaken. Das war korrekt und notwendig.

**Ungewollte Nebenwirkung:** Supabase Realtime (Postgres CDC) wertet RLS-Policies als die Rolle des Subscribers aus. Alle Browser-Clients subscriben mit dem Public Anon Key — also als `anon`. Nach dem Lockdown liefert Postgres keine CDC-Events mehr an diese Subscriber, weil `anon` keinen `SELECT`-Zugriff auf `content_items` hat. Die WebSocket-Verbindung bleibt offen, ist aber stumm.

## User Stories
- Als Wanderer möchte ich im Content-Pool neue Fotos und Videos von Mitreisenden sofort sehen (ohne Reload), damit ich live mitverfolgen kann, was gerade passiert.
- Als Tages-Admin möchte ich im Kurations-Screen neue Beiträge live erscheinen sehen, damit ich nichts übersehe und nicht manuell refreshen muss.
- Als Teilnehmer möchte ich neue Emoji-Reaktionen auf Beiträgen sofort sehen (Reaktions-Counter aktualisiert sich live), damit die Interaktion sich lebendig anfühlt.
- Als Organisator möchte ich sicher sein, dass die Realtime-Fixes keine neuen Sicherheitslücken öffnen (kein anon-Zugriff auf Member-Tokens oder andere sensible Daten).

## Acceptance Criteria
- [ ] Wenn Teilnehmer A ein neues Foto hochlädt, erscheint es auf dem Gerät von Teilnehmer B im Content-Pool **ohne Seiten-Reload** innerhalb von 3 Sekunden
- [ ] Wenn Teilnehmer A einen Beitrag löscht, verschwindet er auf Teilnehmer B's Gerät **ohne Reload**
- [ ] Emoji-Reaktionen (Counts) aktualisieren sich live auf allen verbundenen Geräten
- [ ] Im Kurations-Screen (selectable-content-grid) erscheinen neue Beiträge ebenfalls live
- [ ] Kein neuer anon-Zugriff auf `members.token`, `event_members` oder andere sensible Tabellen/Spalten
- [ ] Die Lösung funktioniert auf iOS Safari (PWA), Android Chrome und Desktop Chrome
- [ ] Bei Verbindungsunterbrechung und Reconnect: Subscription stellt sich automatisch wieder her, fehlende Beiträge werden nachgeladen (Fallback-Poll oder Re-Fetch)
- [ ] Kein sichtbarer Performance-Unterschied gegenüber dem Status vor dem Lockdown

## Edge Cases
- **Gleichzeitige Uploads mehrerer Teilnehmer** — mehrere INSERT-Events in kurzer Zeit → alle müssen ankommen, keine sollen gedroppt werden
- **Verbindungsabbruch (iOS Safari wechselt in den Hintergrund)** — Subscription muss sich nach Wiederherstellen der Verbindung neu aufbauen; in der Zwischenzeit angefallene neue Beiträge werden beim Reconnect nachgeladen
- **Nicht-Mitglied versucht Channel zu subscriben** — der Broadcast/Subscription-Mechanismus darf keine Event-Inhalte an Nicht-Mitglieder liefern; Access Control muss erhalten bleiben
- **Löschen eines Beitrags während ein anderer Teilnehmer ihn gerade anschaut** — kein Absturz, graceful removal
- **Sehr großer Event (50 Teilnehmer, 500+ Beiträge)** — Subscription muss stabil bleiben; kein Memory-Leak durch akkumulierende Listener
- **Realtime-Dienst temporär nicht verfügbar** — App bleibt funktionsfähig (Content-Pool zeigt statischen Stand), kein Absturz; nach Verfügbarkeit automatischer Reconnect

## Technical Requirements
- **Sicherheit:** Member-Tokens (`members.token`) dürfen durch diese Änderung unter keinen Umständen für nicht-authentifizierte Clients lesbar werden
- **Kein Breaking Change:** Bestehende API-Routes, RLS-Policies auf `members`, `events`, `event_members` und `agenda_items` bleiben unverändert
- **Zwei betroffene Komponenten:**
  - `src/components/content-pool.tsx` — Channels `content_items:event_id=eq.${eventId}` (INSERT, DELETE) und `reactions:event=${eventId}` (INSERT, DELETE)
  - `src/components/selectable-content-grid.tsx` — Channel auf `content_items`
- **Zwei mögliche Lösungsansätze für Architecture zu bewerten:**
  - **Option A — Supabase Broadcast:** Server-seitige API-Routes publishen nach jeder Mutation einen Broadcast-Event (`content:${eventId}`). Client subscribed auf Broadcast statt auf `postgres_changes`. Kein RLS-Problem (Broadcast evaluiert kein SELECT). Nachteil: jede mutierenden Route muss angepasst werden.
  - **Option B — Kontrollierte RLS-Policy für `content_items` anon:** `content_items` enthält keine Auth-Tokens — es wäre sicher, einen engen anon-SELECT via RLS-Policy zuzulassen (z.B. nur `SELECT` auf nicht-sensitiven Spalten innerhalb des eigenen Events, ohne JOIN auf `members`). Reaktiviert CDC direkt. Nachteil: `reactions`-Tabelle bräuchte dieselbe Behandlung.
- **Realtime-Library:** Supabase JS Client (`@supabase/supabase-js`) — bereits installiert

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
