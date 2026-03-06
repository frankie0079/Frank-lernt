# PROJ-1: Landing Page

## Status: Deployed
**Created:** 2026-02-28
**Last Updated:** 2026-03-06

## Dependencies
- None (Fundament für alle anderen Features)

## User Stories
- Als Besucher möchte ich auf der Landing Page sofort sehen, worum es bei "Die Wandervögel" geht, damit ich verstehe was diese Plattform ist.
- Als Besucher möchte ich die aktuelle Tour (Rota Vicentina) prominent sehen, damit ich direkt in die Tourinhalte einsteigen kann.
- Als Wanderer möchte ich über die Landing Page zu allen Bereichen navigieren (Planung, Tagebuch, Galerie, Karte), damit ich schnell finde was ich brauche.
- Als Follower möchte ich auf der Landing Page den aktuellen Status der Tour sehen (läuft gerade, Etappe X), damit ich sofort informiert bin.
- Als Besucher möchte ich vergangene Touren als Archiv sehen, damit ich alte Erlebnisse nachstöbern kann.

## Layout-Konzept (Touren-Bereich)
```
┌──────────────────┬────────────┬────────────┬──────┐
│                  │            │            │      │
│  Nächste Tour    │ Vergangene │ Vergangene │ Mehr │
│  ROTA VICENTINA  │  Tour 1    │  Tour 2    │  →   │
│  (gross, prominent) │ (kleiner)  │ (kleiner)  │      │
│                  │            │            │      │
└──────────────────┴────────────┴────────────┴──────┘
```

## Acceptance Criteria
- [ ] Hero-Bereich zeigt Logo "Die Wandervögel" (Logo_Wandervoegel.JPG) mit aktuellem Tour-Status (z.B. "Unterwegs auf Etappe 3")
- [ ] Navigation der nächsten/aktiven Tour führt zu: Reiseplanung, Tagebuch, Galerie, Karte
- [ ] Navigation vergangener Touren führt nur zu: Tagebuch, Galerie, Karte (keine Planung)
- [ ] Touren-Bereich: Nächste/aktuelle Tour gross links, 2-3 vergangene Touren kleiner daneben, "Weitere"-Button ganz rechts
- [ ] Nächste Tour zeigt: Tourname, Zeitraum, Teilnehmerzahl, Strecke (km), Cover-Foto, Status
- [ ] Vergangene Touren zeigen: Tourname, Datum, Cover-Foto (kompakte Karten)
- [ ] "Weitere"-Button führt zum Tour-Archiv (PROJ-19)
- [ ] Fluid Responsive Design — dynamische Anpassung an jede Bildschirmgrösse (relative Einheiten, CSS Container Queries, Flexbox/Grid)
- [ ] Auf Mobile: Touren untereinander statt nebeneinander (nächste Tour oben, vergangene darunter)
- [ ] Ladezeit unter 3 Sekunden
- [ ] Seite funktioniert ohne Login — öffentlich zugänglich

## Edge Cases
- Was passiert, wenn noch keine Tour aktiv ist? → Zeige "Nächste Tour: Rota Vicentina, Juni 2026" mit Countdown
- Was wenn die Seite offline aufgerufen wird? → Letzten bekannten Stand aus Cache anzeigen
- Was wenn keine vergangenen Touren vorhanden sind? → Leerer Archiv-Bereich mit Platzhaltertext

## Technical Requirements
- Performance: Largest Contentful Paint < 2.5s
- Fluid Responsive Design (keine festen Breakpoints, dynamische Anpassung)
- Sprache: Deutsch mit korrekter Silbentrennung (CSS hyphens) und Umlauten (ä, ö, ü)
- PWA-fähig (wird in PROJ-5 ausgebaut)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur
```
app/page.tsx  (Server Component — lädt Tour-Daten serverseitig)
│
├── HeroSection
│   ├── Logo (Logo_Wandervoegel.JPG, Next.js Image)
│   └── TourStatusBadge  ("Unterwegs auf Etappe 3" | "Startet in X Tagen" | "—")
│
└── TourenBereich
    ├── AktiveTourKarte  (große, prominente Karte links)
    │   ├── Cover-Foto (vollflächig im Hintergrund)
    │   ├── TourMeta  (Name, Zeitraum, km, Teilnehmerzahl)
    │   └── TourNavigation  (Links: Planung · Tagebuch · Galerie · Karte)
    │
    ├── VergangeneTouren  (horizontale Reihe, 2–3 kompakte Karten)
    │   └── TourKompaktKarte  × n  (Name, Datum, Cover-Foto)
    │       └── TourNavigation  (nur: Tagebuch · Galerie · Karte)
    │
    └── "Weitere Touren →"  Button  (→ PROJ-19 Archiv)
```

