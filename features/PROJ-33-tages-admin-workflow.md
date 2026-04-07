# PROJ-33: Tages-Admin Kurations-Workflow

## Status: In Review
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

**Tester:** QA Engineer (Claude)
**Date:** 2026-04-07
**Scope:** Code review of migration, API routes, RPCs, and React components. Production REST probe against live Vercel URL. Full E2E happy-path smoke test with a seeded organizer token was NOT executed from the sandbox because no `SUPABASE_SERVICE_ROLE_KEY` is available in `.env.local`; Frank must run the happy-path once manually against production before `/deploy` signs off.

### Production Schema Verification (Step 2b)
- `daily_reports` → HTTP 401 `permission denied for table daily_reports` — table exists, direct PostgREST correctly locked. PASS
- `report_items` → HTTP 401 `permission denied for table report_items` — table exists, locked. PASS
- `agenda_items(admin_member_id, event_id, date, sort_order)` → HTTP 200 — all columns referenced by `list_event_reports` RPC exist. PASS
- `events(organizer_id)` → HTTP 200 — column referenced by helper RPC exists. PASS
- `GET https://frank-lernt.vercel.app/api/events/<uuid>/reports` without cookie → HTTP 401 `Nicht angemeldet`. Endpoint deployed. PASS

No schema drift detected.

### Acceptance Criteria

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 1 | Kurations-Interface unter `/events/[id]/admin/[agendaItemId]` | PASS | Page exists, uses `ReportEditor` |
| 2 | Zugriff nur fuer zugewiesenen Admin + Organisator (serverseitig) | PASS | `member_can_curate_report()` RPC checks `agenda_items.admin_member_id` OR `events.organizer_id`; all write RPCs gated |
| 3 | Multi-Select mit Checkbox-Overlay oben-links | PASS | `SelectableContentGrid` + checkbox overlay on each card |
| 4 | Zaehler "X von Y ausgewaehlt" in Toolbar | PARTIAL / BUG-2 | Counter exists, but Y is only a lower-bound estimate (first page of 100 content items). For events with >100 items Y is wrong |
| 5 | Sektion "Ausgewaehlt" als Vorschau-Kacheln | PASS | `SelectedItemsRail` |
| 6 | Drag & Drop der Auswahl (`@dnd-kit`) | PASS | `@dnd-kit/sortable` in use |
| 7 | D&D funktioniert auf Touch (langer Tap = Drag) | PARTIAL / BUG-4 | `TouchSensor` configured with **200ms** delay — spec calls for "langer Tap" and tech design specifies **400ms**. Minor UX deviation |
| 8 | Vorschau-Button (Read-Only Sheet) | PASS | `ReportPreviewSheet` |
| 9 | "Als Entwurf speichern" / Auto-Save debounced 2s | PASS | `useDebouncedCallback(..., 2000)` in `report-editor.tsx` |
| 10 | "Veroeffentlichen"-Toggle + Bestaetigungs-Dialog | PASS | `AlertDialog` in `CurationToolbar` |
| 11 | Published → Draft zuruecksetzbar ohne Datenverlust | PASS | `toggle_report_publish(..., false)` keeps `report_items` intact |
| 12 | Status-Anzeige draft/published + published_at | PASS | Shown in toolbar + overview rows |
| 13 | Organisator-Uebersicht `/events/[id]/admin` mit Status/Anzahl/Last-Update | PASS | `AdminOverviewPage` + `list_event_reports` RPC |

### Edge Cases

| Edge Case | Result | Notes |
|-----------|--------|-------|
| Keine Auswahl → Publish disabled + Hinweis | PASS | Backend `no_items` error + Switch disabled when `selectedCount===0` |
| Admin-Zuweisung waehrend aktivem Kurieren geaendert → alter Admin 401 bei Save | PASS | `member_can_curate_report` re-checks on every PUT |
| Published wird bearbeitet → automatisch Draft | PASS | `save_report_items` demotes to draft, toast warning shown |
| Offline → Auswahl in localStorage sichern | **FAIL / BUG-1** | No `localStorage` backup at all. `useOnlineStatus` only **blocks** saves while offline; selection changes made offline are held in React state only and lost on refresh/navigation |
| Beitrag im Pool geloescht waehrend ausgewaehlt → ausgegraut | PASS | `report_items.content_item_id` has `on delete restrict` — but see **BUG-3** |
| Zwei Editoren gleichzeitig → letzter gewinnt | PASS | No lock, save_report_items does delete+insert |
| Touch Targets min 44px | PASS | sortable tiles sized appropriately |
| >50 Items im Pool → Infinite Scroll | NOT VERIFIED | `SelectableContentGrid` reuses content-pool logic but pagination not checked end-to-end; see **BUG-2** |

