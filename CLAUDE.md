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
- **Auth:** Supabase Auth (Magic Link)

## Architektur-Entscheidungen (v2)

- **Auth statt anonym:** Supabase Auth (Magic Link), Rollen (Organisator, Tages-Admin, Teilnehmer)
- **Events statt Tours:** Neues Datenmodell mit Events, Agenda, Teilnehmer, Content-Pool
- **Kostenlos:** Web Speech API statt Whisper, Canvas+MediaRecorder statt Remotion, manuelles Kuratieren statt Claude API
- **Client-side Rendering:** Slideshow + PDF werden im Browser generiert (kein Server nötig)
- **Supabase Realtime:** Content-Pool synchronisiert live zwischen allen Geräten
- **Turbopack inkompatibel:** Serwist erfordert `--webpack` Flag in dev/build Scripts

## v2 Datenmodell (geplant)

```
auth.users (Supabase Auth built-in)
events (id, name, description, cover_photo, dates, created_by)
event_members (event_id, user_id, role: organizer|admin|member)
agenda_items (event_id, title, date, daily_admin_id, sort_order)
content_items (event_id, agenda_item_id, author_id, type: photo|video|text|voice, media_url, transcript, gps)
reactions (content_item_id, user_id, emoji)
comments (content_item_id, author_id, text)
daily_reports (event_id, agenda_item_id, curated_by, selected_content_ids, slideshow_url, status)
```

## v2 URL-Struktur (geplant)

```
/login                     Login (Magic Link)
/events                    Meine Events (geschützt)
/events/new                Event erstellen (geschützt)
/events/[id]               Event-Dashboard (geschützt)
/events/[id]/capture       Wanderer-Screen — 4 Buttons (geschützt)
/events/[id]/pool          Content-Pool — Karteikarten (geschützt)
/events/[id]/admin         Tages-Admin Workflow (geschützt)
/events/[id]/book          Post-Event Tagebuch (geschützt)
/join/[token]              Einladungslink → Login → Event beitreten
/e/[slug]                  Öffentliche Event-Seite (kein Login)

API:
/api/events                CRUD Events
/api/events/[id]/content   CRUD Content-Items
/api/events/[id]/reports   CRUD Daily Reports
```

## v1 Code (Wiederverwendbar)

Der bestehende v1-Code bleibt im Repo. Folgende Teile werden in v2 wiederverwendet:

| Komponente | Dateien | Wiederverwendung |
|------------|---------|------------------|
| Foto-Pipeline | `src/lib/photo-upload.ts` | EXIF → Kompression → Upload |
| Karte | `src/components/leaflet-map.tsx`, `karte-client.tsx` | GPS-Marker auf Event-Karte |
| PWA-Basis | `src/app/sw.ts`, `public/manifest.json` | Service Worker anpassen |
| Share-Button | `src/components/share-button.tsx` | Web Share API + wa.me |
| Photo-Grid | `src/components/photo-grid.tsx`, `photo-lightbox.tsx` | Content-Pool Foto-Ansicht |
| Rate-Limiting | `src/lib/rate-limit.ts` | API-Schutz |
| shadcn/ui | `src/components/ui/` (35 Komponenten) | Gesamte UI |

## Development Workflow

1. `/requirements` — Feature-Spec schreiben ✅ (14 Specs: PROJ-24 bis PROJ-37)
2. `/architecture` — Tech-Design (PM-friendly, kein Code)
3. `/frontend` — UI-Komponenten (shadcn/ui first!)
4. `/backend` — APIs, DB-Schema, RLS Policies
5. `/qa` — Tests gegen Acceptance Criteria + Security Audit
6. `/deploy` — Vercel + Production-Ready Checks

## Feature Tracking

Alle Features in `features/INDEX.md`. v2 Features: PROJ-24 bis PROJ-37. v1 Features (PROJ-1 bis PROJ-23): Superseded.

## Key Conventions

- **Feature IDs:** PROJ-24+ (v2), Next: PROJ-38
- **Commits:** `feat(PROJ-X): description`, `fix(PROJ-X): description`
- **Single Responsibility:** One feature per spec file
- **shadcn/ui first:** NEVER create custom versions of installed shadcn components
- **Human-in-the-loop:** All workflows have user approval checkpoints

## Build & Test Commands

```bash
npm run dev        # Development server (localhost:3000) — nutzt --webpack wegen Serwist
npm run build      # Production build — nutzt --webpack wegen Serwist
npm run lint       # ESLint
npm run start      # Production server
```

## Supabase

- **Projekt:** `xqopetmpzjbxksonmhjw` (Region: eu-west-1)
- **v1 Tabellen (live):** `tours`, `diary_entries`, `photos`, `audio_notes`
- **v2 Tabellen (geplant):** `events`, `event_members`, `agenda_items`, `content_items`, `reactions`, `comments`, `daily_reports`
- **Auth:** Noch nicht aktiviert (v2 Phase 1: PROJ-24)
- **Storage Buckets (live):** `photos`, `audio` (public, 20MB)
- **Storage Buckets (geplant):** `media`, `slideshows`

## Aktueller Stand

**v2 Requirements abgeschlossen** — 14 Feature-Specs (PROJ-24 bis PROJ-37)

Empfohlene Build-Reihenfolge:
1. **PROJ-24: Auth** ← Foundation, alles baut darauf auf
2. **PROJ-25: Event-Erstellung**
3. **PROJ-26: Teilnehmer-Einladung**
4. **PROJ-27: Wanderer-Screen** (Eingabe: Foto/Video/Text/Sprache)
5. **PROJ-28: Content-Pool** (Realtime-Karteikarten)
6. **PROJ-29: Video-Aufnahme** + **PROJ-30: Sprachmemo**
7. **PROJ-31: Reactions** + **PROJ-32: Kommentare**
8. **PROJ-33: Tages-Admin Workflow** + **PROJ-34: Slideshow**
9. **PROJ-35: Öffentliche Event-Seite**
10. **PROJ-36: Post-Event Tagebuch** + **PROJ-37: PDF-Export**

**Nächster Schritt:** `/architecture` für PROJ-24 (Auth & User-Accounts)

**Plan-Datei:** `.claude/plans/eager-questing-petal.md`

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md
