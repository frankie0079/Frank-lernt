# Die Wandervögel — Reisebegleiter-Plattform

> Eine Plattform für unsere Wandergruppe (2-8 Teilnehmer) und ihre Follower. Ersetzt umständliche Tools durch zentrale Reiseplanung, Live-Tracking, Reisetagebuch und Fotogalerie. Erste Tour: Rota Vicentina / Fischerpfad, Portugal — Juni 2026.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (copy-paste components)
- **Fonts:** Caveat (Google Font, Handschrift) via `next/font/google` — CSS-Variable `--font-caveat`
- **Backend:** Supabase (PostgreSQL + Auth + Storage) - noch nicht angebunden, aktuell Mock-Daten
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
  components/
    ui/                 shadcn/ui components (NEVER recreate these)
    hero-section.tsx    Hero mit Logo, Titel, handgeschriebenem Zitat
    touren-bereich.tsx  Touren-Übersicht (aktive + vergangene)
    aktive-tour-karte.tsx   Große Karte für aktive/nächste Tour
    tour-kompakt-karte.tsx  Kompakte Karte für vergangene Touren
    tour-navigation.tsx     Navigation (Planung/Tagebuch/Galerie/Karte)
  hooks/                Custom React hooks
  lib/
    types.ts            Tour-Interface (Datenmodell)
    mock-data.ts        Mock-Touren (Rota Vicentina + 2 vergangene)
    supabase.ts         Supabase Client (noch nicht aktiv genutzt)
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
- **Mock-Daten statt Supabase:** Bis Backend angebunden wird, liegen Tour-Daten in `mock-data.ts`

## URL-Struktur

```
/                          Landing Page (PROJ-1)
/touren/[id]/planung       Reiseplanung (PROJ-2, nur aktive Tour)
/touren/[id]/tagebuch      Reisetagebuch (PROJ-3)
/touren/[id]/galerie       Fotogalerie (PROJ-4)
/touren/[id]/karte         Interaktive Karte (PROJ-6)
/archiv                    Tour-Archiv (PROJ-19)
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

## Aktueller Stand

**PROJ-1 (Landing Page):** Deployed — https://die-wandervoegel.vercel.app
- Hero Section, Touren-Bereich, alle Komponenten implementiert
- Mock-Daten für 3 Touren (1 geplant, 2 archiviert)
- Schreibschrift (Caveat) für Zitat im Hero
- QA bestanden (11/11), Security Headers konfiguriert
- Vercel auto-deploy via GitHub verbunden

**Alle anderen Features (PROJ-2 bis PROJ-22):** Planned — Specs vorhanden, noch nicht begonnen

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md