### Bugs Found

**BUG-1 (High): Offline-Buffer in localStorage fehlt komplett**
- AC: "Offline → Letzte Auswahl lokal in `localStorage` sichern, beim Reconnect mit Server synchronisieren"
- Actual: Kein `localStorage`-Zugriff in `report-editor.tsx`, `curation-toolbar.tsx`, `selected-items-rail.tsx` oder den Admin-Pages. Beim Offline-Gehen wird `performSave` einfach uebersprungen, Selection lebt nur in React-State. Refresh/Navigation → Datenverlust.
- Repro: DevTools → Offline → Beitraege auswaehlen → Seite neu laden → Auswahl weg.
- Severity: **High** — dokumentiertes AC + Datenverlust-Risiko.
- Priority: Fix before deploy.

**BUG-2 (Medium): Selection-Counter "X von Y" zeigt falsche Gesamtzahl**
- AC: "Zaehler X von Y Beitraegen ausgewaehlt"
- Actual: `report-editor.tsx` Zeile 151–168 holt nur die erste Seite (`?limit=100`) und nimmt `data.content_items.length` als Total. Bei >100 Items ist Y zu niedrig. `effectiveTotal = Math.max(totalCount, selectedIds.length)` kann Y nie ueber 100 hinaus wachsen lassen, ausser man hat bereits >100 selektiert.
- Repro: Event mit 150 Content-Items → Kurations-Screen → Zaehler zeigt "0 von 100" statt "0 von 150".
- Severity: **Medium** — UX-irrefuehrend, kein Datenverlust.
- Priority: Fix before deploy.

**BUG-3 (Medium): Spec-Drift — `report_items.content_item_id` hat `ON DELETE RESTRICT` statt Orphan-Markierung**
- Tech Design: "`report_items` hat kein CASCADE auf `content_items`. Beim Laden werden fehlende Items als `{ deleted: true }` markiert."
- Actual (migration Zeile 32): `content_item_id uuid not null references public.content_items(id) on delete restrict` → Loeschen eines Content-Items, das in einem Report liegt, schlaegt mit FK-Violation fehl (23503). UI-Grey-Out-Pfad ist daher toter Code. Authoren koennen ihre eigenen Inhalte nicht mehr loeschen, sobald sie in einem Bericht verwendet wurden.
- Repro: Content-Item in Bericht auswaehlen → Autor loescht das Item via Content-Pool → DELETE schlaegt fehl.
- Severity: **Medium** — Produktverhalten weicht vom Tech Design ab, kann Nutzer blockieren.
- Priority: Fix before deploy. Entweder `on delete set null` + `deleted=true` im RPC, oder CASCADE.

**BUG-4 (Low): Touch-Drag-Delay 200ms statt 400ms**
- Tech Design: "Touch-Aktivierung: langer Tap (400ms Delay)"
- Actual: `selected-items-rail.tsx`: `TouchSensor { activationConstraint: { delay: 200, tolerance: 5 } }`
- Severity: **Low** — funktional OK, Drama nur in schlechten Scroll-Situationen.
- Priority: Fix or explicitly waive.

**BUG-5 (Low): `list_event_reports` RPC — fragwuerdige `jsonb_agg(row ORDER BY row.date ...)` Syntax**
- Migration Zeile 126–147 aggregiert ueber eine Subquery `row` mit `jsonb_agg(row order by row.date asc, row.sort_order asc)`. Die Subquery-Name-Kollision mit Postgres `ROW`-Keyword ist riskant und nur halbwegs portabel.
- Nicht verifizierbar ohne E2E-Call (alle Probes enden bei Auth-Check vor dem Aggregat). Frank muss den Happy-Path einmal manuell ausfuehren um auszuschliessen, dass der RPC zur Laufzeit bricht.
- Severity: **Low** (potenzielles Laufzeitrisiko)
- Priority: Verify in production smoke test. If RPC errors at runtime, upgrade to **Critical**.

### Security Audit (Red Team)

