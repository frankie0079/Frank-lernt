# EventDocs — Kollaborative Event-Dokumentations-Plattform

> Gruppen von 5–50 Personen dokumentieren Events gemeinsam in Echtzeit (Fotos, Videos, Sprachmemos, Texte). Ein täglicher Admin kuratiert daraus eine Slideshow für WhatsApp. Nach dem Event: digitales Tagebuch + PDF-Export.

## Zwei Bereiche

- **PWA (Mobile)** = Eingabe-Instrument während des Events (Echtzeit, iPhone-first)
- **Landing Page (Desktop+Mobile)** = digitales Langzeit-Tagebuch, öffentlich, PDF-Export

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (35 Komponenten installiert)
- **Backend:** Supabase (Auth + PostgreSQL + Storage + Realtime)
- **Deployment:** Vercel (auto-deploy via GitHub)
- **PWA:** Serwist (Service Worker, App-Shell Caching)
- **Karten:** Leaflet + react-leaflet + OpenStreetMap (kostenlos)
- **Foto-Verarbeitung:** browser-image-compression + exifr (EXIF)
- **Video:** Datei-Upload aus der Handy-Mediathek; keine In-App-Kameraaufnahme mehr seit PROJ-42
- **Transkription:** Web Speech API (kostenlos, Browser-nativ)
- **Slideshow:** Canvas API + MediaRecorder (client-side MP4/WebM)
- **PDF:** @react-pdf/renderer (client-side)
- **Validation:** Zod + react-hook-form
- **Auth:** Token-basierte Links (kein Supabase Auth, kein Login nötig)

## Architektur-Entscheidungen (v2)

- **Token-Links statt Login:** Organisator erstellt Mitglieder, jeder bekommt einen persönlichen Link per WhatsApp. Kein Passwort, keine E-Mail, kein Supabase Auth.
- **Events statt Tours:** Neues Datenmodell mit Events, Agenda, Teilnehmer, Content-Pool
- **Kostenlos:** Web Speech API statt Whisper, Canvas+MediaRecorder statt Remotion, manuelles Kuratieren statt Claude API
- **Client-side Rendering:** Slideshow + PDF werden im Browser generiert (kein Server nötig)
- **Supabase Realtime:** Content-Pool synchronisiert live zwischen allen Geräten
- **Turbopack inkompatibel:** Serwist erfordert `--webpack` Flag in dev/build Scripts

## v2 Datenmodell (geplant)

```
members (id, name, token, role: organizer|admin|member, avatar_url, created_at, updated_at) ← LIVE
events (id, name, description, cover_photo, dates, created_by) ← geplant
event_members (event_id, member_id, role) ← geplant
agenda_items (event_id, title, date, daily_admin_id, sort_order)
content_items (event_id, agenda_item_id, author_id, type: photo|video|text|voice, media_url, transcript, gps)
reactions (content_item_id, member_id, emoji)
comments (content_item_id, author_id, text)
daily_reports (event_id, agenda_item_id, curated_by, selected_content_ids, slideshow_url, status)
```

## v2 URL-Struktur (geplant)

```
/login                     Info-Seite ("Du brauchst einen Link")
/join/[token]              Persönlicher Link → Cookie → /events
/events                    Meine Events (geschützt)
/events/new                Event erstellen (geschützt)
/events/[id]               Event-Dashboard (geschützt)
/events/[id]/capture       Wanderer-Screen — 4 Buttons (geschützt)
/events/[id]/pool          Content-Pool — Karteikarten (geschützt)
/events/[id]/admin         Tages-Admin Workflow (geschützt)
/events/[id]/book          Post-Event Tagebuch (geschützt)
/profile                   Profil bearbeiten (Name + Avatar)
/e/[slug]                  Öffentliche Event-Seite (kein Login)

API:
/api/members               GET (Liste) + POST (Mitglied anlegen, nur Organisator)
/api/events                CRUD Events
/api/events/[id]/content   CRUD Content-Items
/api/events/[id]/reports   CRUD Daily Reports
```

## Development Workflow

1. `/requirements` — Feature-Spec schreiben ✅ (14 Specs: PROJ-24 bis PROJ-37)
2. `/architecture` — Tech-Design (PM-friendly, kein Code)
3. `/frontend` — UI-Komponenten (shadcn/ui first!)
4. `/backend` — APIs, DB-Schema, RLS Policies
5. `/qa` — Tests gegen Acceptance Criteria + Security Audit
6. `/deploy` — Vercel + Production-Ready Checks

