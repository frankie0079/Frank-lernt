# Product Requirements Document

## Vision

**Die Wandervögel** — Eine Reisebegleiter-Plattform für unsere Wandergruppe (2-8 Teilnehmer) und ihre Follower (Familie, Freunde). Ersetzt umständliche Tools wie Komoot durch eine zentrale Plattform, die Reiseplanung, Live-Tracking, Reisetagebuch und Fotogalerie vereint.

Die erste Tour: **Rota Vicentina / Fischerpfad, Portugal — Juni 2026**.

**Zwei Kanäle, zwei Zielgruppen:**
- **Wanderer** nutzen die PWA unterwegs zum Dokumentieren (Fotos, GPS, Kommentare) und die Landing Page zur Reiseplanung und als Archiv/Galerie. Die Landing Page ist primär der Hub der Wandervögel.
- **Follower (Friends & Family)** erhalten visuell aufbereitete Updates direkt per WhatsApp — Postkarten, Fotos mit Karten-Overlay, Tagesstatistiken. Jeder WhatsApp-Post enthält einen Rück-Link zur Plattform für Follower, die mehr sehen möchten. Wanderer können ihren Familien auch direkten Zugang zur Landing Page geben.

**Zugang:** Komplett offen — kein Login, kein Account. Jeder mit dem Link kann alles sehen, kommentieren, Fotos hochladen und Inhalte erstellen.

## Target Users

### Wanderer (2-8 Teilnehmer)
- Brauchen ein einfaches Tool zum Dokumentieren unterwegs (ein Tap = Foto + GPS)
- Wollen Reiseinfos gebündelt an einem Ort (Flug, Hotel, Route)
- Oft unterwegs mit schlechtem Empfang (Offline-Modus nötig)
- Nutzen die Landing Page zur Planung und als Archiv

### Follower (Friends & Family)
- Erhalten visuelle Updates direkt in WhatsApp (Postkarten, Fotos mit Karte, Statistiken)
- Können über den Rück-Link in die Plattform eintauchen (Tagebuch, Galerie, Karte)
- Können kommentieren und interagieren
- Brauchen keinen Account — kein Login nötig

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | Landing Page — Tourenübersicht, Planung, Archiv, Galerie | Planned |
| P0 (MVP) | Reiseplanung — Flüge, Hotels, Mietwagen, Routen | Planned |
| P0 (MVP) | Reisetagebuch — Tagestouren, Kommentare, Fotos | Planned |
| P0 (MVP) | Fotogalerie | Planned |
| P0 (MVP) | PWA — GPS-Tracking, Quick-Capture, Offline-Modus | Planned |
| P0 (MVP) | Interaktive Karte — Landkarte mit Wanderer-Positionen, Foto-Fähnchen, Kommentar-Pins | Planned |
| P0 (MVP) | Tages-Statistiken — km, Höhenmeter, Gehzeit | Planned |
| P0 (MVP) | WhatsApp-Integration — Updates/Links teilen | Planned |
| P0 (MVP) | Kostenteiler — Gemeinsame Ausgaben erfassen und abrechnen (nur PWA) | Planned |
| P1 | Live-Ticker — Automatische Updates für Follower | Planned |
| P1 | Push-Benachrichtigungen | Planned |
| P1 | Tages-Zusammenfassung (auto-generiert) | Planned |
| P1 | Abstimmungen / Polls | Planned |
| P1 | Countdown vor der Reise | Planned |
| P1 | Sprach-Notizen (Audio-Kommentare) | Planned |
| P1 | Interaktive Gesamtkarte mit Foto-Pins (alle Etappen) | Planned |
| P2 | Wetter-Widget | Planned |
| P2 | Auto-Zusammenfassung nach der Reise | Planned |
| P2 | Highlight-Galerie (Voting) | Planned |
| P2 | Tour-Archiv | Planned |
| P2 | Kulinarik-Tagebuch | Planned |
| P2 | Export als PDF-Fotobuch | Planned |

## Karten-Konzept

Die Karte ist ein zentrales Element der Plattform — keine nackte Koordinatenanzeige, sondern eine **grafische Landkarte** (Mapbox oder Leaflet):
- **Wanderer-Punkte** — Echtzeit-Position der Wanderer als kleine Marker auf der Karte
- **Foto-Fähnchen** — Wo ein Foto aufgenommen wurde, erscheint ein Fähnchen. Klick/Tap zeigt das Foto
- **Kommentar-Pins** — Wo ein Kommentar geschrieben wurde, erscheint ein Pin. Klick/Tap zeigt den Kommentar
- **Gelaufene Route** — Die bereits gelaufene Strecke als farbige Linie auf der Karte
- **Geplante Route** — Die geplante Tagesetappe als gestrichelte Linie
- Die Karte muss auf Mobilgeräten (PWA) genauso gut funktionieren wie auf Desktop

## Success Metrics

- Alle Teilnehmer nutzen die PWA aktiv während der Tour
- Follower verfolgen die Tour regelmässig via PWA auf dem iPhone
- Mindestens 80% der Tagesetappen mit Fotos und Kommentaren dokumentiert
- Offline-Modus funktioniert zuverlässig auf dem Fischerpfad
- Follower kommentieren und interagieren ohne technische Hürden

## Constraints

- **Timeline:** MVP fertig bis Ende Mai 2026 (Tour startet Juni)
- **Tech Stack:** Next.js + Supabase + Vercel (PWA statt native App)
- **Karten:** Mapbox GL JS oder Leaflet + OpenStreetMap
- **Team:** 1 Entwickler + AI-Unterstützung
- **Budget:** Kostenlose Tiers von Supabase und Vercel wo möglich
- **Geräte:** iPhone (PWA) für Wanderer und Follower, Desktop als Ergänzung
- **Kein Login:** Komplett offener Zugang über geteilten Link
- **Sprache:** Deutsch mit korrekten Umlauten (ä, ö, ü) und Silbentrennung
- **Responsive:** Fluid Responsive Design — dynamische Anpassung an jede Bildschirmgrösse (keine festen Breakpoints)
- **Foto-Upload:** Ausschliesslich über mobile PWA (PWA-Kamera + Mediathek-Import), kein Desktop-Upload

## Non-Goals

- Keine native iOS/Android App (PWA ist ausreichend)
- Keine Badges / Achievements / Gamification
- Keine Spotify-Integration
- Keine Packlisten oder Checklisten pro Teilnehmer
- Keine Info-Karten (Notfallnummern etc.)
- Kein Login / Authentifizierung / Rollensystem

---

Use `/requirements` to create detailed feature specifications for each item in the roadmap above.
