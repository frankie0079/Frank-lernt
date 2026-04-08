# PROJ-35: Öffentliche Event-Seite (Landing Page)

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-33 (Tages-Admin Kurations-Workflow) — veröffentlichte Tagesberichte als Inhalt
- Requires: PROJ-34 (Slideshow-Generierung) — Slideshow-MP4s werden auf dieser Seite abgespielt

## User Stories
- Als Follower möchte ich eine öffentliche URL aufrufen und alle veröffentlichten Tagesberichte sehen, ohne mich anzumelden.
- Als Follower möchte ich die Slideshow-MP4s direkt auf der Seite abspielen, damit ich den Tagesrückblick bequem konsumieren kann.
- Als Follower möchte ich auf einer Karte sehen, wo die Fotos aufgenommen wurden, um die Route nachzuverfolgen.
- Als Organisator möchte ich die öffentliche URL einfach teilen können, damit Follower schnell Zugang finden.

## Acceptance Criteria
- [ ] URL-Format: `/e/[eventSlug]` — öffentlich zugänglich, kein Login nötig
- [ ] Seite ist als Server Component implementiert (SEO-freundlich, schnelle Ladezeit)
- [ ] Header-Bereich: Event-Name (große Überschrift), Cover-Foto (Hero-Bild), Startdatum bis Enddatum, Teilnehmerzahl
- [ ] "Link teilen"-Button: Web Share API + Fallback Clipboard-Copy
- [ ] Tagesberichte als Karten: Datum, Tages-Titel (Agenda-Punkt-Name), Slideshow-MP4-Player, Anzahl Beiträge
- [ ] Slideshow-Player: natives `<video>` Element mit `controls`, `playsInline`, Poster-Bild (erster Foto-Frame)
- [ ] Unter dem Video: Galerie der kuratierten Fotos (Thumbnail-Grid, Lightbox bei Tap)
- [ ] Karte (Leaflet + OpenStreetMap): GPS-Marker aller veröffentlichten Fotos mit GPS-Koordinaten
- [ ] Karte erscheint nur wenn mindestens 1 Foto mit GPS-Koordinaten vorhanden
- [ ] Marker-Popup: Thumbnail-Vorschau + Autoren-Name + Tages-Titel
- [ ] Nur `published` Tagesberichte werden angezeigt (draft-Berichte unsichtbar)
- [ ] Tagesberichte chronologisch sortiert (älteste zuerst für narrative Lesbarkeit)
- [ ] OG Meta Tags für WhatsApp-Linkvorschau: `og:title` (Event-Name), `og:image` (Cover-Foto), `og:description` (Beschreibung + Datum), `og:url`

## Edge Cases
- Kein veröffentlichter Tagesbericht → Empty State: "Noch nichts veröffentlicht — schau bald wieder vorbei!" + Event-Cover-Foto als Hintergrund
- Event noch nicht gestartet (Startdatum in der Zukunft) → "Startet am [Datum]" mit Countdown-Timer (Client Component)
- Event archiviert → Alle veröffentlichten Inhalte sichtbar, kein Status-Banner ("archiviert" wird nicht kommuniziert)
- Karte ohne GPS-Fotos → Karten-Sektion wird vollständig ausgeblendet (kein leeres Leaflet-Widget)
- Slideshow-Video-URL nicht verfügbar (noch nicht generiert, Storage-Fehler) → Tagesbericht ohne Video-Player, nur Foto-Galerie + Hinweis "Slideshow in Kürze verfügbar"
- Event-Slug nicht gefunden → 404-Seite mit freundlichem Text "Event nicht gefunden — vielleicht wurde die URL falsch kopiert?"
- Cover-Foto nicht ladbar → CSS-Gradient-Fallback (Teal → Amber)
- Sehr viele Tagesberichte (30 Tage, 30 Berichte) → Lazy Loading der Videos (`loading="lazy"` auf `<video>`) + Intersection Observer
- Bot/Crawler ruft Seite auf → Vollständig SSR-gerendert, alle Inhalte indexierbar (Meta Tags korrekt gesetzt)
- WhatsApp teilt Link → OG-Vorschau zeigt Cover-Foto + Event-Name korrekt

## Technical Requirements
- Next.js Route: `src/app/e/[slug]/page.tsx` als Server Component
- `generateMetadata()` für dynamische OG Meta Tags (Cover-Foto via Supabase Storage URL)
- Supabase Query: Event per Slug laden → Agenda-Items → published `daily_reports` → `report_items` mit `content_items` JOIN
- RLS: `daily_reports` WHERE `status = 'published'` für öffentliche SELECT
- Leaflet: Dynamic Import (`next/dynamic`, SSR disabled) für Karten-Komponente
- GPS-Daten: `content_items.latitude` + `content_items.longitude` für Marker
- `unstable_cache` für öffentliche Event-Daten (5 Minuten Revalidierung, da Follower-Traffic)
- `next/image` für Cover-Foto + Thumbnails (Supabase Storage domain in `next.config.ts` remotePatterns)
- Countdown-Timer: Client Component (`'use client'`) eingebettet in Server-Component-Seite
- OpenGraph-Bild: Supabase Storage URL des Cover-Fotos (öffentlich, HTTPS)

---

## Tech Design (Solution Architect)

### Übersicht

Eine vollständig öffentlich zugängliche Seite (kein Login, kein Token) unter `/e/[slug]`. Sie wird Server-Side gerendert für SEO und WhatsApp-Linkvorschau. Follower sehen veröffentlichte Tagesberichte mit Slideshow-Videos, Foto-Galerie und einer GPS-Karte — alles in einer langen Scroll-Seite.

---

### Komponenten-Struktur

