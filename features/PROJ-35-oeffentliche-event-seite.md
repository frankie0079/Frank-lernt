# PROJ-35: Öffentliche Event-Seite (Landing Page)

## Status: In Progress
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

**QA Round 1 — 2026-04-08 — Code audit + production RPC smoke test**
**Tester:** QA/Red-Team
**Environment:** Code review (working tree, not yet committed) + live Supabase `xqopetmpzjbxksonmhjw` + live Vercel prod URL

### Production smoke test (MANDATORY step 2b)
- Live page `/e/[slug]` smoke test: **SKIPPED — not deployable yet.** Feature code exists only in the working tree (not committed, not pushed, not on Vercel). `GET https://frank-lernt.vercel.app/e/e2e-shared-1775657364513-testevent` returns HTTP 404. Full E2E page-level smoke test must be re-run once the feature is deployed.
- Production RPC smoke test: **PASSED.** Migration `20260408_public_event_rls.sql` IS already applied in prod. `POST /rest/v1/rpc/get_public_event` returns `{ok:true, event, agenda:[], reports:[]}` for a real slug and `{ok:false, error:"not_found"}` for an unknown slug. RPC correctly excludes `members.token` from its payload.

### Acceptance Criteria (code-level review)
| # | Criterion | Result |
|---|---|---|
| 1 | URL `/e/[slug]` public, no login | PASS — route exists as Server Component, no auth check |
| 2 | Server Component with SSR + generateMetadata | PASS |
| 3 | Header: name, cover, date range, member count | PASS (`public-event-header.tsx`) |
| 4 | Share button (Web Share + clipboard fallback) | PASS — reuses existing `ShareButton` |
| 5 | Day-report cards: date, title, video, count | PASS (`public-day-report-card.tsx`) |
| 6 | Native `<video>` w/ controls, playsInline, poster | PASS |
| 7 | Photo gallery grid + lightbox | PASS (reuses `ContentLightbox`) |
| 8 | Leaflet map with GPS markers | PASS (`public-event-map-inner.tsx`) |
| 9 | Map hidden if no GPS photos | PASS — `markers.length > 0` guard in page.tsx and inner |
| 10 | Marker popup: thumbnail + author + day title | PASS |
| 11 | Only `published` reports shown | PASS — enforced inside RPC (`where r.status='published'`) |
| 12 | Reports sorted chronologically asc | PASS — RPC `order by rep.agenda_date asc` |
| 13 | OG meta tags (title, image, description, url) | PASS with caveats — see BUG-3 |

### Edge Cases (code-level)
- Empty state: PASS (Card rendered when `sortedReports.length===0`)
- Future event countdown: PASS (`PublicCountdown` client component)
- Archived event: PASS (no status banner)
- Map hidden w/o GPS: PASS
- Missing slideshow URL: PASS (shows "Slideshow in Kürze verfügbar")
- Slug not found → 404 page: PASS (`not-found.tsx`)
- Cover-foto fallback gradient: PASS (Teal→Amber gradient when `coverUrl` null)
- Lazy video loading: **FAIL** — see BUG-4
- OG preview for WhatsApp: PASS in code (cannot verify live because not deployed)

---

### BUGS FOUND

#### BUG-1 — CRITICAL — Member tokens world-readable via anon REST (account takeover)
**Severity:** CRITICAL (security / account takeover)
**Introduced by:** Pre-existing since baseline, but PROJ-35 explicitly promised to fix it (tech-design lines 130-140) and DID NOT. Shipping PROJ-35 as-is makes the issue dramatically worse because the feature advertises a public URL that actively funnels strangers to the vulnerable project.

**Steps to reproduce (no auth, anywhere on the internet):**
```
curl "https://xqopetmpzjbxksonmhjw.supabase.co/rest/v1/members?select=id,name,token,role" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>"
```
Returns every member record in plaintext, including `token`. Example live response from prod right now:
```
[{"id":"26d55bf5-...","name":"Frank","token":"0a69ae9ada9e7f0eb695a147843ab34b","role":"organizer"}]
```

