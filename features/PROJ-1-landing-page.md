# PROJ-1: Landing Page

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
