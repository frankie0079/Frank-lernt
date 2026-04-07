# PROJ-33: Tages-Admin Kurations-Workflow

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-28 (Content-Pool) — Inhalte werden aus dem Content-Pool kuratiert
- Requires: PROJ-25 (Event-Erstellung & -Verwaltung) — Agenda-Punkte und Admin-Zuweisung kommen aus dem Event

## User Stories
- Als Tages-Admin möchte ich aus dem Content-Pool auswählen, welche Beiträge in den Tagesbericht kommen, damit nur die besten Momente veröffentlicht werden.
- Als Tages-Admin möchte ich die Reihenfolge der ausgewählten Beiträge per Drag & Drop anpassen, damit der Bericht eine gute Dramaturgie hat.
- Als Tages-Admin möchte ich den kuratierten Bericht zur Landing Page freigeben, damit Follower ihn sehen können.
- Als Organisator möchte ich sehen, welche Tagesberichte bereits erstellt und veröffentlicht wurden.

## Acceptance Criteria
- [ ] Kurations-Interface unter `/events/[id]/admin/[agendaItemId]`
- [ ] Zugriff nur für: zugewiesenen Tages-Admin des Agenda-Eintrags + Organisator (serverseitige Prüfung)
- [ ] Multi-Select-Modus: Beiträge durch Antippen auswählen (Checkbox-Overlay oben links auf jeder Karteikarte)
- [ ] Ausgewählte Beiträge: Zähler "X von Y Beiträgen ausgewählt" in der oberen Leiste
- [ ] Eigene Sektion "Ausgewählt" zeigt alle markierten Beiträge als kleinere Vorschau-Kacheln
- [ ] Drag & Drop Reihenfolge der ausgewählten Beiträge (via `@dnd-kit/core` oder `react-beautiful-dnd`)
- [ ] Drag & Drop funktioniert auf Touch-Geräten (langer Tap = Drag-Aktivierung)
- [ ] Vorschau-Button: "Vorschau anzeigen" öffnet Read-Only-Ansicht des Berichts wie er auf der Landing Page erscheint
- [ ] "Als Entwurf speichern" Button (auto-save bei jeder Änderung, debounced 2s)
- [ ] "Auf Landing Page veröffentlichen" Toggle mit Bestätigungs-Dialog "Tagesbericht für alle Follower sichtbar machen?"
- [ ] Toggle zurückstellen möglich (published → draft) ohne Datenverlust
- [ ] Status-Anzeige: `draft` | `published` mit Datum/Uhrzeit der letzten Veröffentlichung
- [ ] Organisator-Übersicht aller Tagesberichte unter `/events/[id]/admin` (Status, Anzahl Beiträge, Letztes Update)

## Edge Cases
- Kein Beitrag ausgewählt → "Speichern" und "Veröffentlichen" Button deaktiviert, Hinweis "Mindestens 1 Beitrag auswählen"
- Admin-Zuweisung wird während aktivem Kurations-Vorgang geändert → Neuer Admin sieht den Entwurf des Vorgängers unverändert, Vorgänger verliert Schreibzugriff (401 bei nächstem Save-Versuch)
- Veröffentlichter Bericht wird erneut bearbeitet → Status wechselt automatisch zu `draft`, Bestätigungs-Hinweis "Bericht wird von der Landing Page entfernt bis du ihn erneut veröffentlichst"
- Offline → Letzte Auswahl lokal in `localStorage` sichern, beim Reconnect mit Server synchronisieren
- Beitrag im Content-Pool wird gelöscht während er im Bericht ausgewählt ist → Bericht-Eintrag wird als "nicht mehr verfügbar" markiert (ausgegraut), nicht aus Bericht entfernt
- Organisator bearbeitet Tagesbericht des Admins → Admin sieht keine Konflikts-Meldung (kein Echtzeit-Lock), letzter Speicher-Stand gewinnt
- Drag & Drop auf kleinem iPhone-Screen → Touch-Target min. 44px, lange Kacheln für gute Greifbarkeit
- Mehr als 50 Beiträge im Content-Pool → Infinite Scroll auch im Kurations-Interface

