# PROJ-26: Teilnehmer-Einladung & Member-Management

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-24 (Auth & User-Accounts) — Eingeladene Person muss eingeloggt sein, um beizutreten
- Requires: PROJ-25 (Event-Erstellung & -Verwaltung) — Event muss existieren

## User Stories
- Als Organisator möchte ich Einladungslinks generieren, damit ich sie per WhatsApp oder Email teilen kann.
- Als eingeladene Person möchte ich dem Event über den Einladungslink beitreten.
- Als Organisator möchte ich die Teilnehmerliste sehen und Mitglieder entfernen können.
- Als Teilnehmer möchte ich sehen, wer sonst noch dabei ist.

## Acceptance Criteria
- [ ] Einladungslink ist 7 Tage gültig (Ablaufzeitpunkt in DB gespeichert)
- [ ] Link-Format: `/join/[token]` — Token ist kryptographisch sicherer Zufallsstring (32 Zeichen)
- [ ] Klick auf Link → Login-Check: falls nicht eingeloggt → Login-Seite mit `?redirect=/join/[token]` → nach Login automatisch beitreten
- [ ] Teilnehmerliste zeigt: Avatar, Anzeigename, Rolle (`organizer` | `admin` | `member`), Beitrittsdatum
- [ ] Teilnehmerliste ist nur für Mitglieder sichtbar (nicht öffentlich)
- [ ] Organisator kann Teilnehmer per Klick entfernen (Bestätigungs-Dialog)
- [ ] Organisator kann sich selbst nicht entfernen (Button deaktiviert)
- [ ] Max. 50 Teilnehmer pro Event → Fehlermeldung "Maximale Teilnehmerzahl (50) erreicht" bei Überschreitung
- [ ] Organisator kann neuen Einladungslink generieren → alter Link wird sofort invalidiert
- [ ] Kopiier-Button für den Einladungslink (Web Clipboard API)
- [ ] Einladungslink-Bereich in den Event-Einstellungen unter `/events/[id]/settings`

## Edge Cases
- Bereits Mitglied klickt Link → Toast-Meldung "Du bist bereits Mitglied dieses Events" + Weiterleitung zu `/events/[id]`
- Link abgelaufen (> 7 Tage) → Fehlerseite "Diese Einladung ist nicht mehr gültig. Bitte den Organisator um einen neuen Link."
- Link ungültig (manuell manipuliert) → 404-Fehlerseite
- 50. Teilnehmer tritt bei → Erfolg; 51. Teilnehmer → Fehlermeldung
- Teilnehmer verlässt Event (oder wird entfernt) → Alle Beiträge bleiben bestehen (`author_id` bleibt erhalten, Profilname bleibt sichtbar)
- Organisator entfernt sich versehentlich → Nicht möglich (serverseitige Prüfung)
- Einladungslink wird öffentlich gepostet → Max-Teilnehmer-Limit schützt vor Missbrauch
- Nutzer befindet sich offline beim Klick auf Einladungslink → Offline-Hinweis mit Aufforderung, sich zu verbinden

## Technical Requirements
- Supabase Tabellen: `invitations` (id UUID PK, event_id UUID FK events CASCADE, token TEXT UNIQUE, created_by UUID FK auth.users, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
- Supabase Tabellen: `event_members` (id UUID PK, event_id UUID FK events CASCADE, user_id UUID FK auth.users, role TEXT CHECK (role IN ('organizer','admin','member')), joined_at TIMESTAMPTZ)
- UNIQUE Constraint auf `event_members(event_id, user_id)`
- RLS auf `invitations`: SELECT + INSERT für Organisator, SELECT für `/join/[token]` Route (public via service role)
- RLS auf `event_members`: SELECT für Mitglieder, INSERT via `/join` Route, DELETE für Organisator (nicht eigene Zeile)
- Token-Generierung: `crypto.randomBytes(24).toString('base64url')` in Server-Action
- Einladungslink-Ablauf: Server-seitige Prüfung `expires_at > NOW()`
- Teilnehmer-Zählung vor Beitritt: `SELECT COUNT(*) FROM event_members WHERE event_id = $1`
- Zod-Validierung für alle API-Routen

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
