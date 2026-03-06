# Die Wandervögel — Reisebegleiter-Plattform

> Eine Plattform für unsere Wandergruppe (2-8 Teilnehmer) und ihre Follower. Ersetzt umständliche Tools durch zentrale Reiseplanung, Live-Tracking, Reisetagebuch und Fotogalerie. Erste Tour: Rota Vicentina / Fischerpfad, Portugal — Juni 2026.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (copy-paste components)
- **Fonts:** Caveat (Google Font, Handschrift) via `next/font/google` — CSS-Variable `--font-caveat`
- **Backend:** Supabase (PostgreSQL + Storage) — angebunden, Tabellen + RLS + Storage Bucket live
- **Deployment:** Vercel
- **Validation:** Zod + react-hook-form
- **State:** React useState / Context API
- **Bilder:** Unsplash (remote patterns in next.config.ts), Next.js Image

## Project Structure

```
src/
  app/
    page.tsx            Landing Page (Server Component)
    layout.tsx          Root Layout (Caveat Font, lang="de", hyphens)
    globals.css         Custom Color Theme (Teal/Amber)
    api/
      tours/
        route.ts              GET /api/tours — Alle Touren
        [id]/
          route.ts            GET /api/tours/[id] — Einzelne Tour
          diary/route.ts      GET/POST — Tagebucheinträge
          photos/route.ts     GET/POST — Foto-Metadaten
  components/
    ui/                 shadcn/ui components (NEVER recreate these)
    hero-section.tsx    Hero mit Logo, Titel, handgeschriebenem Zitat
    touren-bereich.tsx  Touren-Übersicht (aktive + vergangene)
    aktive-tour-karte.tsx   Große Karte für aktive/nächste Tour
    tour-kompakt-karte.tsx  Kompakte Karte für vergangene Touren
    tour-navigation.tsx     Navigation (Planung/Tagebuch/Galerie/Karte)
  hooks/                Custom React hooks
  lib/
    database.types.ts   Auto-generierte Supabase-Typen (Tables, TablesInsert)
    types.ts            App-Typen (Tour, DiaryEntry, Photo) — basiert auf DB-Typen
    mock-data.ts        Mock-Touren (Rota Vicentina + 2 vergangene) — Fallback
    supabase.ts         Typed Supabase Client (createClient<Database>)
    utils.ts            Utility-Funktionen (cn)
features/               Feature specifications (PROJ-X-name.md)
  INDEX.md              Feature status overview (22 Features, PROJ-1 bis PROJ-22)
docs/
  PRD.md                Product Requirements Document
  production/           Production guides (Sentry, security, performance)
public/
  Logo_Wandervoegel.JPG Gruppen-Logo
```

## Design-Entscheidungen

- **Farbschema:** Teal (Primary `hsl(174 62% 38%)`) + Amber (Accent `hsl(38 90% 55%)`) — Natur/Wandern-Thema
- **Kein Login:** Komplett öffentlich, kein Auth nötig
- **Server Components:** Landing Page ist rein serverseitig gerendert (kein Client-JS)
- **Fluid Responsive:** Dynamische Anpassung ohne feste Breakpoints (CSS Container Queries, Flexbox/Grid)
- **Sprache:** Deutsch mit `lang="de"`, CSS `hyphens: auto` für Silbentrennung
- **Supabase live:** Tabellen (tours, diary_entries, photos), RLS (public read+insert), Storage Bucket (photos)
- **Mock-Daten als Fallback:** Landing Page nutzt noch `mock-data.ts`, Tour-Daten existieren parallel in Supabase

## URL-Struktur

```
/                          Landing Page (PROJ-1) ✅
/touren/[id]/planung       Reiseplanung (PROJ-2, nur aktive Tour)
/touren/[id]/tagebuch      Reisetagebuch (PROJ-3) — Backend ready
/touren/[id]/galerie       Fotogalerie (PROJ-4) — Backend ready
/touren/[id]/karte         Interaktive Karte (PROJ-6) — Backend ready
/archiv                    Tour-Archiv (PROJ-19)

API:
/api/tours                 GET — Alle Touren
/api/tours/[id]            GET — Einzelne Tour
/api/tours/[id]/diary      GET/POST — Tagebucheinträge (Zod-validiert)
/api/tours/[id]/photos     GET/POST — Foto-Metadaten (Zod-validiert)
```

## Development Workflow

1. `/requirements` - Create feature spec from idea
2. `/architecture` - Design tech architecture (PM-friendly, no code)
3. `/frontend` - Build UI components (shadcn/ui first!)
4. `/backend` - Build APIs, database, RLS policies
5. `/qa` - Test against acceptance criteria + security audit
6. `/deploy` - Deploy to Vercel + production-ready checks

## Feature Tracking

All features tracked in `features/INDEX.md`. Every skill reads it at start and updates it when done. Feature specs live in `features/PROJ-X-name.md`.

## Key Conventions

- **Feature IDs:** PROJ-1, PROJ-2, etc. (sequential, next: PROJ-23)
- **Commits:** `feat(PROJ-X): description`, `fix(PROJ-X): description`
- **Single Responsibility:** One feature per spec file
- **shadcn/ui first:** NEVER create custom versions of installed shadcn components
- **Human-in-the-loop:** All workflows have user approval checkpoints

## Build & Test Commands

```bash
npm run dev        # Development server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm run start      # Production server
```

## Supabase

- **Projekt:** `xqopetmpzjbxksonmhjw` (Region: eu-west-1)
- **Tabellen:** `tours` (TEXT PK, Slug-IDs), `diary_entries` (UUID PK), `photos` (UUID PK)
- **RLS:** Aktiviert — Public SELECT + INSERT (kein Auth, bewusst offen)
- **Storage:** Bucket `photos` (public, 20MB Limit)
- **Typen:** Auto-generiert in `src/lib/database.types.ts`
- **Seed-Daten:** 3 Touren (rota-vicentina-2026, dolomiten-2025, kungsleden-2024)

## Aktueller Stand

**PROJ-1 (Landing Page):** Deployed — https://die-wandervoegel.vercel.app
- Hero Section, Touren-Bereich, alle Komponenten implementiert
- Mock-Daten für 3 Touren (1 geplant, 2 archiviert)
- Schreibschrift (Caveat) für Zitat im Hero
- QA bestanden (11/11), Security Headers konfiguriert
- Vercel auto-deploy via GitHub verbunden

**PROJ-3, 4, 5, 6, 8 (Sri Lanka Test-MVP):** In Progress
- Architektur designed (Tech Design in jeder Feature-Spec)
- Supabase Backend live (Schema, RLS, Storage, API-Routes)
- Frontend steht als nächstes an (`/frontend`)
- Scope: PWA + Tagebuch + Galerie + Karte + WhatsApp Share
- Ziel: Feldtest auf iPhone in Sri Lanka (März 2026)

**Alle anderen Features (PROJ-2, 7, 9-22):** Planned — Specs vorhanden, noch nicht begonnen

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md