```
/e/[slug]/page.tsx  ← Server Component (SSR, generateMetadata)
│
├── PublicEventHeader           (neu)
│   ├── Hero-Bild (Cover-Foto, next/image)
│   ├── Event-Name + Zeitraum + Teilnehmerzahl
│   └── ShareButton             (WIEDERVERWENDET: share-button.tsx)
│
├── CountdownBanner             (neu, Client Component)
│   └── Wird nur gerendert wenn Startdatum in Zukunft liegt
│
├── EmptyState                  (shadcn Card)
│   └── Wird gerendert wenn keine published Berichte vorhanden
│
├── [für jeden published Tagesbericht, älteste zuerst]
│   └── PublicDayReportCard     (neu)
│       ├── Datum + Tages-Titel (Agenda-Punkt-Name)
│       ├── SlideshowVideoPlayer (natives <video>, nur wenn URL vorhanden)
│       ├── PublicPhotoGallery   (neu)
│       │   └── Thumbnail-Grid → ContentLightbox (WIEDERVERWENDET: content-lightbox.tsx)
│       └── Anzahl Beiträge (Badge)
│
└── PublicEventMap              (neu, Client Component — dynamic import, SSR disabled)
    ├── Leaflet MapContainer + OpenStreetMap Tiles
    ├── GPS-Marker pro Foto mit Koordinaten
    └── Marker-Popup: Thumbnail + Autoren-Name + Tages-Titel
        (Karten-Sektion vollständig ausgeblendet wenn keine GPS-Fotos)
```

---

### Datenfluss

**Kein API-Endpunkt nötig** — die Server Component liest direkt von Supabase:

```
1. Event per slug laden → Name, Cover, Startdatum, Enddatum
2. Teilnehmerzahl zählen (event_members)
3. published daily_reports laden (status = 'published'), sortiert nach Datum aufsteigend
4. Pro Bericht: report_items → content_items (media_url, thumbnail_url, latitude, longitude, Autor)
5. Agenda-Items für Tages-Titel laden
```

Gecacht mit `unstable_cache` (5 Minuten) — Follower-Traffic schlägt nicht direkt auf die DB durch.

---

### Datenmodell (was gelesen wird)

| Was | Woher | Wofür |
|-----|-------|-------|
| Event-Name, Cover-URL, Startdatum, Enddatum, Slug | `events` | Header, Meta Tags |
| Teilnehmerzahl | `event_members` (COUNT) | Header-Info |
| Veröffentlichte Tagesberichte | `daily_reports` WHERE status='published' | Bericht-Karten |
| Tages-Titel | `agenda_items` | Tages-Überschrift |
| Kuratierte Inhalte | `report_items` → `content_items` | Videos, Fotos, GPS |
| Autoren-Namen | `members` (name, avatar_url) | Karten-Popups |

---

### Neue Datenbank-Policies (Migration erforderlich)

Aktuell haben alle Tabellen RLS-Policies, die eine Mitgliedschaft erfordern. Für die öffentliche Seite brauchen wir **anon-lesbare Policies** — eingeschränkt auf veröffentlichte Daten:

| Tabelle | Policy |
|---------|--------|
| `events` | Anon SELECT per Slug (öffentlich zugänglich) |
| `agenda_items` | Anon SELECT für Events mit veröffentlichten Berichten |
| `daily_reports` | Anon SELECT nur WHERE status = 'published' |
| `report_items` | Anon SELECT über published daily_reports |
| `content_items` | Anon SELECT über report_items (kuratierte Inhalte) |
| `members` | Anon SELECT nur name + avatar_url (keine Tokens!) |
| `event_members` | Anon SELECT nur COUNT (für Teilnehmerzahl) |

→ **Eine neue Migration:** `20260408_public_event_rls.sql`

---

### Tech-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Server Component mit `generateMetadata()` | WhatsApp und Suchmaschinen brauchen SSR für OG-Tags; Client-Side-Rendering würde die Vorschau brechen |
| `unstable_cache` (5 Min) | Öffentliche Seite hat potenziell viel Traffic; DB-Abfragen sollen nicht bei jedem Page Load laufen |
| Leaflet dynamic import (SSR disabled) | Leaflet braucht `window` — läuft nicht auf dem Server. Dynamic Import mit SSR=false ist der Standard-Ansatz in Next.js |
| Natives `<video>` statt Custom Player | Einfacher, barrierefreier, keine zusätzliche Abhängigkeit. `controls` + `playsInline` reicht für Mobile |
| `content-lightbox.tsx` wiederverwenden | Bereits in PROJ-28 gebaut und getestet — kein doppelter Code |
| `share-button.tsx` wiederverwenden | Bereits in PROJ-34 gebaut (Web Share API + Clipboard-Fallback) |
| Gradient-Fallback für Cover-Foto | Keine leere weiße Seite wenn Bild fehlt — Teal→Amber als Brand-Farben |

---

### Neue Pakete

Keine neuen npm-Pakete nötig — Leaflet + react-leaflet sind laut CLAUDE.md bereits im Stack, `next/dynamic` ist in Next.js eingebaut.

> Prüfen vor `/frontend`: `npm ls react-leaflet leaflet` — falls nicht installiert, dann `npm install leaflet react-leaflet @types/leaflet`

---

### Neue Dateien (Übersicht)

| Datei | Typ |
|-------|-----|
| `src/app/e/[slug]/page.tsx` | Server Component (Haupt-Seite) |
| `src/components/public-event-header.tsx` | Server Component |
| `src/components/public-day-report-card.tsx` | Server Component |
| `src/components/public-photo-gallery.tsx` | Client Component (Lightbox-Integration) |
| `src/components/public-event-map.tsx` | Client Component (Leaflet, dynamic import) |
| `src/components/public-countdown.tsx` | Client Component (Timer) |
| `supabase/migrations/20260408_public_event_rls.sql` | Migration |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
