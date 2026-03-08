# PROJ-28: Content-Pool (Karteikarten, Realtime-Ansicht)

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-27 (Wanderer-Screen) — Content wird dort erstellt und in `content_items` gespeichert

## User Stories
- Als Wanderer möchte ich alle Beiträge aller Teilnehmer als Karteikarten sehen, damit ich mitbekomme, was die anderen erleben.
- Als Follower möchte ich neue Beiträge sofort sehen, ohne die Seite neu laden zu müssen.
- Als Nutzer möchte ich Beiträge nach Agenda-Punkt filtern können, damit ich den Überblick behalte.
- Als Nutzer möchte ich ein Vollbild-Preview öffnen können (Foto/Video), um Details zu sehen.

## Acceptance Criteria
- [ ] Chronologische Liste (neueste zuerst) aller `content_items` des Events unter `/events/[id]`
- [ ] Karteikarte enthält: Vorschaubild / Video-Standbild / Audio-Icon / Text-Auszug, Autorenname + Avatar, Uhrzeit (relativ: "vor 5 Min."), Medientyp-Badge (Foto / Video / Text / Sprachmemo)
- [ ] Neue Beiträge erscheinen live ohne Seiten-Reload (Supabase Realtime Subscription auf `content_items` INSERT)
- [ ] Toast-Benachrichtigung "Neuer Beitrag von [Name]" bei Beiträgen anderer Nutzer (nicht bei eigenen)
- [ ] Filter-Leiste: Alle | Fotos | Videos | Texte | Sprachmemos | [Agenda-Punkt-Name] (horizontal scrollbar)
- [ ] Aktiver Filter ist visuell hervorgehoben (Badge mit Hintergrundfarbe)
- [ ] Tap auf Karteikarte → Vollbild-Ansicht: Foto-Lightbox (Swipe-Navigation) / Video-Player / Audio-Player / Text-Vollansicht
- [ ] Eigene Beiträge: Löschen-Button (Papierkorb-Icon) auf der Karteikarte
- [ ] Admin + Organisator können alle Beiträge löschen
- [ ] Löschen mit Bestätigungs-Dialog "Beitrag unwiderruflich löschen?"
- [ ] Optimistic Deletion: Karte verschwindet sofort, wird bei Fehler wiederhergestellt

## Edge Cases
- 0 Beiträge → Empty State: Illustration + "Noch keine Beiträge — sei der Erste!" + Link zum Wanderer-Screen
- Mehr als 200 Beiträge → Infinite Scroll: Initial 20 laden, 20 weitere beim Scroll ans Ende
- Video noch am Hochladen → Skeleton-Karte mit Fortschrittsbalken (via Realtime `upload_progress` oder optimistic state)
- Bild-URL nicht erreichbar (Supabase Storage Fehler) → Platzhalter-Icon (Foto-Symbol, Teal)
- Kein Internet → Letzte geladene Beiträge aus PWA Cache (Serwist `StaleWhileRevalidate` für API-Routen)
- Realtime-Verbindung unterbrochen → Stiller Reconnect-Versuch, bei Erfolg fehlende Beiträge nachladen
- Nutzer scrollt weit nach oben → "Neue Beiträge" Pill-Button erscheint oben, Tap scrollt zurück nach unten
- Filter aktiv + Realtime-Beitrag passt nicht zum Filter → Beitrag wird trotzdem als Toast angezeigt, aber nicht in Liste eingefügt

## Technical Requirements
- Supabase Realtime: `supabase.channel('content_items').on('postgres_changes', ...)` auf `content_items` INSERT/DELETE
- Virtual Scrolling für Performance bei > 100 Items (react-virtual oder eigene Implementierung)
- Lazy Loading: `<Image loading="lazy">` für Thumbnails, `IntersectionObserver` für Nachladen
- Pagination: Server-seitiges Cursor-Pagination (nach `created_at` DESC), `?cursor=[timestamp]`
- API-Route: `GET /api/events/[id]/content?cursor=&filter=&limit=20` — Zod-validiert
- RLS auf `content_items`: SELECT für Event-Mitglieder, DELETE für Eigentümer + Admin + Organisator
- Filter-State in URL-Params (`?filter=photos`) für Deep-Link-Fähigkeit
- Vollbild-Lightbox: swipe-gestures via `touch-action: pan-y` + `pointermove` Events
- Video-Player: natives `<video>` Element mit `playsInline` (iOS-kompatibel)

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