| Vector | Result | Notes |
|--------|--------|-------|
| Unauthenticated access | PASS | All three routes return 401 without `member_token` cookie |
| Cross-event access (organizer of event A tries event B) | PASS (code review) | RPCs resolve `event_id` from `agenda_item_id`, `member_can_curate_report` checks `admin_member_id` OR `events.organizer_id` strictly. Not runtime-verified — see note |
| Cross-event content injection in PUT body | PASS | `save_report_items` validates every `content_item_id` belongs to the agenda item's event (`content_not_in_event` error) |
| Direct PostgREST writes to `daily_reports` / `report_items` | PASS | Table-level `revoke all` for anon + authenticated. Verified via 401 probe |
| Invalid UUID injection in path | PASS | All routes run `isValidUUID` first |
| XSS via content titles/captions in preview | NOT VERIFIED | `ReportPreviewSheet` not read in this pass. Frank should verify captions are escaped (React auto-escapes by default, so likely safe) |
| Rate limiting | PASS | All three routes call `isRateLimited` |
| Duplicate content_item_id in PUT payload | PASS | Route rejects before RPC |
| Error leakage | PASS | `serverError()` helper used, no raw Postgres messages returned |
| Token/session leakage in responses | PASS | No token fields returned |

### Regression Check

Touched surfaces only add new tables, new RPCs, new routes, and new pages. No existing migration, API route, or shared component was modified (git diff shows only additions). PROJ-24/25/26/27/28/29/30/31/32 are not at risk. Spot-check recommended:
- Content-Pool still loads (`/events/[id]/pool`) — re-checked via route file presence, unchanged
- Comments/reactions APIs unchanged — unchanged

### Production-Ready Recommendation: **NOT READY**

**Blockers:**
1. BUG-1 (High) — Offline-Buffer fehlt
2. BUG-2 (Medium) — falscher Counter
3. BUG-3 (Medium) — ON DELETE RESTRICT widerspricht Tech-Design und blockiert Content-Loeschung
4. BUG-5 verification — happy-path E2E muss gegen Production laufen (nicht moeglich im Sandbox, keine SERVICE_ROLE_KEY). Frank muss mindestens einmal einen kompletten Flow durchspielen (Event → Agenda → Content → Kuratieren → Publish → Unpublish) und screenshoten.
5. BUG-4 kann optional zusammen mit den anderen Fixes mitgenommen werden (CLAUDE.md: "Fix ALL bugs before deploy").

**Next step:** Run `/frontend` + `/backend` to fix BUG-1 through BUG-4, then re-run `/qa` including a manual production happy-path by Frank.

## QA Round 2 — Fixes (2026-04-07)

Fixed all 5 bugs from the first QA round:

- **BUG-1 (High) — Offline draft persistence + reconnect sync:** `report-editor.tsx` now persists every selection/reorder change to `localStorage` under `proj33-report-draft-${agendaItemId}` while offline. New `SaveState` value `"offline-pending"` shows "Offline — Änderungen lokal gespeichert" in the toolbar. On reconnect (offline→online), the editor automatically flushes the stored draft via `performSave` and toasts "Offline-Änderungen synchronisiert". `content_not_in_event` RPC errors during sync surface "Einige Offline-Änderungen konnten nicht synchronisiert werden" and reload from server. Helpers: `loadDraftFromStorage` / `saveDraftToStorage` / `clearDraftFromStorage`.
- **BUG-2 (Medium) — Counter "X von Y" capped at 100:** `/api/events/[id]/content` now returns `total_count` via `.select(..., { count: "exact" })`. `report-editor.tsx` requests `?limit=1` and reads `total_count`. The `Math.max(totalCount, selectedIds.length)` band-aid removed.
- **BUG-3 (Medium) — `report_items` ON DELETE RESTRICT violated tech design:** New migration `supabase/migrations/20260407_fix_report_items.sql` makes `content_item_id` nullable, changes the FK to `ON DELETE SET NULL`, and rewrites `save_report_items` (dollar tag `$fn_save_v2$`) so the delete step only removes rows where `content_item_id is not null`, preserving null-marker "deleted" tiles across saves.
- **BUG-4 (Low) — Touch-drag delay too short:** `selected-items-rail.tsx` `TouchSensor.activationConstraint.delay` raised from 200ms to 400ms.
- **BUG-5 (Low) — `list_event_reports` used risky `row` alias:** Same migration file includes a v2 `list_event_reports` (dollar tag `$fn_list_v2$`) with subquery alias renamed from `row` to `r_agg`.

Build: `npm run build` passes. Migration `20260407_fix_report_items.sql` is pending manual application via Supabase SQL editor.

## Deployment
_To be added by /deploy_
