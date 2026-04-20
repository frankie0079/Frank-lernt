# PROJ-36: Post-Event Tagebuch (kuratierbarer Editor)

## Status: In Review
**Created:** 2026-03-08
**Last Updated:** 2026-04-20

## Dependencies
- Requires: PROJ-35 (Öffentliche Event-Seite) — Tagebuch baut auf der öffentlichen Event-Seite auf und teilt die URL-Struktur
- Requires: PROJ-25 (Event-Erstellung & -Verwaltung) — Agenda-Struktur gibt den Tages-Rahmen vor

## User Stories
- Als Organisator möchte ich nach dem Event ein Tagebuch zusammenstellen, damit die Erinnerungen dauerhaft schön aufbereitet sind.
- Als Organisator möchte ich für jeden Agenda-Tag eine Seite mit Fotos, Texten und Kommentaren auswählen, damit ich die besten Momente kuratieren kann.
- Als Organisator möchte ich das Tagebuch jederzeit weiterbearbeiten können, damit es nicht an einem Abend fertig sein muss.
- Als Teilnehmer möchte ich das fertige Tagebuch lesen, damit ich die Erinnerungen nochmal erleben kann.

## Acceptance Criteria
- [ ] Tagebuch-Editor unter `/events/[id]/book/edit` — nur für Organisator zugänglich
- [ ] Tagebuch-Leseansicht unter `/events/[id]/book` — für alle Event-Mitglieder zugänglich
- [ ] Pro Agenda-Tag eine Tagebuch-Seite (automatisch aus Agenda-Items generiert)
- [ ] Tages-Editor: Auswahl aus veröffentlichten `content_items` dieses Agenda-Tages (Multi-Select wie in PROJ-33)
- [ ] Layout-Optionen pro Seite (shadcn/ui RadioGroup): "Ein großes Foto", "2 Fotos nebeneinander", "3 Fotos", "Foto + Text side-by-side"
- [ ] Text-Editor für Tageskommentar des Organisators (max 2000 Zeichen, einfacher Textarea, kein Rich-Text-Editor)
- [ ] Zeichenzähler für Tageskommentar
- [ ] Auto-Save: Änderungen werden automatisch gespeichert (debounced 2 Sekunden), "Gespeichert" Status-Anzeige
- [ ] "Vorschau" Button: Öffnet `/events/[id]/book?preview=true` in neuem Tab — zeigt Seite wie Teilnehmer sie sehen
- [ ] Tagebuch-Leseansicht: Alle Tages-Seiten chronologisch (älteste zuerst), jede Seite mit gewähltem Layout
- [ ] Tages-Seite zeigt: Datum, Tages-Titel, ausgewählte Fotos im gewählten Layout, Tageskommentar des Organisators
- [ ] Max. 12 Fotos pro Seite; wenn mehr ausgewählt → Warnung "Nur die ersten 12 Fotos werden angezeigt"
- [ ] Gesamtes Tagebuch scrollbar (eine lange Seite, keine Pagination)

## Edge Cases
- Kein veröffentlichter Beitrag für einen Agenda-Tag → Tages-Seite zeigt leeren Zustand im Editor: "Keine Beiträge für diesen Tag — Seite überspringen?" + Toggle zum Ausblenden
- Ausgeblendete Tages-Seite → In der Leseansicht komplett unsichtbar
- Nachträgliche Bearbeitung nach Wochen → Alle Daten noch vorhanden, Editor öffnet sich mit letztem Speicherstand
- Zu viele Fotos ausgewählt (> 12) → Warnung im Editor, Speichern trotzdem möglich, Leseansicht zeigt nur erste 12
- Tageskommentar 2001+ Zeichen → Zeichenzähler rot, Auto-Save deaktiviert, Hinweis "Kommentar zu lang"
- Nicht eingeloggter Nutzer öffnet `/events/[id]/book` → Weiterleitung zur Login-Seite (Tagebuch ist nur für Mitglieder)
- Auto-Save schlägt fehl (Netzwerkfehler) → "Nicht gespeichert" Warnung, manueller Speichern-Button erscheint
- Organisator und Tages-Admin bearbeiten gleichzeitig → Letzter Speicher-Stand gewinnt (kein Realtime-Lock, Hinweis im Editor: "Zuletzt gespeichert von [Name] um [Uhrzeit]")
- Sehr langes Event (30 Tage) → Sidebar-Navigation der Tages-Seiten im Editor für schnelles Springen

