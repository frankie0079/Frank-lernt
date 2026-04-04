# PROJ-24: Auth & User-Accounts

## Status: In Review
**Created:** 2026-03-08
**Last Updated:** 2026-04-04

## Dependencies
- Keine (Basis-Feature)

## User Stories
- Als Organisator möchte ich Mitglieder anlegen und jedem einen persönlichen Link per WhatsApp schicken können.
- Als Teilnehmer möchte ich einen Link klicken und sofort eingeloggt sein — ohne Passwort, E-Mail oder App-Download.
- Als Nutzer möchte ich einen Anzeigenamen und optionales Profilfoto setzen können, damit andere mich im Content-Pool erkennen.
- Als eingeloggter Nutzer möchte ich mich abmelden können.
- Als nicht-eingeloggter Besucher möchte ich öffentliche Event-Seiten sehen können, ohne mich anzumelden.

## Acceptance Criteria
- [x] Organisator kann Mitglieder anlegen via `POST /api/members` (Zod-validiert)
- [x] Jedes Mitglied bekommt einen einzigartigen persönlichen Link (`/join/[token]`)
- [x] Link klicken → httpOnly Cookie setzen → sofort eingeloggt auf `/events`
- [x] Nutzer kann Display-Name (max 50 Zeichen) setzen und speichern
- [x] Nutzer kann optionales Profilfoto hochladen (Supabase Storage, Bucket: `avatars`)
- [x] Session bleibt nach App-Neustart bestehen (httpOnly Cookie, 30 Tage)
- [x] Geschützte Routen (`/events/*`, `/profile`) leiten nicht-eingeloggte Nutzer zur Login-Seite weiter
- [x] Öffentliche Routen (`/e/*`, `/join/*`) funktionieren vollständig ohne Login
- [x] Abmelden löscht Cookie und leitet zur Login-Seite (`/login`) weiter
- [x] Profil-Seite unter `/profile` zum Bearbeiten von Name und Foto
- [x] "Anonym" als Fallback-Anzeigename wenn kein Name gesetzt
- [x] Token wird nie an den Browser/Client gesendet (nur httpOnly Cookie)
- [x] Profil-Updates gehen über `/api/members/me` (IDOR-geschützt)
- [x] Rate Limiting auf POST/PATCH Endpunkten

## Edge Cases
- Ungültiger Token-Link → Fehlermeldung "Dieser Link ist ungueltig" + Hinweis "Frag den Organisator"
- Profilfoto > 2 MB → Fehlermeldung "Bild zu groß (max. 2 MB)" vor dem Upload
- Profilfoto falsches Format (nicht JPEG/PNG/WebP) → Fehlermeldung "Nur JPEG, PNG und WebP erlaubt"
- Display-Name leer gelassen → "Anonym" als Fallback in allen Ansichten
- Cookie abgelaufen oder gelöscht → Middleware leitet zu `/login` weiter
- Ungültiges Cookie (Token existiert nicht mehr in DB) → Cookie löschen, redirect zu `/login`

## Technical Requirements
- Token-basierte Links (kein Supabase Auth, kein Magic Link, keine E-Mail)
- `members` Tabelle in Supabase (id, name, token, role, avatar_url, created_at, updated_at)
- RLS enabled auf `members` Tabelle
- `src/middleware.ts` prüft `member_token` httpOnly Cookie gegen DB
- `/api/members/me` für sichere Profil-Updates (GET eigenes Profil, PATCH Name/Avatar, DELETE sign-out)
- `/api/members` für Organisator-Verwaltung (GET Liste, POST neues Mitglied)
- Storage Bucket `avatars`: public read, 2MB Limit, JPEG/PNG/WebP
- Profilfoto-Kompression client-side (max 400px, < 200 KB) vor Upload
- Zod-Schema für Profil-Validierung (display_name max 50 Zeichen)
- Rate Limiting via `src/lib/rate-limit.ts`

---

## Tech Design

### Übersicht
Foundation-Feature: Token-basierte persönliche Links + `members` Tabelle + Route-Schutz via Middleware. Alle v2-Features bauen darauf auf.