## Technical Requirements
- Supabase Tabelle: `daily_reports` (id UUID PK, event_id UUID FK events CASCADE, agenda_item_id UUID FK agenda_items CASCADE UNIQUE, status TEXT CHECK ('draft'|'published'), published_at TIMESTAMPTZ, created_by UUID FK profiles, updated_at TIMESTAMPTZ)
- Supabase Tabelle: `report_items` (id UUID PK, report_id UUID FK daily_reports CASCADE, content_item_id UUID FK content_items, sort_order INT, created_at TIMESTAMPTZ)
- UNIQUE Constraint auf `report_items(report_id, content_item_id)`
- RLS auf `daily_reports`: SELECT für Event-Mitglieder, INSERT/UPDATE für Admin + Organisator
- RLS auf `report_items`: SELECT für Event-Mitglieder, INSERT/UPDATE/DELETE für Admin + Organisator
- API: `GET /api/events/[id]/reports/[agendaItemId]` — Bericht mit Items laden
- API: `PUT /api/events/[id]/reports/[agendaItemId]` — Items + Reihenfolge speichern (bulk upsert)
- API: `PATCH /api/events/[id]/reports/[agendaItemId]/publish` — Status togglen
- Auto-Save: Client-seitiger `useDebounce` Hook (2000ms), PUT bei jeder Änderung
- Drag & Drop: `@dnd-kit/sortable` + `@dnd-kit/core` (bereits in modernem Next.js nutzbar)
- Sort-Order: Integer-Werte mit 10er-Schritten (10, 20, 30 ...), um späteres Einfügen ohne Re-Nummerierung zu ermöglichen

---

## Tech Design (Solution Architect)

### Übersicht

Zwei neue Seiten + ein Kurations-Editor. Der Tages-Admin wählt aus dem vorhandenen Content-Pool aus, ordnet per Drag & Drop, speichert automatisch und veröffentlicht auf die Landing Page.

### Seiten-Struktur

```
/events/[id]/admin                      ← Organisator-Übersicht
+-- AdminOverviewPage
    +-- AgendaReportList
    |   +-- AgendaReportRow (pro Tag)
    |       +-- StatusBadge (draft | published | leer)
    |       +-- ItemCountBadge ("7 Beiträge")
    |       +-- LastUpdatedTimestamp
    |       +-- "Kuratieren"-Link → /admin/[agendaItemId]
    +-- EmptyState ("Noch keine Tagesberichte")

/events/[id]/admin/[agendaItemId]       ← Kurations-Interface
+-- ReportEditorPage
    +-- CurationToolbar
    |   +-- SelectionCounter ("3 von 12 ausgewählt")
    |   +-- AutoSaveIndicator ("Gespeichert" / "Speichert…" / "Fehler")
    |   +-- PreviewButton → ReportPreviewSheet
    |   +-- PublishToggle → PublishConfirmDialog
    +-- SelectedItemsSection (oben, nur sichtbar wenn ≥1 ausgewählt)
    |   +-- SortableTileGrid
    |       +-- SortableTile (Vorschau-Kachel, draggable)
    +-- ContentPoolSelectable (wiederverwendet bestehende ContentPool-Logik)
        +-- ContentFilterBar (vorhanden, wiederverwenden)
        +-- ContentCard (vorhanden) + CheckboxOverlay (neu, oben-links)

+-- ReportPreviewSheet (Sheet, Read-Only)
+-- PublishConfirmDialog (AlertDialog)
+-- DraftWarningBanner (wenn published → bearbeitet wird)
```

### Datenhaltung

**Neue Datenbank-Tabellen:**