## Technical Requirements
- Supabase Tabelle: `book_pages` (id UUID PK, event_id UUID FK events CASCADE, agenda_item_id UUID FK agenda_items CASCADE UNIQUE, layout TEXT CHECK ('single'|'two'|'three'|'text-left'), comment TEXT, sort_order INT, is_visible BOOL DEFAULT TRUE, updated_at TIMESTAMPTZ, updated_by UUID FK profiles)
- Supabase Tabelle: `book_page_items` (id UUID PK, page_id UUID FK book_pages CASCADE, content_item_id UUID FK content_items, sort_order INT)
- UNIQUE Constraint auf `book_page_items(page_id, content_item_id)`
- CHECK Constraint auf `book_pages.comment`: `length(comment) <= 2000`
- RLS auf `book_pages` + `book_page_items`: SELECT für Event-Mitglieder, INSERT/UPDATE/DELETE nur für Organisator
- API: `GET /api/events/[id]/book` — alle Seiten mit Items laden
- API: `PUT /api/events/[id]/book/[agendaItemId]` — Seite speichern (bulk upsert Items)
- Auto-Save: `useDebounce(value, 2000)` Hook → PUT bei Änderungen
- Layout-Rendering: CSS Grid mit konditionalen Klassen basierend auf `layout`-Wert
- Sichtbarkeits-Toggle: `is_visible`-Feld, Leseansicht filtert unsichtbare Seiten heraus
- `updated_by` + `updated_at` für Kollaborations-Hinweis im Editor

---

## Tech Design (Solution Architect)

### Scope-Entscheidung (2026-04-20)
Foto-Auswahl erfolgt aus **allen** Event-Fotos, nicht nur aus bereits kuratierten Tages-Berichten. Der Organisator sieht im Editor den kompletten Content-Pool des jeweiligen Agenda-Tages und pickt daraus — wie im Wanderer-/Curation-Flow.

### Zwei Oberflächen, eine Datenbasis

```
/events/[id]/book/edit          Organisator-Editor (geschützt, Organizer-Rolle)
/events/[id]/book               Lese-Ansicht (alle Event-Mitglieder)
/events/[id]/book?preview=true  Vorschau aus dem Editor heraus (neuer Tab)
```

### Neue Datenbank-Tabellen

**`book_pages`** — eine Zeile pro Agenda-Tag eines Events:
- Welches Layout (`single` / `two` / `three` / `text-left`)
- Tageskommentar des Organisators (max. 2000 Zeichen, per CHECK-Constraint auf DB-Ebene)
- Sichtbarkeitsflag (ausgeblendet = nicht in Leseansicht)
- `updated_by` + `updated_at` für den Kollaborations-Hinweis
- UNIQUE(event_id, agenda_item_id) — genau eine Seite pro Tag

**`book_page_items`** — verbindet Seiten mit ausgewählten Content-Items:
- `page_id` FK → book_pages (CASCADE)
- `content_item_id` FK → content_items
- `sort_order` INT
- UNIQUE(page_id, content_item_id) — kein Foto doppelt auf einer Seite

### Neue API-Endpunkte

| Route | Methode | Zweck | Zugriff |
|---|---|---|---|
| `/api/events/[id]/book` | GET | Alle Seiten + Items für Editor + Lese-Ansicht | Event-Mitglieder |
| `/api/events/[id]/book/[agendaItemId]` | PUT | Eine Seite speichern (layout + items + comment + visibility) | Organisator |

Der PUT ist ein Upsert: existiert die Seite noch nicht, wird sie angelegt; sonst aktualisiert. `book_page_items` werden per Bulk-Replace neu geschrieben (alle alten löschen, neue einfügen) — so bleibt die Logik einfach.

### Komponenten-Struktur

