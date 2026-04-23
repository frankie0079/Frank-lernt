# Product Requirements Document

## Vision

**EventDocs** — Eine kollaborative Event-Dokumentations-Plattform für Gruppen von 5–50 Personen. Teilnehmer erstellen während des Events gemeinsam multimodalen Content (Fotos, Videos, Sprachmemos, Texte) in Echtzeit. Ein täglicher Admin kuratiert daraus eine Slideshow, die per WhatsApp geteilt wird. Nach dem Event entsteht ein digitales Tagebuch mit PDF-Export für den Fotobuch-Druck.

Erste Anwendung: Wandergruppen und Reise-Events.

## Zwei Bereiche

**PWA (Mobile)** = Eingabe-Instrument während des Events
- Erzeugt Content in Echtzeit (Foto, Video, Text, Sprachmemo)
- Content-Pool für alle Teilnehmer sichtbar (Realtime)
- Tages-Admin kuratiert täglich eine Slideshow
- WhatsApp-Export der Slideshow (iOS Share Sheet)
- Mobile-first, iPhone-optimiert

**Landing Page (Desktop & Mobile)** = digitales Langzeit-Tagebuch
- Veröffentlichte Tagesberichte öffentlich sichtbar
- Kuratierbares Post-Event Tagebuch
- PDF-Export für Fotobuch-Druck
- Dauerhaft abrufbar

## Target Users

### Organisator (1 pro Event)
- Erstellt das Event, lädt Teilnehmer ein
- Legt Agenda und tägliche Admins fest
- Hat Vollzugriff auf alle Inhalte

### Tages-Admin (1 pro Tag, rotiert)
- Kuratiert täglich den Content-Pool
- Generiert und versendet die Tages-Slideshow
- Entscheidet was auf die Landing Page kommt

### Teilnehmer (5–50 pro Event)
- Dokumentiert das Event mit Foto, Video, Text, Sprachmemo
- Reagiert auf Beiträge anderer (Emojis, Kommentare)
- Lädt sich nach dem Event das PDF-Tagebuch herunter

### Follower (Friends & Family)
- Besuchen die öffentliche Event-Seite
- Sehen Tagesberichte + Slideshows
- Erhalten WhatsApp-Updates vom Tages-Admin

## Core Features (Roadmap)

| Priority | Feature | Status | ID |
|----------|---------|--------|-----|
| P0 (MVP) | Auth & User-Accounts | Planned | PROJ-24 |
| P0 (MVP) | Event-Erstellung & -Verwaltung | Planned | PROJ-25 |
| P0 (MVP) | Teilnehmer-Einladung | Planned | PROJ-26 |
| P0 (MVP) | Wanderer-Screen (Eingabe) | Planned | PROJ-27 |
| P0 (MVP) | Content-Pool (Realtime-Karteikarten) | Planned | PROJ-28 |
| P0 (MVP) | Video-Aufnahme (bis 90s) | Planned | PROJ-29 |
| P0 (MVP) | Sprachmemo + Transkription | Planned | PROJ-30 |
| P1 | Likes & Emoji-Reactions | Planned | PROJ-31 |
| P1 | Kommentar-Threads | Planned | PROJ-32 |
| P1 | Tages-Admin Kurations-Workflow | Planned | PROJ-33 |
| P1 | Slideshow-Generierung & WhatsApp-Export | Planned | PROJ-34 |
| P1 | Öffentliche Event-Seite | Planned | PROJ-35 |
| P2 | Post-Event Tagebuch | Planned | PROJ-36 |
| P2 | PDF-Export (Fotobuch-Druck) | Planned | PROJ-37 |
| P2 | Upload-SHA-256-Dedup | Planned | PROJ-39 |
| P2 | Event-Countdown | Planned | PROJ-40 |

## Success Metrics

- Alle Teilnehmer nutzen die PWA aktiv während des Events
- Täglich wird eine Slideshow generiert und per WhatsApp geteilt
- Follower besuchen die öffentliche Event-Seite
- Nach dem Event wird das Tagebuch als PDF heruntergeladen

## Technical Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Auth + PostgreSQL + Storage + Realtime)
- **PWA:** Serwist (Service Worker, Offline)
- **Karten:** Leaflet + OpenStreetMap
- **Slideshow:** Canvas API + MediaRecorder (client-side, kostenlos)
- **Transkription:** Web Speech API (kostenlos, Browser-nativ)
- **PDF:** @react-pdf/renderer (client-side)
- **Deployment:** Vercel

## Constraints

- **Authentifizierung:** Supabase Auth (Magic Link)
- **Kosten:** Free Tiers wo möglich (Supabase, Vercel)
- **Bezahlte APIs nur sparsam:** Claude Haiku als LLM-Cutter für Slideshow-Storyboards in PROJ-34 (~$0.02 pro Film). Kein TTS, kein AI-Video-Gen, kein Whisper. Web Speech API für Transkription, Canvas + MediaRecorder statt Remotion Lambda.
- **Gruppe:** 5–50 Personen pro Event
- **Geräte:** iPhone PWA (Hauptgerät), Desktop als Ergänzung
- **Offline:** PWA Background Sync für Content-Uploads

## Non-Goals

- Keine native iOS/Android App (PWA ausreichend)
- Kein echtes Video-Editing (nur einfache Slideshow)
- Kein Livestreaming
- Keine Bezahlfunktionen
- Keine öffentliche Registrierung (Einladung durch Organisator)
- Kein automatisches KI-Kuratieren (manuell durch Admin)

---

## Legacy (v1 — Wandervögel)

Die ursprüngliche anonyme Wandertagebuch-App (PROJ-1 bis PROJ-23) wurde durch diese neue Vision ersetzt. Der Tech-Stack (Next.js, Supabase, shadcn/ui) und wiederverwendbare Komponenten (Foto-Pipeline, Leaflet-Karte, PWA-Basis, Share-Button) fließen in die neue App ein.
