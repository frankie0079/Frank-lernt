# PROJ-36: Post-Event Tagebuch (kuratierbarer Editor)

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