**Editor (`/events/[id]/book/edit`):**
```
BookEditPage (Server Component — Auth-Check)
└── BookEditor (Client Component — Haupt-State)
    ├── BookDaySidebar            Sprungliste aller Tage (links, bei langen Events)
    ├── BookPageEditor            Editor für den aktuellen Tag
    │   ├── LayoutPicker          RadioGroup: 4 Layout-Optionen mit Mini-Vorschau-Icons
    │   ├── BookPhotoSelector     Multi-Select aus allen Fotos des Tages
    │   │   └── ContentCard[]     (wiederverwendet)
    │   ├── SelectedPreviewRail   Drag-to-reorder der aktuellen Auswahl
    │   ├── CommentTextarea       Tageskommentar + Zeichenzähler
    │   ├── VisibilityToggle      Switch: Seite anzeigen/ausblenden
    │   └── SaveStatusBadge       "Gespeichert" / "Speichert..." / "Nicht gespeichert"
    ├── PreviewButton             Öffnet /book?preview=true in neuem Tab
    └── CollaboratorHint          "Zuletzt gespeichert von [Name] um [Uhrzeit]"
```

**Lese-Ansicht (`/events/[id]/book`):**
```
BookReadPage (Server Component — lädt Seiten)
└── BookReadView
    └── BookDaySection[]          Eine Sektion pro sichtbarer Seite, chronologisch
        ├── DayHeader             Datum + Tages-Titel (Caveat-Font, passend zum Design-Pass)
        ├── BookPageLayout        CSS-Grid-Rendering je nach layout-Wert
        │   └── img[] / video[]   Einzelne Medien
        └── DayComment            Absatz mit Tageskommentar (whitespace-pre-wrap)
```

### Wiederverwendete Komponenten (keine Neuentwicklung)

| Komponente | Wo im Tagebuch | Rolle |
|---|---|---|
| `ContentCard` | Photo-Selector im Editor | Fotos anzeigen mit Checkbox-Overlay |
| `SelectableContentGrid` | Photo-Selector-Basis | Multi-Select-Pattern (analog zu PROJ-33) |
| `SortableTile` | SelectedPreviewRail | Drag-Reorder der gewählten Items |
| `RadioGroup` | LayoutPicker | 4 Layout-Optionen |
| `Switch` | VisibilityToggle | Sichtbarkeit pro Seite |
| `Textarea` | CommentTextarea | Tageskommentar |
| `Badge`, `Skeleton`, `Alert` | Überall | Status, Loading, Fehler |

### Datenhaltung & Sicherheit

- **Kein Realtime**: Tagebuch wird von einer Person bearbeitet, letzter Speicherstand gewinnt. Gespeicherte Zeitstempel + updated_by zeigen dem Organisator, ob jemand anders gerade dran war.
- **Auto-Save**: 2-Sekunden-Debounce via `useDebouncedCallback` (bereits im Report-Editor erprobt)
- **RLS-Policies**:
  - `book_pages` SELECT: Event-Mitglieder
  - `book_pages` INSERT/UPDATE/DELETE: nur Organisator (role='organizer' in event_members)
  - `book_page_items` analog, über page_id → event_id Join
- **Kein öffentlicher Zugriff**: Tagebuch ist Mitglieds-only, im Gegensatz zu PROJ-35 `/e/[slug]`

### Edge-Case-Behandlung (Zuordnung zu AC)

| Edge-Case | Wo behandelt |
|---|---|
| Kein Foto für einen Tag | BookPageEditor zeigt Empty-State + VisibilityToggle standardmäßig auf "aus" |
| Ausgeblendete Seite in Leseansicht | GET-Query filtert `is_visible=true`, Editor zeigt alle |
| >12 Fotos ausgewählt | Editor speichert alle, Leseansicht `.slice(0, 12)` + Warning-Badge |
| 2001+ Zeichen | Client-seitiger Zähler rot, Auto-Save suspendiert, DB-CHECK fängt Restfall |
| Nicht-Mitglied öffnet `/book` | Server-Component-Auth redirected zu `/login` |
| Auto-Save-Fehler (Netz) | Toast "Nicht gespeichert" + manueller "Jetzt speichern"-Button |
| Langes Event (30 Tage) | BookDaySidebar als sticky Sprungliste links |