## Feature Tracking

Alle Features in `features/INDEX.md`. Features: PROJ-24 bis PROJ-44. v1 (PROJ-1–23) wurde gelöscht.

## Key Conventions

- **Feature IDs:** PROJ-24+ (v2), Next: PROJ-45
- **Commits:** `feat(PROJ-X): description`, `fix(PROJ-X): description`
- **Single Responsibility:** One feature per spec file
- **shadcn/ui first:** NEVER create custom versions of installed shadcn components
- **Human-in-the-loop:** All workflows have user approval checkpoints
- **QA: Fix ALL bugs before deploy:** Always fix all QA bugs (including Low severity) before proceeding to deploy. Never skip or defer bugs to "next sprint".
- **Schema only via Migration:** NEVER create tables, columns, indexes, RLS policies or storage buckets manually in the Supabase Dashboard. Every schema change MUST be a SQL file in `supabase/migrations/`, committed to git, and applied via SQL Editor. Manual dashboard changes caused 4 critical production outages on 2026-04-06.
- **"Deployed" requires Production verification:** A feature may only be marked `Deployed` after at least one happy-path action has succeeded against the live Vercel URL — not just localhost. The `/qa` skill enforces this.
- **CLAUDE.md states only verified facts:** Never claim "live" / "Deployed" without verifying via REST introspection or an actual API call against production.

## Build & Test Commands

```bash
npm run dev        # Development server (localhost:3000) — nutzt --webpack wegen Serwist
npm run build      # Production build — nutzt --webpack wegen Serwist
npm run lint       # ESLint
npm run start      # Production server
```

## Supabase

- **Projekt:** `xqopetmpzjbxksonmhjw` (Region: eu-west-1)
- **Tabellen (geplant):** `agenda_items`, `content_items`, `reactions`, `comments`, `daily_reports`
- **Auth:** Token-basierte Links (kein Supabase Auth)
- **Tabellen (live):** `members` (Token-Auth, RLS enabled), `events` (RLS enabled), `event_members`, `invitations`, `content_items` (RLS enabled)
- **Storage Buckets (live):** `media` (public, 20MB, alle photo/video/audio MIME-Types), `avatars` (public, 2MB, JPEG/PNG/WebP), `covers` (public, 5MB, JPEG/PNG/WebP) — angelegt via `20260406_storage_buckets.sql`. `slideshows` (public, 50MB, video/webm + video/mp4 + application/zip) — angelegt via `20260407_slideshow.sql` (PROJ-34, applies after migration).
- **Env Vars (server):** `ANTHROPIC_API_KEY` für Claude Haiku Storyboard-Generierung in PROJ-34, `SUPABASE_SERVICE_ROLE_KEY` für alle Server-Routes (seit PROJ-35 BUG-1 Lockdown zwingend erforderlich)
- **Env Vars (public):** `NEXT_PUBLIC_SITE_URL=https://frank-lernt.vercel.app` für kanonische OG-URLs (seit PROJ-35)

## Aktueller Stand