**Impact:** Any visitor to `/e/[slug]` (or anyone who reads the anon key from the JS bundle, which is by design `NEXT_PUBLIC_`) can dump the full members table, grab any token, and visit `https://frank-lernt.vercel.app/join/<token>` to log in as that member — including `organizer` role. Full account takeover for every user, every event, in one request.

**Similarly exposed (anon SELECT * works live):**
- `events` — full rows including `organizer_id`, `description`
- `event_members` — membership graph
- `agenda_items` — full rows of every event
- `content_items` — every photo/video/text caption of every event, published or not

Only `daily_reports` and `report_items` are correctly locked (`permission denied`, verified live).

**Fix owner:** Backend. Migration must:
1. Revoke anon SELECT on `members`, `events`, `event_members`, `content_items`, `agenda_items` at the GRANT level (or replace policies with `USING (false)` for anon).
2. Route all public-page reads exclusively through `get_public_event` RPC (which is already implemented correctly — it only returns `name`+`avatar_url` for members).
3. Verify `/events`, `/join/[token]`, `/capture`, `/pool`, `/admin` internal flows still work after lockdown (they should, since they use cookie-identified server routes, not anon PostgREST).

**Priority:** Must fix BEFORE deploy. This is the highest-severity bug the project has ever had.

---

#### BUG-2 — HIGH — `generateMetadata` and page both call the cached fetcher but share no dedupe guarantee
**Severity:** High (performance / data consistency)
**Location:** `src/app/e/[slug]/page.tsx` lines 97 and 136
Both `generateMetadata()` and the page body call `getCachedFetcher(slug)()`. `unstable_cache` deduplicates across invocations keyed by `["public-event", slug]`, so this should return the same cached value — but `getCachedFetcher` is constructed fresh in each caller, so Next may or may not reuse the underlying cache entry across the metadata + page phase of the same request. React's `cache()` per-request memoization is NOT in use. Worst-case: two DB round-trips per cold page view. Not a correctness bug, but under Follower load (feature goal), this doubles DB RPC calls.
**Fix:** Wrap the fetcher in `import { cache } from 'react'` for request-scope dedupe, OR define the `unstable_cache`d function at module top-level (not as a factory).
**Priority:** Fix before deploy (cheap).

---

#### BUG-3 — MEDIUM — OG description silently ignores `generateMetadata`'s `dateLabel` fallback path
**Severity:** Medium (UX / metadata correctness)
**Location:** `src/app/e/[slug]/page.tsx` lines 102-108
`dateLabel` is computed but only used if `event.description` is null (as fallback string). However line 107 uses `event.description?.slice(0, 160) ?? \`Gemeinsame Event-Dokumentation ab ${dateLabel}.\``. This works, but there is no newline-stripping or HTML-stripping for descriptions that contain markdown or line breaks — WhatsApp link previews will render raw newlines and break formatting. Consider `.replace(/\s+/g, ' ')` before slicing.
**Priority:** Fix before deploy.

---

#### BUG-4 — MEDIUM — Acceptance criterion "Lazy Loading der Videos (`loading=\"lazy\"` auf `<video>`)" not implemented
**Severity:** Medium (performance — spec violation on edge case "30 reports")
**Location:** `src/components/public-day-report-card.tsx` line 62-70
The `<video>` element has `preload="metadata"` but no `loading="lazy"` attribute (HTML5 `<video>` does not actually support `loading="lazy"` — only `<img>` and `<iframe>` do). Spec explicitly demands intersection-observer-based lazy loading for the 30-day case. Currently, all videos will issue metadata fetches on page load. With 30 reports, that's 30 parallel range-requests against Supabase Storage per page view.
**Fix:** Wrap `<video>` in an IntersectionObserver that only sets the `src` when the element enters the viewport.
**Priority:** Fix before deploy (or formally accept the deviation in spec).

---

