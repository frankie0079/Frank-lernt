# PROJ-26: Teilnehmer-Einladung & Member-Management

## Status: In Progress
**Created:** 2026-03-08
**Last Updated:** 2026-04-04

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

### URL-Entscheidung: `/invite/[token]` statt `/join/[token]`

Die Spec nennt `/join/[token]`, aber diese Route ist bereits für die **Mitglieder-Authentifizierung** (persönlicher Login-Link) belegt. Event-Einladungen bekommen eine eigene Route:

```
/invite/[token]   ← NEU: Event-Einladungslinks
/join/[token]     ← BESTEHEND: Persönlicher Login-Link (bleibt unverändert)
```

Einladungslinks, die per WhatsApp geteilt werden, haben also das Format:
`https://app.example.com/invite/[32-Zeichen-Token]`

---

### Component Structure

```
/events/[id]/settings  (neue Seite — nur Organisator)
+-- SettingsHeader (Zurück zu /events/[id])
+-- InvitationLinkCard
|   +-- Link-Anzeige (URL + maskiert)
|   +-- CopyButton (Web Clipboard API)
|   +-- ShareButton (WhatsApp — bestehende Komponente!)
|   +-- ExpiryBadge ("Gültig noch X Tage")
|   +-- "Neuen Link generieren"-Button → AlertDialog (Bestätigung)
+-- EventMemberList
    +-- MemberRow (×N)
    |   +-- Avatar (shadcn)
    |   +-- Anzeigename + Rolle-Badge (organizer | admin | member)
    |   +-- Beitrittsdatum
    |   +-- "Entfernen"-Button (deaktiviert für Organisator selbst)
    +-- EmptyState (falls noch keine Mitglieder außer Organisator)

/invite/[token]  (neue Server-Route — Redirect-Logik)
  Eingeloggt + gültiger Token + kein Mitglied → Event beitreten → /events/[id]
  Eingeloggt + bereits Mitglied          → Toast + /events/[id]
  Eingeloggt + abgelaufener Token        → Fehlerseite
  NICHT eingeloggt                       → /login?redirect=/invite/[token]

/events/[id]  (bestehende Seite — minimale Ergänzung)
+-- [Organisator-only] "Einstellungen"-Tab oder Link → /events/[id]/settings
```

---

### Neue Datenbank-Tabellen

**`invitations`** — speichert aktive Einladungslinks pro Event

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | UUID PK | Primärschlüssel |
| event_id | UUID FK → events | Welches Event |
| token | TEXT UNIQUE | 32-Zeichen Zufallsstring (base64url) |
| created_by | UUID FK → members | Wer hat den Link generiert |
| expires_at | TIMESTAMPTZ | Ablaufzeit (7 Tage ab Erstellung) |
| created_at | TIMESTAMPTZ | Erstellungszeitpunkt |

Regel: Pro Event nur **ein aktiver Link** — bei "Neu generieren" wird der alte Datensatz überschrieben (UPSERT per event_id).

**`event_members`** — wer ist in welchem Event

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | UUID PK | Primärschlüssel |
| event_id | UUID FK → events CASCADE | Welches Event |
| member_id | UUID FK → members CASCADE | Wer |
| role | TEXT | 'organizer' \| 'admin' \| 'member' |
| joined_at | TIMESTAMPTZ | Beitrittszeitpunkt |

UNIQUE Constraint auf `(event_id, member_id)` — niemand kann doppelt beitreten.

---

### Neue API-Routen

| Route | Methode | Wer darf | Was passiert |
|-------|---------|----------|--------------|
| `/api/events/[id]/invitations` | GET | Organisator | Aktuellen Einladungslink abrufen |
| `/api/events/[id]/invitations` | POST | Organisator | Neuen Link generieren (alter wird invalidiert) |
| `/api/events/[id]/members` | GET | Event-Mitglied | Teilnehmerliste abrufen |
| `/api/events/[id]/members/[memberId]` | DELETE | Organisator | Mitglied entfernen (nicht sich selbst) |
| `/api/invite/[token]` | POST | Eingeloggtes Mitglied | Event beitreten |

---

### Sicherheits-Logik

- **Token-Generierung:** `crypto.randomBytes(24).toString('base64url')` → 32-Zeichen, kryptographisch sicher
- **Ablauf-Prüfung:** Server prüft `expires_at > NOW()` bei jedem Beitrittsversuch
- **Max-50-Grenze:** Vor dem Beitritt zählt der Server `COUNT(*) FROM event_members WHERE event_id = ?`
- **Selbst-Entfernen:** Server prüft ob `member_id = requesting_member_id` → 403
- **RLS (Row Level Security):**
  - `invitations`: Nur Organisator darf INSERT/SELECT — `/invite`-Route nutzt Service-Role-Key
  - `event_members`: SELECT für alle Event-Mitglieder, INSERT via `/invite`-Route, DELETE nur Organisator

---

### Wiederverwendete Komponenten

| Komponente | Wo | Zweck |
|------------|-----|-------|
| `ShareButton` | `src/components/share-button.tsx` | WhatsApp-Teilen des Einladungslinks |
| `Avatar` | shadcn/ui ✅ | Mitglieder-Avatar in der Liste |
| `Badge` | shadcn/ui ✅ | Rollen-Badge (organizer/admin/member) |
| `AlertDialog` | shadcn/ui ✅ | Bestätigung vor Link-Regenerierung und Mitglieder-Entfernung |
| `Table` | shadcn/ui ✅ | Teilnehmerliste |
| `Sheet` | shadcn/ui ✅ | ggf. Mobile-Ansicht der Member-Liste |

---

### Neue Komponenten

| Komponente | Datei | Zweck |
|------------|-------|-------|
| `InvitationLinkCard` | `src/components/invitation-link-card.tsx` | Link anzeigen, kopieren, teilen, neu generieren |
| `EventMemberList` | `src/components/event-member-list.tsx` | Tabelle aller Teilnehmer mit Entfernen-Aktion |

---

### Abhängigkeiten (neue Pakete)

Keine neuen Pakete nötig — `crypto` ist Node.js-built-in, alle shadcn-Komponenten sind bereits installiert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
