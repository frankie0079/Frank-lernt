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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
