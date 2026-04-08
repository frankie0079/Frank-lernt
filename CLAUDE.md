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
- **Schema only via Migration:** NEVER create tables, columns, indexes, RLS policies or storage buckets manually in the Supabase Dashboard. Every schema change MUST be a SQL file in `supabase/migrations/`, committed to git, and applied via SQL Editor. Manual dashboard changes caused 4 critical production outages on 2026-04-06.
- **"Deployed" requires Production verification:** A feature may only be marked `Deployed` after at least one happy-path action has succeeded against the live Vercel URL — not just localhost. The `/qa` skill enforces this.
- **CLAUDE.md states only verified facts:** Never claim "live" / "Deployed" without verifying via REST introspection or an actual API call against production.

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
- **Storage Buckets (live):** `media` (public, 20MB, alle photo/video/audio MIME-Types), `avatars` (public, 2MB, JPEG/PNG/WebP), `covers` (public, 5MB, JPEG/PNG/WebP) — angelegt via `20260406_storage_buckets.sql`. `slideshows` (public, 50MB, video/webm + video/mp4 + application/zip) — angelegt via `20260407_slideshow.sql` (PROJ-34, applies after migration).
- **Env Vars (server):** `ANTHROPIC_API_KEY` für Claude Haiku Storyboard-Generierung in PROJ-34, `SUPABASE_SERVICE_ROLE_KEY` für alle Server-Routes (seit PROJ-35 BUG-1 Lockdown zwingend erforderlich)
- **Env Vars (public):** `NEXT_PUBLIC_SITE_URL=https://frank-lernt.vercel.app` für kanonische OG-URLs (seit PROJ-35)

## Aktueller Stand

### Deployed (Production)
- **PROJ-24: Auth & User-Accounts** — QA Round 4 passed (14/14 AC, 0 bugs)
- **PROJ-25: Event-Erstellung** — Deployed 2026-04-06 (BUG-R2-1 deferred to PROJ-33)
- **PROJ-26: Teilnehmer-Einladung** — Deployed 2026-04-06, QA Round 6 in Production passed (Migration `20260406_event_members_id_column.sql` angewendet, Schema-Drift behoben, BUG-3 Error-Sanitization gefixt).
- **PROJ-27: Wanderer-Screen** — Deployed, QA passed
- **PROJ-28: Content-Pool** — Deployed, QA passed
- **PROJ-29: Video-Aufnahme** — Deployed 2026-04-05, QA Round 2 (6/6 bugs fixed)
- **PROJ-30: Sprachmemo + Transkription** — Deployed 2026-04-06, QA Round 2 (7/7 bugs fixed)
- **PROJ-31: Likes & Emoji-Reactions** — Deployed 2026-04-06
- **PROJ-32: Kommentar-Threads** — Deployed 2026-04-06, 9 QA bugs fixed (incl. BUG-8/9 RLS bypass)
- **PROJ-33: Tages-Admin Kurations-Workflow** — Deployed 2026-04-07, QA Round 3 in Production passed via Playwright E2E (5 original bugs + 2 newly found BUG-6/7 fixed). Migrations `20260407_daily_reports.sql` + `20260407_fix_report_items.sql` angewendet.
- **PROJ-34: Slideshow-Generierung (Claude Haiku Storyboard)** — Deployed 2026-04-08, 51/51 Playwright E2E green in Production (incl. live Claude Haiku 4.5 call). Migration `20260407_slideshow.sql` angewendet. 4 Bugs by E2E caught + fixed: (1) RPC referenced non-existent `c.transcript` column, (2) missing `maxDuration=60s` caused Anthropic SDK timeout on Vercel Hobby, (3) trailing newline in `ANTHROPIC_API_KEY` env var → `.trim()` added defensively, (4) URL `event_id` wasn't validated against `agenda_item.event_id` (URL-tampering loophole).
- **PROJ-35: Öffentliche Event-Seite** — Deployed 2026-04-08, QA Round 5 green. Migrations `20260408_public_event_rls.sql` (SECURITY DEFINER RPC `get_public_event`) + `20260408_lockdown_anon_rls.sql` (BUG-1: anon-Lockdown auf 5 Tabellen, schließt kritische Token-Leak-Lücke) angewendet. 10 Bugs (1 Critical, 1 High, 2 Medium, 6 Low) gefunden + gefixt. Known regression: Realtime-Subscriptions auf `content_items` im Content-Pool → tracked als PROJ-38.

### Nächster Schritt
`/architecture` für **PROJ-36: Post-Event Tagebuch**

### Build-Reihenfolge
1. ~~PROJ-24~~ ✅ ~~PROJ-25~~ ✅ ~~PROJ-26~~ ✅ ~~PROJ-27~~ ✅ ~~PROJ-28~~ ✅ ~~PROJ-29~~ ✅ ~~PROJ-30~~ ✅ ~~PROJ-31~~ ✅ ~~PROJ-32~~ ✅ ~~PROJ-33~~ ✅ ~~PROJ-34~~ ✅ ~~PROJ-35~~ ✅
2. **PROJ-36: Post-Event Tagebuch** ← nächstes
3. **PROJ-37: PDF-Export**
4. **PROJ-38: Realtime-Fix Content-Pool** (Regression aus PROJ-35 BUG-1 Lockdown)

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md