#### BUG-5 — LOW — Leaflet default icon loaded from unpkg.com CDN (external dependency + CSP risk)
**Severity:** Low (resilience / CSP)
**Location:** `src/components/public-event-map-inner.tsx` lines 11-19
Marker icons are hotlinked from `https://unpkg.com/leaflet@1.9.4/...`. If unpkg is down or blocked by a user's network, markers disappear. Also, a future Content-Security-Policy header would need to whitelist unpkg.
**Fix:** Copy the three PNGs into `/public/leaflet/` and reference them locally (standard Next.js pattern for Leaflet). Or import them from the `leaflet/dist/images/` package via webpack.
**Priority:** Fix before deploy (trivial).

---

#### BUG-6 — LOW — `"Teilnehmer"` is not pluralised
**Severity:** Low (i18n polish)
**Location:** `src/components/public-event-header.tsx` line 110
```
{memberCount} {memberCount === 1 ? "Teilnehmer" : "Teilnehmer"}
```
Both branches return the same string. German correct form is "1 Teilnehmer" / "2 Teilnehmer" — actually the word is the same in Nom. Sg. and Pl., so technically OK, but the ternary is pointless. Either delete the conditional or use "Teilnehmer:innen"/"Teilnehmende" consistently.
**Priority:** Optional cleanup.

---

#### BUG-7 — LOW — `<Image>` `alt` for unnamed authors shows `"Unbekannt"` + caption injection risk not sanitised
**Severity:** Low
**Location:** `src/components/public-photo-gallery.tsx` line 76
The `aria-label` template interpolates `item.caption` without any escaping. Not an XSS risk (React escapes text), but long or multi-line captions will produce huge aria-labels that break screen readers.
**Fix:** `item.caption?.slice(0, 80)`.
**Priority:** Optional.

---

#### BUG-8 — LOW — Footer link "EventDocs" points to `/` which requires auth
**Severity:** Low (UX for public followers)
**Location:** `src/app/e/[slug]/page.tsx` line 223
Anonymous followers clicking "EventDocs" in the footer are sent to `/` which redirects to `/login`. Dead-end UX.
**Fix:** Either remove the link, or send to `/login` directly, or create a public landing page.
**Priority:** Optional.

---

### Regression risk check
- PROJ-33 (`daily_reports`, `report_items`) — still locked down to anon, verified live (`permission denied`). No regression.
- PROJ-24 (Auth token login) — **AT RISK** due to BUG-1. Token-based auth is only secure as long as tokens are secret. They are not.
- PROJ-27/28 (Wanderer, Pool) — `content_items` was already world-readable to anon (BUG-1 pre-existing). Captions + media URLs of every event already public.

### Security audit summary (red-team)
- **Authentication bypass:** CRITICAL — BUG-1 enables trivial takeover of every account.
- **Authorization:** BUG-1 collapses all per-event isolation.
- **Injection:** No user-controllable DB queries beyond `p_slug`; RPC uses parameterised query. OK.
- **Data leaks:** BUG-1. Also `events.organizer_id`, `content_items.caption` of draft content, all agenda items of all events — all readable by anon.
- **Rate limiting:** No limits on the RPC. Low concern because cache layer absorbs Follower traffic, but a motivated attacker can force cache misses with random slugs.
- **Secrets in network:** None beyond the intentional `NEXT_PUBLIC_SUPABASE_ANON_KEY` — which, thanks to BUG-1, is now a master key.

### Responsive / cross-browser
- Not performed — feature is not deployed. Must be re-run once on prod URL against Chrome / Firefox / Safari at 375px / 768px / 1440px.

---

### Production-ready verdict: **NOT READY**

Blockers:
1. BUG-1 (CRITICAL) — MUST be fixed before deploy. Lock down `members`, `events`, `event_members`, `content_items`, `agenda_items` anon SELECT; ensure public page still works via RPC only.
2. BUG-2, BUG-3, BUG-4, BUG-5 (HIGH / MEDIUM / LOW) — per CLAUDE.md convention "Fix ALL bugs before deploy".
3. Re-run production smoke test (step 2b) against the live Vercel URL after deploy of the feature code, including: page loads, map renders, video plays, empty state, 404 path, OG tags visible to curl user-agent.

**Recommended fix order:** BUG-1 → BUG-5 → BUG-4 → BUG-2 → BUG-3 → BUG-6/7/8 → re-deploy → QA Round 2 in production.

## Deployment
_To be added by /deploy_