### Auth-Flow
```
1. Organisator erstellt Mitglied → POST /api/members → bekommt Join-Link
2. Organisator schickt Link per WhatsApp an Freund
3. Freund klickt /join/[token] → httpOnly Cookie gesetzt → redirect /events
4. AuthProvider ruft /api/members/me → bekommt Member-Daten (ohne Token!)
5. Profil bearbeiten: PATCH /api/members/me (Server validiert Token aus Cookie)
```

### Komponenten-Struktur
```
App Shell (Layout-Level)
+-- AuthProvider (wraps entire app — fetches /api/members/me)
|
/login
+-- Info-Seite ("Du brauchst einen Einladungslink")
+-- Fehlermeldung bei ungültigem Link

/join/[token] (Route Handler)
+-- Token validieren → Cookie setzen → /events

/profile (geschützt)
+-- ProfilePage
    +-- AvatarUpload (Upload → Supabase Storage → PATCH /api/members/me)
    +-- DisplayNameForm (PATCH /api/members/me)
    +-- AbmeldenButton (DELETE /api/members/me)

/events (geschützt)
+-- Events Dashboard mit Profil-Avatar

Middleware (serverseitig)
+-- Prüft member_token Cookie gegen DB
+-- Schützt /events/*, /profile → Redirect zu /login
+-- Öffentlich: /, /join/*, /e/*, /touren/*
```

### Datenmodell

**`members` Tabelle (live):**
- id: UUID (PK, auto-generated)
- name: TEXT (optional, max 50 Zeichen → Fallback "Anonym")
- token: TEXT (unique, auto-generated 32 hex chars)
- role: TEXT ('organizer' | 'admin' | 'member')
- avatar_url: TEXT (Link zu Supabase Storage)
- created_at, updated_at: TIMESTAMPTZ (auto-managed)
- RLS enabled, auto-updated_at Trigger

**Storage Bucket `avatars` (live):**
- Öffentlich lesbar, 2MB Limit, JPEG/PNG/WebP
- Pfad: `{member-id}/avatar.jpg` (überschreibt bei Update)

### API-Endpunkte

| Methode | Route | Auth | Beschreibung |
|---------|-------|------|-------------|
| GET | /api/members | member | Mitgliederliste |
| POST | /api/members | organizer | Neues Mitglied anlegen (+ Join-Link) |
| GET | /api/members/me | member | Eigenes Profil (ohne Token) |
| PATCH | /api/members/me | member | Name/Avatar updaten |
| DELETE | /api/members/me | any | Abmelden (Cookie löschen) |

### Sicherheit
- Token wird NIE an Client gesendet (httpOnly Cookie, /api/members/me gibt Token nicht zurück)
- Profil-Updates nur über eigenen Token möglich (kein IDOR)
- Rate Limiting auf mutating Endpunkten (POST, PATCH)
- Middleware validiert Token gegen DB bei jedem Request

## QA Test Results

### Test Run: 2026-04-04
**7 Bugs found, all fixed:**

| Bug | Schwere | Problem | Fix |
|-----|---------|---------|-----|
| BUG-1 | Kritisch | httpOnly Cookie nicht per JS lesbar | AuthProvider nutzt /api/members/me statt document.cookie |
| BUG-2 | Kritisch | Token im Browser-State sichtbar | /api/members/me gibt Token nicht zurueck |
| BUG-3 | Hoch | IDOR: jeder konnte jedes Profil aendern | Profil-Updates via /api/members/me (Server prueft Token) |
| BUG-4 | Medium | Kein Rate Limiting | rate-limit.ts eingebunden in POST/PATCH Endpunkte |
| BUG-5 | Medium | Feature-Spec veraltet | Spec komplett aktualisiert |
| BUG-6 | Low | DB-Query pro Middleware-Request | Akzeptabler Tradeoff, Kommentar hinzugefuegt |
| BUG-7 | Low | redirect-Parameter nicht genutzt | Akzeptabler Tradeoff, Kommentar hinzugefuegt |

**Status nach Fixes: Alle Acceptance Criteria erfuellt.**

## Deployment
_To be added by /deploy_
