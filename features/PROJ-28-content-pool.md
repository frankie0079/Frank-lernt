# PROJ-28: Content-Pool (Karteikarten, Realtime-Ansicht)

## Status: In Progress
**Created:** 2026-03-08
**Last Updated:** 2026-04-05

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

### Overview

PROJ-28 replaces the "Pool"-Tab placeholder in `/events/[id]` with a live, scrollable card feed. Content was already created via PROJ-27 (Wanderer-Screen) and stored in `content_items`. This feature makes that content visible to all participants — in real time.

The backend API already exists (`GET /api/events/[id]/content`). The main work is:
1. Extend the API with cursor pagination + filter params
2. Build 4 new frontend components
3. Wire up Supabase Realtime

---

### Component Structure

```
Pool Tab (page.tsx — existing, replace placeholder)
└── ContentPool                          ← new, main container
    ├── FilterBar                        ← new, horizontal scroll
    │   └── Filter Pills (shadcn Badge)
    │       Alle | Fotos | Videos | Texte | Sprachmemos | [Agenda-Punkt…]
    ├── Content List
    │   ├── ContentCard × N              ← new, one per content_item
    │   │   ├── Media Preview
    │   │   │   ├── Foto → <img> thumbnail
    │   │   │   ├── Video → Standbild (<img>) + Play-Icon overlay
    │   │   │   ├── Sprachmemo → Mikrofon-Icon (teal)
    │   │   │   └── Text → erster Absatz (abgeschnitten)
    │   │   ├── Author Row
    │   │   │   ├── Avatar (shadcn Avatar)
    │   │   │   ├── Autorenname
    │   │   │   ├── Relative Zeit ("vor 5 Min.", date-fns formatDistanceToNow)
    │   │   │   └── Medientyp-Badge (shadcn Badge)
    │   │   └── Löschen-Button (Papierkorb, nur sichtbar für Autor/Admin/Org)
    │   ├── Skeleton Cards (shadcn Skeleton, beim Laden)
    │   └── Infinite Scroll Trigger (IntersectionObserver, am Listenende)
    ├── "Neue Beiträge" Pill-Button      ← erscheint wenn Realtime-Beitrag
    │                                       reinkommt, während User hochgescrollt
    └── Empty State                      ← Illustration + CTA → Capture-Tab
ContentLightbox                          ← new, fullscreen modal (shadcn Dialog)
    ├── Foto → Vollbild + Swipe (Pointer Events)
    ├── Video → <video playsInline controls>
    ├── Sprachmemo → <audio controls>
    └── Text → Vollansicht
DeleteConfirmDialog                      ← shadcn AlertDialog (wiederverwendbar)
```

---

### Datenfluss

| Schritt | Was passiert |
|---------|-------------|
| 1. Initialer Load | `GET /api/events/[id]/content?limit=20` → erste 20 Karten |
| 2. Infinite Scroll | User scrollt ans Ende → `?cursor=[created_at]&limit=20` → 20 weitere |
| 3. Filter wechseln | URL-Param `?filter=photos` → Liste neu laden (Reset cursor) |
| 4. Realtime INSERT | Neuer Beitrag → Toast "Neuer Beitrag von [Name]" + bei passendem Filter: oben einfügen |
| 5. Realtime DELETE | Beitrag gelöscht → sofort aus Liste entfernen |
| 6. Optimistic Delete | User löscht → Karte sofort weg → API-Fehler → Karte zurück + Toast |

**Wichtig:** Realtime INSERT liefert nur die rohen DB-Felder. Da die Karte Autorenname + Avatar braucht, wird beim INSERT-Event ein einzelner API-Fetch (`GET /api/events/[id]/content?id=[contentId]`) ausgelöst, um die vollständige Karte mit Author-Daten zu erhalten.

---

### Backend-Änderungen (minimal)

`GET /api/events/[id]/content` — bereits vorhanden, braucht 2 Erweiterungen:

1. **Cursor-Pagination:** neuer Query-Param `cursor` (ISO-Timestamp) → filtert auf `created_at < cursor`; Standard-Limit von 200 → 20 ändern
2. **Filter-Param:** `filter=photos|videos|texts|voice` → filtert `type`-Spalte; `filter=agenda:[uuid]` → filtert `agenda_item_id`

Keine neuen API-Routen, keine neuen DB-Tabellen, keine neuen RLS-Policies.

---

### Supabase Realtime

- Kanal: `content_items:event_id=eq.[eventId]`
- Events: `INSERT`, `DELETE`
- Reconnect-Strategie: automatisch via Supabase-Client; bei Reconnect wird die Liste per API nachgeladen (fehlende Beiträge holen)
- Scope: Realtime-Subscription wird nur aktiv, wenn der "Pool"-Tab geöffnet ist

---

### Tech-Entscheidungen

| Entscheidung | Warum |
|---|---|
| IntersectionObserver statt react-virtual | Für MVP ausreichend; kein neues Paket; react-virtual kann später ergänzt werden |
| URL-Params für Filter-State | Deep-Link-fähig; Browser-Back funktioniert; kein lokaler State nötig |
| date-fns `formatDistanceToNow` | Bereits installiert; liefert "vor 5 Min." out-of-the-box |
| shadcn Dialog für Lightbox | Bereits installiert; Accessibility (focus trap, Escape) gratis |
| Optimistic Deletion | Sofortiges Feedback ohne Warten auf Server |

---

### Keine neuen Pakete nötig

Alle benötigten Tools sind bereits installiert:
- **Supabase Realtime** — `@supabase/supabase-js` (bereits im Projekt)
- **Relative Zeit** — `date-fns` (bereits installiert)
- **Swipe-Gesten** — native Pointer Events (kein Paket)
- **Toast** — `sonner` (bereits installiert, `src/components/ui/sonner.tsx`)
- **Alle UI-Primitive** — shadcn/ui (Card, Badge, Avatar, Skeleton, Dialog, AlertDialog, ScrollArea)

---

### Neue Dateien

| Datei | Zweck |
|---|---|
| `src/components/content-pool.tsx` | Haupt-Container: Realtime + Pagination + Filter-State |
| `src/components/content-card.tsx` | Einzelne Karteikarte |
| `src/components/content-filter-bar.tsx` | Horizontale Filter-Leiste |
| `src/components/content-lightbox.tsx` | Vollbild-Modal (Foto/Video/Audio/Text) |

Geänderte Dateien:
- `src/app/api/events/[id]/content/route.ts` — cursor + filter params ergänzen
- `src/app/events/[id]/page.tsx` — Pool-Tab Placeholder durch `<ContentPool>` ersetzen

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
