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

## Acceptance Criteria
- [ ] Hero-Bereich zeigt Titel "Die Wandervögel" mit aktuellem Tour-Status (z.B. "Unterwegs auf Etappe 3")
- [ ] Navigation führt zu: Reiseplanung, Tagebuch, Galerie, Karte
- [ ] Aktuelle Tour wird prominent hervorgehoben (Rota Vicentina)
- [ ] Seite ist vollständig responsiv (Mobile 375px, Tablet 768px, Desktop 1440px)
- [ ] Ladezeit unter 3 Sekunden
- [ ] Seite funktioniert ohne Login — öffentlich zugänglich
- [ ] Tour-Übersicht zeigt: Tourname, Zeitraum, Teilnehmerzahl, Strecke (km)

## Edge Cases
- Was passiert, wenn noch keine Tour aktiv ist? → Zeige "Nächste Tour: Rota Vicentina, Juni 2026" mit Countdown
- Was wenn die Seite offline aufgerufen wird? → Letzten bekannten Stand aus Cache anzeigen
- Was wenn keine vergangenen Touren vorhanden sind? → Leerer Archiv-Bereich mit Platzhaltertext

## Technical Requirements
- Performance: Largest Contentful Paint < 2.5s
- Mobile-first Design
- PWA-fähig (wird in PROJ-5 ausgebaut)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