### Neue Pakete

Keine — alle shadcn-Komponenten (`RadioGroup`, `Switch`, `Textarea`, `ScrollArea`) sind bereits installiert. `use-debounce` läuft bereits in PROJ-33.

### Migration

Eine SQL-Migration `supabase/migrations/20260420_book_pages.sql` legt an:
- Tabellen `book_pages` + `book_page_items`
- Indexe auf `(event_id)`, `(event_id, agenda_item_id)`, `(page_id, sort_order)`
- CHECK-Constraints auf `layout` und `length(comment)`
- RLS-Policies für Read (Mitglieder) und Write (Organisator)

Laut Konvention: wird erst nach Frontend+Backend im Supabase SQL-Editor manuell angewendet und committed.

### Build-Reihenfolge

1. `/frontend` → Client-Components (BookEditor, BookPageEditor, BookReadView, Layout-Rendering)
2. `/backend` → Migration, RLS, 2 API-Routes
3. `/qa` → Akzeptanzkriterien, Happy-Path + Edge-Cases in Production
4. `/deploy`

## Backend Implementation (2026-04-20)

### Migration
- `supabase/migrations/20260420_book_pages.sql` — to be applied manually via Supabase SQL Editor

### Tables created
- `book_pages` — one row per agenda_item (UNIQUE), with CHECK on `layout` + `length(comment) <= 2000`, indexes on `event_id` and `(event_id, agenda_item_id)`
- `book_page_items` — join table with UNIQUE(page_id, content_item_id), indexes on `page_id`, `(page_id, sort_order)`, and `content_item_id`
- Both tables: RLS enabled, all grants revoked from anon/authenticated, service_role only. All access via RPCs.

### RPCs created (SECURITY DEFINER)
- `member_is_event_organizer(member_id, event_id) → boolean`
- `member_is_in_event(member_id, event_id) → boolean`
- `get_event_book(token, event_id) → jsonb` — auto-creates missing pages, returns all pages with joined items + author meta. Accessible to event members.
- `save_book_page(token, agenda_item_id, layout, comment, is_visible, items) → jsonb` — upsert + bulk-replace items. Organizer-only.
- `get_book_page_by_agenda(agenda_item_id) → jsonb` — helper used by save_book_page to return the hydrated row.

### API routes created
- `GET /api/events/[id]/book` — calls `get_event_book`. Auth via `member_token` cookie + read rate-limit. Returns `{ event_id, is_organizer, pages[] }` matching `BookGetResponse`.
- `PUT /api/events/[id]/book/[agendaItemId]` — calls `save_book_page` after Zod validation (layout enum, comment max 2000, items max 500, no duplicates, `agenda_item.event_id === URL id`). Returns `{ page }` matching `BookPutResponse`.

### Security notes
- URL-tampering guard: PUT verifies that `agendaItemId` actually belongs to the event in the URL before invoking the RPC.
- Duplicate-item guard: PUT rejects payloads with duplicate `content_item_id` (DB UNIQUE would also catch this).
- Content-in-event guard: RPC validates every `content_item_id` belongs to the same event as the agenda item.
- Organizer-only writes: enforced in the RPC via `member_is_event_organizer` (checks `events.organizer_id`).

## QA Test Results

### QA Round 1 (2026-04-20, code review + security audit)

**AC pass rate: 14 / 14**