### Deployed (Production)
- **PROJ-24: Auth & User-Accounts** — QA Round 4 passed (14/14 AC, 0 bugs). 2026-04-16: Login-Cookie von 30 Tagen auf 1 Jahr verlängert (iPhone-Tippen ist mühsam). 2026-04-21: auf 3 Jahre erhöht (Frank will selten re-loggen, auch Folge-Events bleiben im selben Cookie-Fenster).
- **PROJ-25: Event-Erstellung** — Deployed 2026-04-06 (BUG-R2-1 deferred to PROJ-33). 2026-04-13: Cover-URL-Validierung gefixt (akzeptiert jetzt alle Supabase-URLs), Abbrechen-Button im Edit-Sheet, Auto-Focus/Autofill auf Event-Name deaktiviert.
- **PROJ-26: Teilnehmer-Einladung** — Deployed 2026-04-06, QA Round 6 in Production passed (Migration `20260406_event_members_id_column.sql` angewendet, Schema-Drift behoben, BUG-3 Error-Sanitization gefixt). **2026-04-22: Einladungs-Sackgasse gefixt** — `/invite/[token]` leitete bisher nicht-eingeloggte Empfänger auf `/login` um, wo sie die nutzlose Meldung „Du brauchst einen Link vom Organisator" sahen (obwohl sie gerade einen hatten). Jetzt: Server gibt bei `POST /api/invite/[token]` ohne Cookie `400 name_required` zurück, Client zeigt kleine Name-Form, Server erzeugt neuen Member mit Zufalls-Token, setzt 3-Jahre-Cookie, fügt via `join_event` RPC zum Event hinzu, Redirect ins Event. Ein Link → ein Formular-Feld → drin. E2E mit Frank + Sohn Julius (HK) bestätigt.
- **PROJ-27: Wanderer-Screen** — Deployed, QA passed. 2026-04-13: Camera-Permissions-Check entfernt (blockierte iOS Safari), `capture="environment"` für direkten Kamerazugriff wiederhergestellt.
- **PROJ-28: Content-Pool** — Deployed, QA passed. 2026-04-13: Bulk-Upload (Multi-Select + Fortschrittsbalken), `caption: null` Validierung gefixt, Tab-Labels auf Mobile sichtbar gemacht, Scroll-Hint-Pfeil für Filter-Leiste.
- **PROJ-29: Video-Aufnahme** — Deployed 2026-04-05, QA Round 2 (6/6 bugs fixed). 2026-04-13: Video-Button öffnet jetzt direkt native iOS-Kamera im Videomodus. 2026-04-16: Video-Limit von 20 MB auf 50 MB angehoben (Supabase Free-Plan-Max, Migration `20260413_raise_media_bucket_to_50mb.sql`).
- **PROJ-30: Sprachmemo + Transkription** — Deployed 2026-04-06, QA Round 2 (7/7 bugs fixed)
- **PROJ-31: Likes & Emoji-Reactions** — Deployed 2026-04-06
- **PROJ-32: Kommentar-Threads** — Deployed 2026-04-06, 9 QA bugs fixed (incl. BUG-8/9 RLS bypass). 2026-04-16: Kommentar-Composer nach oben verschoben (war am Sheet-Bottom unsichtbar), Mikrofon-Diktat via Web Speech API (de-DE) hinzugefügt, Leertaste-Bug unter iOS Safari gefixt (Radix Dialog ate space key — onKeyDown stopPropagation + onOpenAutoFocus preventDefault).
- **PROJ-33: Tages-Admin Kurations-Workflow** — Deployed 2026-04-07, QA Round 3 in Production passed via Playwright E2E (5 original bugs + 2 newly found BUG-6/7 fixed). Migrations `20260407_daily_reports.sql` + `20260407_fix_report_items.sql` angewendet. 2026-04-16: „Kuratieren"-Tab war Platzhalter („Kommt in PROJ-33") — jetzt klickbare Tages-Liste. Content-Grid per Default auf aktuellen Tag gefiltert. Toolbar-Safe-Area gegen iPhone-Statusbar.
- **PROJ-34: Slideshow-Generierung (Claude Haiku Storyboard)** — Deployed 2026-04-08, 51/51 Playwright E2E green in Production (incl. live Claude Haiku 4.5 call). Migration `20260407_slideshow.sql` angewendet. 4 Bugs by E2E caught + fixed: (1) RPC referenced non-existent `c.transcript` column, (2) missing `maxDuration=60s` caused Anthropic SDK timeout on Vercel Hobby, (3) trailing newline in `ANTHROPIC_API_KEY` env var → `.trim()` added defensively, (4) URL `event_id` wasn't validated against `agenda_item.event_id` (URL-tampering loophole). 2026-04-16: Major rendering overhaul — MP4-Output statt WebM (WhatsApp-kompatibel), `object-contain` + schwarze Letterbox-Balken statt aggressivem Crop, Ken-Burns-Zoom entfernt, dediziertes Intro (6s Cover mit Titel-Fade-In ab 3s), „Ende"-Szene mit Musik-Fade-Out (AudioBuffer via Web Audio API, iOS-zuverlässig), Foto-Thumbnails im Storyboard-Editor. Migration `20260416_storyboard_input_cover_url.sql` angewendet (cover_url in RPC-Payload). 2026-04-20: Film-Länge von 45 s → 60 s erhöht (Scene-Budget 50,5 s, Szene-Dauer jetzt 3–6 s statt 1,5–5 s), Prompt zwingt LLM jedes kuratierte Foto/Video als eigene Szene zu verwenden, Post-Validation in der Route weist Storyboards ab, die Items auslassen. **2026-04-21: Großer UX + Robustheit-Pass** nach E2E-Tests mit 3 Tagen à 10–16 Fotos:
  - **Display-Mode nach Render:** Nach „Film rendern" wird der Film oben in der Kurationsseite gepinnt (Card mit Video + Download/Teilen + Editieren/Löschen). „Neu planen"-Button durch **„Speichern"** ersetzt (nur PUT, kein LLM-Call). „Film rendern" fusioniert mit Upload+Publish (keine getrennte „Für alle veröffentlichen"-Aktion mehr). Neue Migration `20260421_delete_slideshow_and_reset.sql` mit RPC `delete_slideshow_and_reset` für „Löschen"-Button (cleart storyboard + slideshow-URLs + report_items, entfernt Storage-File).
  - **Foto-Raster = Single-Source-of-Truth:** Reconcile (neues Modul `src/lib/slideshow/reconcile.ts`) läuft beim Panel-Laden UND beim Rendern. Fehlende kuratierte Fotos bekommen minimale Szenen angefügt, verwaiste Szenen werden gedroppt. 3-stufiger Budget-Shrink (Photos only → alle proportional → trailing non-photo droppen). Szene-Löschen-Button im Editor entfernt, da inkonsistent mit Raster-Modell (wer ein Foto ausschließen will, hakt es im Raster ab).
  - **Min-Szenendauer 3s → 1,5s** (`SLIDESHOW_MIN_SCENE_MS`), damit bis zu ~33 Fotos in den 50,5 s Szenen-Budget passen (vorher Schluss bei ~16).
  - **LLM-Output-Sanitization:** Vor Zod-Parse werden `duration_ms` in [1500, 6000] geclampt, Gesamtdauer proportional geshrinkt wenn > Budget, `title/overlay_text/chapter.title` auf Schema-Max gekürzt. Zod-Schema bleibt strikt, aber Off-by-few-ms-LLM-Schludrigkeiten werden nicht mehr abgelehnt.
  - **Server-Retry bei LLM-Fehlern:** Scheitert der erste Claude-Call an Zod/Duration/Missing, wird automatisch ein zweiter Call mit explizitem Repair-Prompt gemacht. Zählt als EIN Admin-Klick gegen das Daily-Limit von 5. Fehler-Response enthält jetzt `stage` + `details[]`, Client-Toast zeigt bis zu 3 Detail-Einträge 12 s lang.
  - **Preload-Hang eliminiert:** Bild-Load-Timeout von 15 s auf 8 s reduziert mit Retry (max ~16,5 s pro Bild). Settled-Guard gegen spät-eintreffende onload/onerror auf iOS Safari. Avatar-Preload in 3 s Promise.race (non-blocking). Fehlt ein kuratiertes Foto nach Retry → loud abort statt stummer Gradient-Platzhalter.
  - **Musik-Fetch-Timeout:** `createAudioMixer` hat jetzt 10 s AbortController-Timeout; bei Fehler rendert der Film stumm weiter. Progress-Updates für Post-Preload-Phasen („Bereite Leinwand vor…", „Lade Musik…") damit der Progress-Balken nicht fälschlich bei „Lade Bild N von N" stehen bleibt.
  - **MediaRecorder Bitrate 4 → 2,5 Mbps.** Ein 60s-Film liegt damit <20 MB, auch ein versehentlich zu langer Film bleibt unter 30 MB (Bucket-Limit 50 MB).
  - **Upload-Schritte einzeln toast-bar** („Film gerendert (X MB, 60s) — lade hoch…", „Upload fertig — veröffentliche…", „Film fertig!"). Fehler-Toasts 10 s Anzeigedauer mit konkretem Stage-Prefix.
  - **WhatsApp-Teilen-Fix:** Cache-Buster `?v=...` wurde von `endsWith(".mp4")` nicht erkannt, Extension fälschlich webm → WhatsApp verweigerte. Jetzt Query-String vorher stripen, MIME explizit auf `video/mp4` setzen (CDN liefert manchmal octet-stream), Filename sanitiert.
  - **publish-slideshow `duration_sec.max(60) → max(600)`:** Eine künstliche Schranke hat Filme mit 60,5 s Dauer (Rounding-Zufall) komplett verworfen.
- **PROJ-35: Öffentliche Event-Seite** — Deployed 2026-04-08, QA Round 5 green. Migrations `20260408_public_event_rls.sql` (SECURITY DEFINER RPC `get_public_event`) + `20260408_lockdown_anon_rls.sql` (BUG-1: anon-Lockdown auf 5 Tabellen, schließt kritische Token-Leak-Lücke) angewendet. 10 Bugs (1 Critical, 1 High, 2 Medium, 6 Low) gefunden + gefixt. Known regression: Realtime-Subscriptions auf `content_items` im Content-Pool → tracked als PROJ-38.
- **PROJ-36: Post-Event Tagebuch** — Deployed 2026-04-20, QA Round 1 green (14/14 AC, 3 bugs gefixt: 2 High Security + 1 Medium Race). Migrations: `20260420_book_pages.sql` (book_pages + book_page_items + 3 SECURITY DEFINER RPCs), `20260421_book_new_layouts.sql` (3 neue Layouts: `four`, `five-hero`, `grid-3` + Foto-Deckel 12→60), `20260421_book_sections.sql` (Stage 2: stapelbare Seiten pro Tag via `book_sections` + `book_section_items`). Editor unter `/events/[id]/book/edit`, Leseansicht unter `/events/[id]/book`. Datenmodell: ein Tag (`book_pages`) enthält 1-10 Seiten (`book_sections`), jede Seite hat eigenes Layout + Kommentar + Fotos. UI spricht konsequent von „Seiten" (nicht „Abschnitten") — bereitet 1:1 auf PROJ-37 PDF-Export vor: eine DB-Sektion = eine Fotobuch-Seite. Leseansicht rendert jede Seite als eigene Karte (`max-w-[560px]`, zentriert, Rahmen, Schatten, „Seite N / M"-Label). Versteckte Tage zeigen nur Platzhalter mit Datum+Titel. Vorschau-Modus (`?preview=true`) nur für Organisator. Bonus-Fixes: Zurück-Pfeil im Content-Lightbox (iOS Safe-Area), Kuratier-Mülleimer aktiviert, Slideshow-LLM-JSON-Parser gehärtet + Slideshow-Länge auf 60 s angehoben (alle in Commit-Kette `c0af615` .. `5ff8873`).
- **iOS PWA Fixes** — 2026-04-13: Safe-Area-Insets für iPhone Status-Bar (Navigation war verdeckt), `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production gesetzt (fehlte, blockierte allen Login). 2026-04-16: Kurations-Toolbar sticky-Position mit safe-area-inset-top.
- **Hong-Kong-Test (2026-04-16)** — Erster echter E2E-Durchlauf: 101 Fotos über 3 Tage hochgeladen + per EXIF-Datum automatisch Agenda-Tagen zugeordnet, Slideshows generiert + via WhatsApp geteilt. Viele UX-Bugs entdeckt und gefixt (siehe obige PROJ-Einträge).
- **Design-Pass 2026-04-17/18** — Großer UI-Refresh über alle Seiten:
  - **Caveat**-Schreibschrift global auf Buttons, Form-Labels, Überschriften (Event-Titel, Agenda, "Event bearbeiten", Gefahrenzone)
  - **Meine Events**: größerer "+" / Avatar (48px), großer CTA "Neues Event erstellen" linksbündig
  - **Event-Detail**: Titel unter Cover (statt im Bild), Erfassen-Tab mit Primärfarbe, Agenda als Toggle-Button (Amber) oben neben Titel statt permanenter Sektion unten
  - **Erfassen**: 4 Buttons (Kamera/Video/Upload/Notiz) statt 5, größere Icons (40px), primary/10 Hintergrund passend zum Erfassen-Tab. "Sprachmemo" + "Kommentar" zu **"Notiz"** zusammengeführt — AudioSheet akzeptiert nun Text-only OR Audio-Aufnahme
  - **Sammlung**: "Texte" + "Sprachmemos" Filter zu **"Notizen"** zusammengeführt (API: `filter=notes` → WHERE type IN (text, audio))
  - **Cover**: Pinch-to-Zoom + Drag (statt Slider), größere Anzeige (h-64/h-80 Event-Detail, 16:9 auf Event-Cards)
  - **Avatar**: Crop-Overlay mit Pinch-to-Zoom vor dem Upload (Canvas-Crop client-side)
  - **Karte**: GPS-Pin-Button in Sammlung, Agenda-Orte als Marker mit Foto-Count, respektiert aktiven Filter. Manueller Ort pro Agenda-Tag setzbar (Leaflet + Nominatim-Suche + OSM.de Tiles für deutsche Labels)
  - **Umlaut-Fix**: 127 Transliterationen (ae/oe/ue) in 39 Dateien zu ä/ö/ü korrigiert — Script in `scripts/fix-umlauts.js` hinterlegt
  - **Bug-Fixes**: PATCH /events/[id] löscht Agenda nicht mehr wenn `agenda_items` fehlt; Kommentar-Edit mit Realtime-Sync; Cover-Position/Scale gespeichert via ref (stale closure bug); Location-Picker via createPortal (Radix outside-click-Fix); Map-Picker `type="button"` (kein Form-Submit mehr)
  - **Migrationen angewendet**: `20260417_update_comment.sql` (comment edit RPC), `20260417_cover_position.sql` + `20260417_cover_scale.sql` (cover_position, cover_scale + get_public_event RPC), `20260417_agenda_item_location.sql` (lat/lng pro Agenda-Item)

- **PROJ-37: PDF-Export (Fotobuch-Druck)** — Deployed 2026-04-22. Tagebuch als PDF exportierbar via `@react-pdf/renderer` (client-side, kein Server). 3 Formate (Quadrat/A4 Hoch/A4 Quer), 3 Farbthemen, alle 7 Buch-Layouts. Cover: Caveat-Schrift + volles Bild (`object-fit: contain`) + opt-in Info-Box. Preflight URL-Validation (`src/lib/pdf-preflight.ts`) verhindert Absturz bei 404-Fotos. Caveat-TTF lokal in `/public/fonts/`. QA: 11 Bugs alle gefixt. Security clean.
- **PROJ-26 Einladungs-Sackgasse** — Deployed 2026-04-22. Neue User ohne Cookie bekommen jetzt automatisch ein Name-Formular statt /login-Sackgasse. E2E mit Frank + Julius (HK) bestätigt.
- **PROJ-39: Upload-SHA-256-Dedup** — Deployed 2026-04-23. Verhindert Duplikat-Uploads aus dem HK-Test. Browser berechnet SHA-256 via Web Crypto API vor dem Storage-Upload; Server prüft per `GET ?hash=` ob dieses Event das Foto schon kennt; UNIQUE PARTIAL-Index `(event_id, file_hash) WHERE file_hash IS NOT NULL` als Race-Safety-Netz. Betrifft photo-sheet, video-sheet, audio-sheet, wanderer-screen (Bulk-Upload inkl. In-Batch-Dedup), offline-queue (idempotenter Replay). Shared-Helper `src/lib/file-hash.ts`. QA: 23/23 automatisierte Checks grün, keine Bugs.
- **PROJ-38: Realtime-Fix Content-Pool** — Deployed 2026-04-22. Regression aus PROJ-35 BUG-1 behoben: `GRANT SELECT ON content_items TO anon` + minimale RLS SELECT-Policy wiederhergestellt. Postgres CDC liefert jetzt wieder INSERT/DELETE-Events an Browser-Subscriber. Verifier 3/3 PASS, Deep-QA 13/13 PASS (inkl. members.token bleibt gesperrt, anon-Writes bleiben gesperrt). Bonus: Pre-existing Bug in `get_public_event` RPC behoben (`ci.transcript` → `ci.caption`, öffentliche Event-Seite `/e/[slug]` funktioniert wieder). 2-Geräte-Realtime-Smoke-Test auf Benutzerwunsch übersprungen — empfohlen beim nächsten realen Eventeinsatz.
- **PROJ-40: Event-Countdown** — Deployed 2026-04-24. Countdown zwischen Cover und Titel auf /events/[id] UND als Overlay unter dem Cover in der Meine-Events-Liste (EventCard). Compact-Variante: text-only, rechtsbündig, „in:"-Prefix vor der Tages-Zahl, „Startet am Montag, X. Monat YYYY" als Header. Ziel-Uhrzeit start_date 12:00 Uhr lokale Zeit. Update alle 60s (Tage/Std/Min, keine Sekunden). Wiederverwendung von `src/components/public-countdown.tsx` (PROJ-35) mit neuem `targetHour` + `compact` Props; öffentliche Event-Seite bleibt auf Mitternacht-Mode und Full-Banner-Variante.
- **Aloha-Sixty Design-System** — Deployed 2026-04-24. App-weiter Theme-Wechsel vom Mint/Amber-shadcn-Default auf die Vintage-Hawaii-Briefmarken-Palette (Terracotta `#C94A2B` primary, Mustard `#E9B63A` accent, Teal `#2A6A6A` secondary, Forest `#1E4A3C`, Cream `#F2E7CE` background). Fonts: Alfa Slab One (display), Oswald (headline), Work Sans (body) — Caveat + Dancing_Script entfernt. Alle 20 `font-[family-name:var(--font-caveat)]`-Occurrences auf `font-display` migriert. Neue `.paper-texture`-Utility (radial-gradient Dot-Pattern) für Hero-Bereiche. `.dark`-Variante aus `globals.css` entfernt (war Dead Code). Handoff-Bundle kam aus claude.ai/design. **Folge-Pass (2026-04-24):** PDF-Export (`src/components/pdf/*`) auch auf Aloha migriert — alte Caveat-TTFs gelöscht, 5 neue TTFs in `/public/fonts/` (AlfaSlabOne, Oswald Reg/Bold, WorkSans Reg/Bold), 3 PDF-Themes (Classic/Warm/Dark) mit Aloha-Palette re-coloured, alle `fontFamily: "Caveat"` → `"AlfaSlabOne"` und `"Helvetica-Bold"` → `"Oswald"` umgestellt. PDFs und Web-App jetzt visuell konsistent.
- **PROJ-41: Tour-Tracker** — Deployed 2026-04-24. 5. Button auf dem Erfassen-Tab (neben Kamera/Video/Upload/Notiz) startet GPS-Aufnahme via `navigator.geolocation.watchPosition`. Live-Stats: Current/Ø-Geschwindigkeit (km/h), Distanz (Haversine), Höhenmeter ↑/↓ (EMA α=0.3 + Min-Delta 2m gegen GPS-Rauschen). Pause/Resume mit Segment-basierter Active-Duration. Save → Canvas-PNG (1200×1200) mit Event-Header, Polyline-Karte (RDP-Simplifikation bei >2000 Punkten, A/B-Marker) + 5-Stats-Grid → Upload als normales `type="photo"` via bestehende `POST /content`-Route (erbt PROJ-39-Dedup automatisch). Crash-Recovery via localStorage-Snapshot (30s-Intervall, 24h-TTL). Wake-Lock-Acquisition + Visibility-Change-Re-Acquisition + Toast-Warnung für iOS-Safari-Constraint. Keine DB-Änderungen, keine neuen API-Routes. 3 neue Dateien (`use-tour-tracker.ts`, `tour-report.ts`, `tour-tracker-sheet.tsx`), 3 modifizierte. QA: 12/12 ACs green (Desktop-Smoke-Test mit Chrome Sensors-Panel). **Field-Test auf echter Wanderung ausstehend** — Frank testet spätestens auf Rota Vincentina (2026-06-14–21).

- **PROJ-42: Storage-Optimierung & Event-Archivierung** — In Review seit 2026-05-28. Ziel: Supabase-Free-Storage länger nutzbar machen. In-App-Kamera und direkte Videoaufnahme entfernt; Wanderer nehmen Medien mit der Handy-Kamera auf und laden fertige Dateien hoch. Foto-Upload komprimiert neue Bilder auf max. 1600px / ca. 700 KB Zielgröße, Video-Dateiupload auf 15 MB begrenzt. Neue API `GET/POST /api/events/[id]/storage`. Keine DB-Migration nötig. QA lokal: `npm run lint` PASS (bestehende Warnungen), `npx tsc --noEmit` PASS, `npm run build` PASS. Hong-Kong nach Supabase-Reaktivierung getestet: 96 Fotoeinträge / 192 Storage-Objekte mit lokalem Backup optimiert, Fotos 70,93 MB → 18,31 MB, referenzierter Event-Storage 212,91 MB → 160,25 MB, keine Datenbankzeilen gelöscht. Backup lokal unter `storage-backups/hong-kong-april-2026-2026-05-28T17-30-35-091Z` (gitignored). PROJ-44 hat die Speicherkarte später auf Einzelaktionen ohne Dry-Run umgestellt. Offen bleibt nur: produktive Bereinigung bewusst per UI bestätigen, nicht automatisch.

- **PROJ-43: Die Wandervögel Event-Archiv** — Deployed 2026-05-31. Archivlinks für veröffentlichte Events: gemeinsamer Archivindex, Event-spezifische Archivseite und private Archivlinks. Direkter Admin-Join-Redirect funktioniert mit `next=/events/.../settings`. Event-Einstellungen heißen jetzt klar `Event-Einstellungen`. Production verifiziert: Rota im Wandervögel-Archiv sichtbar, Hong-Kong privat veröffentlicht, direkte Settings-Links landen im richtigen Event. Keine externe Originalmedien-Auslagerung umgesetzt.

- **PROJ-44: Tagebuch- und Archivdarstellung verbessern** — Deployed 2026-06-01. Pragmatischer UX-Pass für bestehendes Supabase-basiertes Tagebuch/Archiv statt externer Originalmedien-Archivierung. Archiv- und interne Tagebuchansicht nutzen denselben Layout-Kern: breitere Desktop-Seiten (`max-w-[920px]`), responsive iPhone/iPad/Desktop-Darstellung, Tages-Kapitelköpfe mit Datum/Titel/Beschreibung/Ort, sichtbare Foto-Captions, Text-/Audio-Notizen als Karten, Tour-Tracker-Fotos mit Tour-Label. Fotos öffnen per Tippen/Klick in einer fullscreen Lightbox mit Zurück-Button; Rotation ins Querformat bleibt `object-contain` und zeigt das ganze Foto statt Crop.
  - **Speicherkarte unter Einstellungen:** Dry-Run aus der UI entfernt. Drei getrennte, bestätigungspflichtige Aktionen: `Bereinigbare löschen` für verwaiste Storage-Dateien, `Slideshows löschen` für generierte WhatsApp-Tagesfilme, `Videos löschen` nur für Videos, die nicht in `book_page_items` oder `book_section_items` verwendet werden. Keine Medien werden automatisch gelöscht. Hong-Kong Production-Smoke am 2026-06-01: 6,6 MB bereinigbar, 112 MB Slideshows, 29,9 MB loeschbare Videos sichtbar; keine Löschaktion ausgeführt.
  - **Slideshow-Fix:** Prompt erzeugt keine zusätzliche `cover`-/Intro-Szene mehr, weil der Renderer bereits ein festes 6s-Cover-Intro erzeugt. `stripGeneratedIntroScenes()` entfernt alte `cover`-Szenen und leere Textkarten beim Generieren/Reconcile/Rendern. Neue gerenderte Videos sollen dadurch keinen doppelten Titel und keine rosa Leerszene mehr haben; bestehende MP4s ändern sich erst nach erneutem Rendern.
  - **Verification:** `npx tsc --noEmit`, `npm run lint` (nur bestehende Warnungen), `npm run build` PASS. Production-Smoke gegen `https://frank-lernt.vercel.app`: Archiv-Lightbox fullscreen und `object-fit: contain`; Admin-/Settings-Seiten laden mit aktueller Version. Keine DB-Migration, keine neuen Buckets.

- Frank hat ein echtes Hong-Kong-Event angelegt (slug: `hong-kong-april-2026`, 3 Tage, ursprünglich 104 Fotos hochgeladen, alle Agenda-Tage mit Hong-Kong-Orten verknüpft) — Testdaten für PROJ-36/37/42/44. Stand 2026-06-01: Tagebuch/Archiv ist gefüllt und privat veröffentlicht; Speicherkarte zeigt weiterhin bereinigbare Dateien, Slideshows und loeschbare Videos. Bestehende Slideshow-MP4s müssen neu gerendert werden, wenn der PROJ-44-Intro-Fix sichtbar werden soll.

### Nächster Schritt
Nächster fachlicher Schritt nach Bedarf: entweder Hong-Kong-Speicher gezielt bereinigen (nur nach expliziter Bestätigung in der UI) oder ein neues Feature als PROJ-45 mit `/requirements` starten. Bestehende Hong-Kong-Slideshows bei Bedarf neu rendern, damit der doppelte Titel und die rosa Leerszene verschwinden.

### Build-Reihenfolge
1. ~~PROJ-24~~ ✅ ~~PROJ-25~~ ✅ ~~PROJ-26~~ ✅ ~~PROJ-27~~ ✅ ~~PROJ-28~~ ✅ ~~PROJ-29~~ ✅ ~~PROJ-30~~ ✅ ~~PROJ-31~~ ✅ ~~PROJ-32~~ ✅ ~~PROJ-33~~ ✅ ~~PROJ-34~~ ✅ ~~PROJ-35~~ ✅ ~~PROJ-36~~ ✅ ~~PROJ-37~~ ✅ ~~PROJ-38~~ ✅ ~~PROJ-39~~ ✅ ~~PROJ-40~~ ✅ ~~PROJ-41~~ ✅ PROJ-42 In Review ~~PROJ-43~~ ✅ ~~PROJ-44~~ ✅

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md