```
daily_reports
  id              UUID (PK)
  event_id        UUID → events (CASCADE DELETE)
  agenda_item_id  UUID → agenda_items (CASCADE DELETE, UNIQUE)
  status          TEXT ("draft" | "published")
  published_at    TIMESTAMPTZ (null wenn draft)
  created_by      UUID → members
  updated_at      TIMESTAMPTZ

report_items
  id              UUID (PK)
  report_id       UUID → daily_reports (CASCADE DELETE)
  content_item_id UUID → content_items (kein CASCADE — gelöschte Items grau markieren)
  sort_order      INT (10, 20, 30 … Lücken für späteres Einfügen ohne Re-Nummerierung)
  created_at      TIMESTAMPTZ
  
  UNIQUE(report_id, content_item_id)
```

**Client-State während Kuratierung:**
- `selectedIds`: Set von content_item_ids (welche angehakt)
- `sortedOrder`: Array von content_item_ids (Drag & Drop-Reihenfolge)
- `isDirty`: Boolean (ungespeicherte Änderungen vorhanden)
- `offlineBuffer`: localStorage-Backup der aktuellen Auswahl (Offline-Fallback)

### API-Routen (neu)

| Route | Methode | Wer | Was |
|-------|---------|-----|-----|
| `/api/events/[id]/reports` | GET | Organisator | Alle Tagesberichte für Event laden (Übersicht) |
| `/api/events/[id]/reports/[agendaItemId]` | GET | Admin + Organisator | Bericht + Items + Content-Details laden |
| `/api/events/[id]/reports/[agendaItemId]` | PUT | Admin + Organisator | Items + Reihenfolge bulk-speichern |
| `/api/events/[id]/reports/[agendaItemId]/publish` | PATCH | Admin + Organisator | Status toggling (draft ↔ published) |

**Zugriffskontrolle:** SECURITY DEFINER PostgreSQL-Funktionen (gleiche Architektur wie PROJ-31/32). Token aus Cookie → Member-ID → Prüfung ob Admin dieses Agenda-Eintrags oder Organisator. Direkter PostgREST-Zugriff auf `daily_reports` und `report_items` gesperrt.

### Auto-Save

Benutzer wählt/sortiert → isDirty = true → 2s Debounce → PUT Request → "Gespeichert ✓". Publish-Aktion erzwingt sofortiges Speichern (kein Warten auf Debounce).

### Drag & Drop

- Library: `@dnd-kit/sortable` (Touch-Support eingebaut, kein zusätzlicher Wrapper nötig)
- Nur im SelectedItemsSection (nicht im Content-Pool)
- Touch-Aktivierung: langer Tap (400ms Delay) für iPhone-Kompatibilität
- Touch-Targets: Kacheln mind. 44×44px

### Publish-Flow

1. Admin tippt "Veröffentlichen" → PublishConfirmDialog
2. Bestätigung → PATCH → status = "published", published_at = now()
3. Bericht erneut bearbeiten → DraftWarningBanner → Auto-Save setzt status = "draft"
4. Erneutes "Veröffentlichen" nötig

### Gelöschter Beitrag (Edge Case)

`report_items` hat kein CASCADE auf `content_items`. Beim Laden werden fehlende Items als `{ deleted: true }` markiert — UI zeigt ausgegraut "Nicht mehr verfügbar", kein automatisches Entfernen.

### Wiederverwendete Komponenten

| Komponente | Nutzung |
|------------|---------|
| `content-card.tsx` | Im Pool mit Checkbox-Overlay erweitern |
| `content-pool.tsx` | Selectable-Variante ableiten |
| `content-filter-bar.tsx` | Unverändert weiterverwenden |
| `AlertDialog`, `Sheet`, `Badge`, `Switch` (shadcn) | Vorhanden, direkt nutzen |

### Neue Dependencies

| Package | Zweck |
|---------|-------|
| `@dnd-kit/core` | Drag & Drop Kern-Engine |
| `@dnd-kit/sortable` | Sortierbare Listen |
| `@dnd-kit/utilities` | CSS-Hilfsfunktionen |
| `use-debounce` | Auto-Save Debounce Hook |

### Build-Reihenfolge

1. Backend — Tabellen, RLS, SECURITY DEFINER RPCs, API-Routen
2. Frontend — Übersichtsseite → Kurations-Interface → Auto-Save → Publish-Flow
3. QA — gegen Production testen

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