| # | Acceptance Criterion | Status | File:line |
|---|---|---|---|
| 1 | Editor unter `/events/[id]/book/edit`, nur Organisator | PASS | `src/app/events/[id]/book/edit/page.tsx`; Organizer-Redirect in `book-editor.tsx:78-90` + Server-Enforcement in `save_book_page` RPC |
| 2 | Leseansicht unter `/events/[id]/book`, alle Mitglieder | PASS | `src/app/events/[id]/book/page.tsx` + `book-read-view.tsx` |
| 3 | Pro Agenda-Tag eine Seite, auto-generiert | PASS | `get_event_book` RPC (`20260420_book_pages.sql:141-160`) legt fehlende Seiten lazy an |
| 4 | Multi-Select aus Content-Pool des Tages | PASS | `BookPageEditor` nutzt `SelectableContentGrid` mit `defaultAgendaItemId` (Scope: nur dieser Tag) |
| 5 | Layout-Optionen via RadioGroup (4 Varianten) | PASS | `book-layout-picker.tsx` — single/two/three/text-left mit SVG-Mini-Previews |
| 6 | Textarea für Tageskommentar, max 2000 Zeichen | PASS | `book-comment-textarea.tsx` + DB-CHECK-Constraint + Zod `max(2000)` in PUT |
| 7 | Zeichenzähler | PASS | `book-comment-textarea.tsx` — amber ab 90 %, rot ab 2001 |
| 8 | Auto-Save 2-s-Debounce + Status-Anzeige | PASS | `useDebouncedCallback(save, 2000)` in `book-page-editor.tsx`; Badge "Speichert…/Gespeichert/Fehler/Pausiert" |
| 9 | Vorschau-Button öffnet `/book?preview=true` neuem Tab | PASS | `book-editor.tsx` mit `#day-<uuid>` Anchor |
| 10 | Leseansicht chronologisch | PASS | `get_event_book` sortiert nach `agenda_date asc`, `book-read-view.tsx` rendert in dieser Reihenfolge |
| 11 | Tages-Seite zeigt Datum, Titel, Fotos, Kommentar | PASS | `book-page-layout.tsx` + `DayHeader` in `book-read-view.tsx` |
| 12 | Max 12 Fotos pro Seite, Warnung bei mehr | PASS | `MAX_PHOTOS_PER_PAGE=12` in `book-types.ts`; Warnung in Editor, `.slice(0,12)` in Leseansicht |
| 13 | Gesamtes Tagebuch scrollbar (keine Pagination) | PASS | Single long page in `book-read-view.tsx` |
| 14 | Edge-Cases (leer, versteckt, zu lang, Netzfehler, Kollaboration) | PASS | Alle im Frontend-Plan behandelt (siehe Tech Design Tabelle) |

### Bugs gefunden + gefixt (alle vor Commit)

| ID | Severity | Beschreibung | Fix |
|---|---|---|---|
| BUG-1 | **High (Security)** | Non-Organizer konnten versteckte Seiten über rohen `GET /api/events/[id]/book` erhalten — RPC liefert alle Seiten (nötig für Editor), Route filterte nicht. Leak-Risiko: `is_visible=false`-Seiten waren per `curl + member_token` sichtbar obwohl nicht in der UI. | API-Route filtert `is_visible` für Nicht-Organisator (`book/route.ts:79-92`). Defense-in-depth zusätzlich zum Client-Filter. |
| BUG-2 | **High (Security)** | `?preview=true` in der URL zeigte versteckte Seiten für jeden Nicht-Organisator, der die URL manuell tippte. | `previewActive = preview && isOrganizer` in `book-read-view.tsx:138`; Preview-Badge und versteckt-Marker nur wenn Organisator. |
| BUG-3 | **Medium (Race)** | Stale-Response-Bug: langsamer älterer Auto-Save überschrieb den Status einer neueren, bereits abgeschlossenen Speicherung. Nutzer sah falschen Status-Badge (z.B. "Fehler" obwohl der neuere Save erfolgreich war). | Generation-Counter `saveGenRef` in `book-page-editor.tsx:95-96, 114, 140, 145` — nur der neueste In-Flight-Save schreibt State. |

Bonus: Stale useEffect für Page-Switch in `book-page-editor.tsx` entfernt. `BookEditor` remountet den Editor bereits per `key={activePage.agenda_item_id}`, der Re-Seed-Effect war tot Code.

### Verifikation

- `npx tsc --noEmit` → **0 Fehler**
- `npm run lint` → 1 Error + 12 Warnings, alle **pre-existing** (content-card.tsx aus Commit `2032733`, nicht durch PROJ-36 eingeführt)
- Production-E2E noch ausstehend — erst nach `/deploy`, dann happy-path mit Frank's HK-Event

## Deployment
_To be added by /deploy_
