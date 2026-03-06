# PROJ-6: Interaktive Karte

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-5 (PWA) — GPS-Tracking für Wanderer-Positionen
- Requires: PROJ-3 (Reisetagebuch) — Kommentar-Pins auf der Karte
- Requires: PROJ-4 (Fotogalerie) — Foto-Fähnchen auf der Karte

## User Stories
- Als Follower möchte ich auf einer grafischen Landkarte sehen, wo die Wanderer gerade sind, damit ich die Gruppe live verfolgen kann.
- Als Follower möchte ich Fähnchen auf der Karte sehen, die zeigen wo Fotos aufgenommen wurden, und bei Klick das Foto anzeigen.
- Als Follower möchte ich Pins auf der Karte sehen, die zeigen wo Kommentare geschrieben wurden, und bei Klick den Kommentar lesen.
- Als Follower möchte ich die bereits gelaufene Route als farbige Linie auf der Karte sehen, damit ich den Fortschritt erkennen kann.
- Als Follower möchte ich die geplante Tagesetappe als gestrichelte Linie sehen, damit ich weiss wohin die Gruppe heute noch geht.
- Als Besucher möchte ich die Karte zoomen und verschieben können, damit ich Details erkunden kann.

## Acceptance Criteria
- [ ] Grafische Landkarte wird angezeigt (Mapbox GL JS oder Leaflet + OpenStreetMap)
- [ ] Wanderer-Positionen als kleine animierte Marker auf der Karte (Echtzeit-Update)
- [ ] Foto-Fähnchen: Marker an GPS-Position jedes Fotos; Tap/Klick zeigt Foto-Vorschau
- [ ] Kommentar-Pins: Marker an GPS-Position jedes Kommentars; Tap/Klick zeigt Kommentartext
- [ ] Gelaufene Route als durchgezogene farbige Linie
- [ ] Geplante Route als gestrichelte Linie
- [ ] Karte ist zoombar und scrollbar (Touch-Gesten auf Mobile)
- [ ] Karte funktioniert auf iPhone genauso gut wie auf Desktop
- [ ] Legende erklärt die verschiedenen Marker-Typen
- [ ] Karte zentriert automatisch auf die aktuelle Tour-Region

## Edge Cases
- Was wenn keine GPS-Daten vorhanden sind? → Karte zeigt Portugal/Fischerpfad-Region als Default
- Was wenn sehr viele Foto-Pins vorhanden sind? → Clustering ab bestimmtem Zoom-Level
- Was wenn ein Wanderer seinen GPS nicht teilt? → Nur Wanderer mit aktivem Tracking werden angezeigt
- Was wenn die Karte offline aufgerufen wird? → Letzten bekannten Zustand aus Cache anzeigen
- Was wenn Koordinaten ausserhalb der Route liegen? → Trotzdem anzeigen, kein Filter

## Technical Requirements
- Mapbox GL JS (kostenloses Tier: 50.000 Kartenladeaufrufe/Monat) oder Leaflet + OpenStreetMap (kostenlos)
- Supabase Realtime für Live-Updates der Wanderer-Positionen
- GeoJSON für Routen-Darstellung
- Marker-Clustering für dichte Foto/Kommentar-Bereiche

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Scope: Sri Lanka Test-MVP
Karte mit Foto-Pins und Tagebuch-Markern. Keine Live-Tracking, keine Routen-Linien — kommt für Portugal.

### Component Structure
```
/touren/[id]/karte
├── Karten-Seite
│   ├── Leaflet Map (nimmt meisten Platz ein)
│   │   ├── OpenStreetMap Tiles (kostenlos, kein API-Key)
│   │   ├── Foto-Marker (kleine Thumbnail-Icons)
│   │   │   └── Tap → Popup mit Bild + Caption
│   │   ├── Tagebuch-Marker (Pin-Icons)
│   │   │   └── Tap → Popup mit Titel + Text-Ausschnitt
│   │   └── Zoom/Pan (Touch-Gesten auf Mobile)
│   ├── Legende (Foto-Marker vs. Tagebuch-Marker)
│   └── Empty State ("Noch keine GPS-Daten vorhanden")
└── Keine Eingabe-UI — Karte ist rein zum Anschauen
```

### Data Model
Keine eigene Tabelle — liest GPS-Daten aus:
- `photos` (gps_lat, gps_lng) → Foto-Marker
- `diary_entries` (gps_lat, gps_lng) → Tagebuch-Marker

### Tech Decisions
- **Leaflet + OpenStreetMap** statt Mapbox → Komplett kostenlos, kein API-Key, keine Nutzungslimits
- **react-leaflet** → React-Wrapper, deklarative Komponenten statt imperativer API
- **Dynamic Import** (next/dynamic) → Leaflet wird nur geladen wenn die Karten-Seite aktiv ist (grosses Bundle)
- **Karte zentriert automatisch** auf Bounding Box aller Marker (fitBounds)

### Dependencies
- `leaflet` — Karten-Bibliothek
- `react-leaflet` — React-Integration
- `@types/leaflet` — TypeScript-Typen

### Skipped for Sri Lanka (kommt für Portugal)
- Echtzeit Wanderer-Positionen
- Gelaufene Route als farbige Linie
- Geplante Route als gestrichelte Linie
- Marker-Clustering (bei 100+ Pins)
- Offline-Karten-Cache

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