Mobile-Ansicht: TourenBereich klappt vertikal — aktive Tour oben, vergangene Touren darunter gestapelt.

### Datenmodell (Supabase — `tours` Tabelle)
```
Jede Tour hat:
  id              — Eindeutige ID
  name            — Tourname  ("Rota Vicentina 2026")
  subtitle        — Untertitel  ("Fischerpfad, Portugal")
  start_date      — Startdatum
  end_date        — Enddatum
  status          — "planned" | "active" | "archived"
  cover_photo_url — URL zum Cover-Foto (Supabase Storage)
  total_km        — Gesamtstrecke in km
  participants    — Anzahl Teilnehmer
  current_stage   — Aktuelle Etappe, nur bei Status "active"  ("Etappe 3")
  description     — Kurzbeschreibung
```

Die Landing Page braucht nur Lese-Zugriff — kein Login, öffentlich.

### Tech-Entscheidungen

| Entscheidung | Warum |
|---|---|
| Server Component für die Hauptseite | Tour-Daten werden beim Seitenaufruf direkt vom Server geladen → schnelle LCP < 2.5s, kein Ladespinner |
| Supabase als Datenbank | Tour-Daten müssen nur einmal erfasst werden und sind dann für alle sichtbar |
| Next.js Image für Fotos | Automatische Bildoptimierung (WebP, lazy loading) ohne Konfiguration |
| CSS Container Queries + Flexbox | Fluid Responsive ohne feste Breakpoints — Layout passt sich dynamisch an jeden Container an |
| `hyphens: auto` + `lang="de"` am HTML-Element | Browser trennt deutsche Wörter automatisch korrekt |
| Keine Client-Komponenten auf der Landing Page | Bessere Performance, kein JavaScript für reines Layout nötig |

### URL-Struktur (Grundlage für spätere Features)
```
/                          Landing Page  (PROJ-1)
/touren/[id]/planung       Reiseplanung  (PROJ-2, nur aktive Tour)
/touren/[id]/tagebuch      Reisetagebuch  (PROJ-3)
/touren/[id]/galerie       Fotogalerie  (PROJ-4)
/touren/[id]/karte         Interaktive Karte  (PROJ-6)
/archiv                    Tour-Archiv  (PROJ-19)
```

### Pakete
Keine neuen Pakete nötig — `@supabase/supabase-js` und Next.js sind bereits im Template enthalten.

### Abgrenzung
- Countdown → PROJ-13
- Live-Status-Update (Realtime) → PROJ-9
- Foto-Upload → PROJ-4/PROJ-5
- Vollständige Archiv-Seite → PROJ-19

## QA Test Results

**Date:** 2026-03-06 | **Result:** PASS (all bugs fixed)

### Build & Lint
- `npm run build`: PASS (static generation, TypeScript clean)
- `npm run lint`: PASS (only pre-existing shadcn/ui sidebar.tsx warning)

### Acceptance Criteria (11/11 PASS)
- [x] Hero zeigt Logo + Tour-Status Badge
- [x] Navigation aktive Tour: Planung, Tagebuch, Galerie, Karte
- [x] Navigation vergangene Touren: nur Tagebuch, Galerie, Karte
- [x] Layout: Aktive Tour gross links, 2-3 vergangene daneben
- [x] Aktive Tour: Name, Zeitraum, Teilnehmer, km, Foto, Status
- [x] Vergangene Touren: Name, Datum, Cover-Foto
- [x] "Weitere"-Button zum Archiv
- [x] Responsive Design (Grid-Fallback 1 Spalte auf Mobile)
- [x] Mobile: Touren untereinander
- [x] Ladezeit < 3s (statisch generiert)
- [x] Öffentlich ohne Login

### Bugs Found & Fixed
| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| B1 | MEDIUM | TourStatusBadge definiert aber nicht in Hero eingebunden | Badge in HeroSection eingefügt |
| B2 | MEDIUM | ESLint broken (`.eslintrc.json` inkompatibel mit ESLint 9) | Migration zu `eslint.config.mjs` + `package.json` lint-Script |
| I1 | LOW | `aria-label` auf `<nav>` fehlte | `aria-label` auf TourNavigation hinzugefügt |

### Security
- Keine Secrets im Code, `.env.local` korrekt in `.gitignore`
- Keine User-Inputs (read-only Landing Page)
- Kein XSS-Risiko (React escaping, kein dangerouslySetInnerHTML)

## Deployment

**Date:** 2026-03-06
**Production URL:** https://die-wandervoegel.vercel.app
**Platform:** Vercel (auto-deploy from GitHub on push to main)
**Security Headers:** X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS
