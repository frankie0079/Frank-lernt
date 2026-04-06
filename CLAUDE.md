# EventDocs — Kollaborative Event-Dokumentations-Plattform

> Gruppen von 5–50 Personen dokumentieren Events gemeinsam in Echtzeit (Fotos, Videos, Sprachmemos, Texte). Ein täglicher Admin kuratiert daraus eine Slideshow für WhatsApp. Nach dem Event: digitales Tagebuch + PDF-Export.

## Zwei Bereiche

- **PWA (Mobile)** = Eingabe-Instrument während des Events (Echtzeit, iPhone-first)
- **Landing Page (Desktop+Mobile)** = digitales Langzeit-Tagebuch, öffentlich, PDF-Export

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (35 Komponenten installiert)
- **Backend:** Supabase (Auth + PostgreSQL + Storage + Realtime)
- **Deployment:** Vercel (auto-deploy via GitHub)
- **PWA:** Serwist (Service Worker, App-Shell Caching)
- **Karten:** Leaflet + react-leaflet + OpenStreetMap (kostenlos)
- **Foto-Verarbeitung:** browser-image-compression + exifr (EXIF)
- **Video:** MediaRecorder API (Browser-nativ, bis 90s)
- **Transkription:** Web Speech API (kostenlos, Browser-nativ)
- **Slideshow:** Canvas API + MediaRecorder (client-side MP4/WebM)
- **PDF:** @react-pdf/renderer (client-side)
- **Validation:** Zod + react-hook-form
- **Auth:** Token-basierte Links (kein Supabase Auth, kein Login nötig)

## Architektur-Entscheidungen (v2)

- **Token-Links statt Login:** Organisator erstellt Mitglieder, jeder bekommt einen persönlichen Link per WhatsApp. Kein Passwort, keine E-Mail, kein Supabase Auth.
- **Events statt Tours:** Neues Datenmodell mit Events, Agenda, Teilnehmer, Content-Pool
- **Kostenlos:** Web Speech API statt Whisper, Canvas+MediaRecorder statt Remotion, manuelles Kuratieren statt Claude API
- **Client-side Rendering:** Slideshow + PDF werden im Browser generiert (kein Server nötig)
- **Supabase Realtime:** Content-Pool synchronisiert live zwischen allen Geräten
- **Turbopack inkompatibel:** Serwist erfordert `--webpack` Flag in dev/build Scripts

## v2 Datenmodell (geplant)

```
members (id, name, token, role: organizer|admin|member, avatar_url, created_at, updated_at) ← LIVE
events (id, name, description, cover_photo, dates, created_by) ← geplant
event_members (event_id, member_id, role) ← geplant
agenda_items (event_id, title, date, daily_admin_id, sort_order)
content_items (event_id, agenda_item_id, author_id, type: photo|video|text|voice, media_url, transcript, gps)
reactions (content_item_id, member_id, emoji)
comments (content_item_id, author_id, text)
daily_reports (event_id, agenda_item_id, curated_by, selected_content_ids, slideshow_url, status)
```

## v2 URL-Struktur (geplant)

```
/login                     Info-Seite ("Du brauchst einen Link")
/join/[token]              Persönlicher Link → Cookie → /events
/events                    Meine Events (geschützt)
/events/new                Event erstellen (geschützt)
/events/[id]               Event-Dashboard (geschützt)
/events/[id]/capture       Wanderer-Screen — 4 Buttons (geschützt)
/events/[id]/pool          Content-Pool — Karteikarten (geschützt)
/events/[id]/admin         Tages-Admin Workflow (geschützt)
/events/[id]/book          Post-Event Tagebuch (geschützt)
/profile                   Profil bearbeiten (Name + Avatar)
/e/[slug]                  Öffentliche Event-Seite (kein Login)

API:
/api/members               GET (Liste) + POST (Mitglied anlegen, nur Organisator)
/api/events                CRUD Events
/api/events/[id]/content   CRUD Content-Items
/api/events/[id]/reports   CRUD Daily Reports
```

## Development Workflow

