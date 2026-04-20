# PROJ-36: Post-Event Tagebuch (kuratierbarer Editor)

## Status: In Progress
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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
