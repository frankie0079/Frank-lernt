# PROJ-24: Auth & User-Accounts

## Status: In Progress
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Keine (Basis-Feature)

## User Stories
- Als neuer Nutzer möchte ich mich per Magic Link (Email) anmelden können, damit ich keinen Passwort-Manager brauche.
- Als Nutzer möchte ich einen Anzeigenamen und optionales Profilfoto setzen können, damit andere mich im Content-Pool erkennen.
- Als eingeloggter Nutzer möchte ich mich abmelden können.
- Als nicht-eingeloggter Besucher möchte ich öffentliche Event-Seiten sehen können, ohne mich anzumelden.

## Acceptance Criteria
- [ ] Magic Link Login via Email funktioniert (Supabase Auth Magic Link / Email OTP)
- [ ] Nutzer kann Display-Name (max 50 Zeichen) setzen und speichern
- [ ] Nutzer kann optionales Profilfoto hochladen (Supabase Storage, Bucket: `avatars`)
- [ ] Session bleibt nach App-Neustart bestehen (Supabase Session via LocalStorage)
- [ ] Geschützte Routen (`/events/*`, `/capture`) leiten nicht-eingeloggte Nutzer zur Login-Seite weiter
- [ ] Öffentliche Routen (`/e/*`) funktionieren vollständig ohne Login
- [ ] Abmelden löscht Session und leitet zur Login-Seite (`/login`) weiter
- [ ] Profil-Seite unter `/profile` zum Bearbeiten von Name und Foto
- [ ] Profilfoto wird in Content-Pool und Kommentaren als Avatar angezeigt
- [ ] "Anonym" als Fallback-Anzeigename wenn kein Name gesetzt

## Edge Cases
- Magic Link abgelaufen (15 min) → Fehlermeldung "Dieser Link ist abgelaufen" + Button "Neuen Link anfordern"
- Gleiche Email auf zweitem Gerät → Session auf beiden Geräten aktiv (Supabase Multi-Session)
- Profilfoto > 2 MB → Fehlermeldung "Bild zu groß (max. 2 MB)" vor dem Upload
- Profilfoto falsches Format (nicht JPEG/PNG/WebP) → Fehlermeldung "Nur JPEG, PNG und WebP erlaubt"
- Display-Name leer gelassen → "Anonym" als Fallback in allen Ansichten
- Kein Internet auf Login-Screen → Hinweis "Keine Internetverbindung — Magic Link benötigt Internet"
- Nutzer tippt falsche Email → Link wird an falsche Adresse gesandt, kein Fehler in der App (Security)
- Session-Token abgelaufen während aktiver Nutzung → Stiller Refresh, bei Fehler zur Login-Seite

## Technical Requirements
- Supabase Auth (Magic Link / Email OTP) — kein OAuth, kein Passwort
- `src/middleware.ts` mit Supabase SSR Auth-Check für geschützte Routen
- Server-Side Session via `@supabase/ssr` (createServerClient in Server Components, Route Handler, Middleware)
- Client-Side Session via `@supabase/ssr` (createBrowserClient in Client Components)
- `profiles` Tabelle in Supabase (id UUID FK auth.users, display_name TEXT, avatar_url TEXT, created_at TIMESTAMPTZ)
- RLS auf `profiles`: SELECT public, INSERT/UPDATE nur für eigene Zeile (auth.uid() = id)
- Storage Bucket `avatars`: public read, authentifiziertes Write
- Profilfoto-Kompression client-side (max 400px, < 200 KB) vor Upload
- Zod-Schema für Profil-Validierung (display_name max 50 Zeichen)

---

## Tech Design (Solution Architect)

### Übersicht
Foundation-Feature: Supabase Auth (Magic Link) + `profiles` Tabelle + Route-Schutz via Middleware. Alle v2-Features bauen darauf auf.

### Komponenten-Struktur

```
App Shell (Layout-Level)
+-- AuthProvider (wraps entire app — session state)
|
/login
+-- LoginPage
    +-- EmailInputForm (shadcn: Input + Button)
    +-- Confirmation State ("Magic Link wurde gesendet")
    +-- ErrorAlert (abgelaufen, kein Internet)
    +-- "Neuen Link anfordern" Button

/auth/callback (unsichtbarer Redirect-Handler)
+-- Session-Verarbeitung → weiterleiten zu /events

/profile (geschützt)
+-- ProfilePage
    +-- AvatarUpload
    |   +-- Avatar (shadcn: Avatar — bereits installiert)
    |   +-- Upload-Button + client-side Kompression
    |   +-- Fehlermeldungen (zu groß, falsches Format)
    +-- DisplayNameForm (shadcn: Input + Form)
    |   +-- Zeichenzähler (max 50)
    |   +-- Speichern-Button
    +-- AbmeldenButton

Middleware (serverseitig, unsichtbar)
+-- Schützt /events/*, /join/* → Redirect zu /login
+-- Öffentlich: /e/*, /login, /auth/callback
```

### Datenmodell

**Supabase Auth (built-in):**
- Benutzer-ID (UUID), Email, Session-Token (LocalStorage), Auto-Refresh

**`profiles` Tabelle:**
- ID = Auth-User-UUID (kein separater Key)
- display_name (Text, max 50 Zeichen, optional → Fallback "Anonym")
- avatar_url (Link zu Supabase Storage)
- created_at (Zeitstempel)
- Sicherheit: Lesen für alle, Schreiben nur für Besitzer (RLS)

**Storage Bucket `avatars`:**
- Öffentlich lesbar, authentifiziertes Schreiben
- Pfad: `{user-id}/avatar.jpg` (überschreibt bei Update)

### Tech-Entscheidungen

| Entscheidung | Warum |
|---|---|
| Magic Link statt Passwort | Kein Passwort-Vergessen-Flow, kein Sicherheitsrisiko |
| `@supabase/ssr` Package | Für Next.js App Router: Server Components + Middleware + Client sync |
| Middleware für Route-Schutz | Zentraler Auth-Check, läuft vor dem Seitenrendering |
| `profiles` Tabelle | auth.users nicht direkt im Browser zugänglich (Security) |
| Avatar-Kompression im Browser | Spart Storage-Kosten, schnellere Ladezeiten |
| shadcn Avatar Komponente | Bereits installiert, Wiederverwendung in PROJ-28/32/33 |

### Neue Routen
- `/login` — Magic Link anfordern (öffentlich)
- `/auth/callback` — Supabase verarbeitet Link-Klick (öffentlich)
- `/profile` — Name + Avatar bearbeiten (geschützt)

### Dependencies
- `@supabase/ssr` — Server-Side Auth für App Router (ggf. neu installieren)
- `@supabase/supabase-js` — Supabase Client (bereits v1)
- `browser-image-compression` — Avatar-Kompression (bereits v1)
- `zod` + `react-hook-form` — Profil-Validierung (bereits installiert)

### Wiederverwendung v1
- `src/lib/photo-upload.ts` — Kompression + Upload für Avatar
- `src/components/ui/avatar.tsx` — shadcn Avatar (bereits installiert)
- `src/components/ui/form.tsx` — shadcn Form für Display-Name

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