1. `/requirements` — Feature-Spec schreiben ✅ (14 Specs: PROJ-24 bis PROJ-37)
2. `/architecture` — Tech-Design (PM-friendly, kein Code)
3. `/frontend` — UI-Komponenten (shadcn/ui first!)
4. `/backend` — APIs, DB-Schema, RLS Policies
5. `/qa` — Tests gegen Acceptance Criteria + Security Audit
6. `/deploy` — Vercel + Production-Ready Checks

## Feature Tracking

Alle Features in `features/INDEX.md`. Features: PROJ-24 bis PROJ-37. v1 (PROJ-1–23) wurde gelöscht.

## Key Conventions

- **Feature IDs:** PROJ-24+ (v2), Next: PROJ-38
- **Commits:** `feat(PROJ-X): description`, `fix(PROJ-X): description`
- **Single Responsibility:** One feature per spec file
- **shadcn/ui first:** NEVER create custom versions of installed shadcn components
- **Human-in-the-loop:** All workflows have user approval checkpoints
- **QA: Fix ALL bugs before deploy:** Always fix all QA bugs (including Low severity) before proceeding to deploy. Never skip or defer bugs to "next sprint".

## Build & Test Commands

```bash
npm run dev        # Development server (localhost:3000) — nutzt --webpack wegen Serwist
npm run build      # Production build — nutzt --webpack wegen Serwist
npm run lint       # ESLint
npm run start      # Production server
```

## Supabase

- **Projekt:** `xqopetmpzjbxksonmhjw` (Region: eu-west-1)
- **Tabellen (geplant):** `agenda_items`, `content_items`, `reactions`, `comments`, `daily_reports`
- **Auth:** Token-basierte Links (kein Supabase Auth)
- **Tabellen (live):** `members` (Token-Auth, RLS enabled), `events` (RLS enabled), `event_members`, `invitations`, `content_items` (RLS enabled)
- **Storage Buckets (live):** `photos`, `audio` (public, 20MB), `avatars` (public, 2MB, JPEG/PNG/WebP), `media` (public, 20MB)
- **Storage Buckets (geplant):** `slideshows`

## Aktueller Stand

### Deployed (Production)
- **PROJ-24: Auth & User-Accounts** — QA Round 4 passed (14/14 AC, 0 bugs)
- **PROJ-25: Event-Erstellung** — Deployed 2026-04-06 (BUG-R2-1 deferred to PROJ-33)
- **PROJ-26: Teilnehmer-Einladung** — ⚠️ **In Review**. QA Round 5 (Production E2E, 2026-04-06) deckte Schema-Drift auf: `event_members.id` fehlt in Production-DB → Beitritt + Teilnehmerliste komplett kaputt. Fix: Migration `20260406_event_members_id_column.sql` muss im Supabase Dashboard ausgeführt werden, danach redeploy.
- **PROJ-27: Wanderer-Screen** — Deployed, QA passed
- **PROJ-28: Content-Pool** — Deployed, QA passed
- **PROJ-29: Video-Aufnahme** — Deployed 2026-04-05, QA Round 2 (6/6 bugs fixed)
- **PROJ-30: Sprachmemo + Transkription** — Deployed 2026-04-06, QA Round 2 (7/7 bugs fixed)

### Nächster Schritt
`/architecture` für **PROJ-31: Reactions** (Likes & Emoji) oder **PROJ-32: Kommentare**

### Build-Reihenfolge
1. ~~PROJ-24~~ ✅ ~~PROJ-25~~ ✅ ~~PROJ-26~~ ✅ ~~PROJ-27~~ ✅ ~~PROJ-28~~ ✅ ~~PROJ-29~~ ✅ ~~PROJ-30~~ ✅
2. **PROJ-31: Reactions** + **PROJ-32: Kommentare** ← nächstes
3. **PROJ-33: Tages-Admin Workflow** + **PROJ-34: Slideshow**
4. **PROJ-35: Öffentliche Event-Seite**
5. **PROJ-36: Post-Event Tagebuch** + **PROJ-37: PDF-Export**

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md
