# PROJ-32: Kommentar-Threads

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-04-07

## Dependencies
- Requires: PROJ-28 (Content-Pool) — Kommentare gehören zu Content-Items im Content-Pool

## User Stories
- Als Nutzer möchte ich einen Kommentar zu einem Beitrag schreiben, damit ich gezielt auf Inhalte eingehen kann.
- Als Nutzer möchte ich alle Kommentare zu einem Beitrag sehen, damit ich den Austausch verfolgen kann.
- Als Autor möchte ich meinen eigenen Kommentar löschen können, falls mir etwas peinlich ist.

## Acceptance Criteria
- [ ] Kommentar-Icon (Sprechblase) mit Anzahl-Badge auf jeder Karteikarte im Content-Pool
- [ ] Badge zeigt Gesamtanzahl der Kommentare; bei 0 wird nur das Icon ohne Zahl angezeigt
- [ ] Tap auf Icon → Kommentar-Thread öffnet sich als Bottom Sheet (Mobile) oder als Inline-Expand (Desktop)
- [ ] Kommentar-Eingabe: Textarea (max 500 Zeichen), Zeichenzähler, Abschicken-Button (Papierflugzeug-Icon)
- [ ] Abschicken-Button deaktiviert wenn Textarea leer oder nur Leerzeichen
- [ ] Liste aller Kommentare: Avatar, Anzeigename, Text, Zeitstempel (relativ: "vor 3 Min.")
- [ ] Eigene Kommentare zeigen Löschen-Button (Swipe-to-Delete auf Mobile, Papierkorb-Icon auf Desktop)
- [ ] Neue Kommentare erscheinen live ohne Reload (Supabase Realtime auf `comments` Tabelle)
- [ ] Organisator + Tages-Admin können alle Kommentare löschen (Moderations-Funktion)
- [ ] Löschen ohne Bestätigungs-Dialog (schnelles Moderieren), aber mit Undo-Toast ("Kommentar gelöscht — Rückgängig" 5s)
- [ ] Kommentare sind auch auf der öffentlichen Event-Seite lesbar (aber nur Mitglieder können kommentieren)
- [ ] Eingabe-Feld ist nur für eingeloggte Mitglieder sichtbar

## Edge Cases
- 0 Kommentare → Placeholder "Noch kein Kommentar — sei der Erste!" in der Thread-Ansicht
- Kommentar besteht nur aus Leerzeichen → Abschicken-Button bleibt deaktiviert (client + server trim-Prüfung)
- Kommentar > 500 Zeichen → Zeichenzähler wird rot, Abschicken-Button deaktiviert
- Sehr langer Kommentar ohne Zeilenumbrüche (eine Zeile, 500 Zeichen) → CSS `word-break: break-all` verhindert Layout-Overflow
- Mehr als 50 Kommentare → Initial 20 laden, Pagination ("Ältere Kommentare laden" Button oben)
- Beitrag wird während geöffnetem Thread gelöscht → Thread schließt sich, Toast "Beitrag wurde gelöscht"
- Nicht eingeloggter Nutzer versucht zu kommentieren → Toast "Bitte melde dich an" + Login-Link
- Gleichzeitig kommentierende Nutzer → Kein Konflikt, Realtime liefert beide Kommentare korrekt
- Offline beim Absenden → Fehlermeldung "Kein Internet — Kommentar konnte nicht gespeichert werden", kein lokaler Queue (Kommentare sind nicht kritisch genug)
- Sehr viele Kommentare in kurzer Zeit (Spam) → Rate-Limiting greift (5 Kommentare pro Minute pro Nutzer)

## Technical Requirements
- Supabase Tabelle: `comments` (id UUID PK, content_item_id UUID FK content_items CASCADE, author_id UUID FK profiles, text TEXT NOT NULL, created_at TIMESTAMPTZ)
- CHECK Constraint: `length(text) BETWEEN 1 AND 500`
- RLS auf `comments`: SELECT für Event-Mitglieder + öffentliche Event-Seite, INSERT für authentifizierte Mitglieder, DELETE für Eigentümer + Admin + Organisator
- API: `GET /api/events/[id]/content/[itemId]/comments?cursor=&limit=20` — Zod-validiert
- API: `POST /api/events/[id]/content/[itemId]/comments` (text im Body, max 500 Zeichen) — Zod-validiert
- API: `DELETE /api/events/[id]/content/[itemId]/comments/[commentId]`
- Supabase Realtime: `supabase.channel('comments-[itemId]').on('postgres_changes', ...)` auf `comments` INSERT/DELETE
- Rate-Limiting: 5 Kommentare pro Minute pro User-ID (in-memory, nach User-ID)
- Undo-Mechanismus: Client-seitig gespeicherter Kommentar (60s), DELETE erst nach Toast-Ablauf oder bei explizitem Bestätigen
- Bottom Sheet: shadcn/ui `Sheet` Komponente (bereits installiert)

---

## Tech Design (Solution Architect)

### Übersicht
Additives Feature auf bestehenden Content-Karten — gleicher Pattern wie PROJ-31 (Reactions). Sprechblasen-Badge oben in der Karte, Klick öffnet ein Bottom Sheet (Mobile) bzw. Inline-Expand (Desktop) mit Thread + Eingabefeld.

### Component Structure

```
ContentCard (bestehend)
+-- [bestehend] Inhalt + ReactionBar (PROJ-31)
+-- CommentBadge (NEU — src/components/comment-badge.tsx)
    +-- Sprechblasen-Icon
    +-- Anzahl-Badge (versteckt bei 0)
    +-- onClick → öffnet CommentThreadSheet

CommentThreadSheet (NEU — src/components/comment-thread-sheet.tsx)
+-- Header: "Kommentare (N)"
+-- "Ältere laden"-Button (oben, ab > 20)
+-- CommentList
|   +-- CommentRow × N
|       +-- Avatar + Anzeigename
|       +-- Text (word-break: break-all)
|       +-- Zeitstempel relativ
|       +-- [eigenes / Organisator / Admin] Löschen-Button
+-- CommentInput (nur eingeloggte Mitglieder)
    +-- Textarea (max 500, Zeichenzähler)
    +-- Senden-Button (deaktiviert wenn leer)
```

### Datenmodell — Neue Tabelle `comments`

| Feld | Typ | Beschreibung |
|---|---|---|
| id | UUID PK | |
| content_item_id | UUID FK → content_items CASCADE | |
| author_id | UUID FK → members CASCADE | |
| text | TEXT NOT NULL CHECK length 1–500 | |
| created_at | timestamptz default now() | |

**Indexe:** `(content_item_id, created_at desc)` für schnelle Pagination, `(author_id)` für eigene Liste.

**RLS:** SELECT public, INSERT/DELETE via API (gleicher Pattern wie reactions).

**Migration:** `supabase/migrations/20260407_comments.sql` (Schema-only-via-Migration-Regel — kein manuelles Dashboard-Klicken).

### Neue API-Endpunkte

| Route | Methode | Zweck |
|---|---|---|
| `/api/events/[id]/content/[contentId]/comments` | GET | Liste mit Cursor-Pagination (`?cursor=&limit=20`) |
| `/api/events/[id]/content/[contentId]/comments` | POST | Neuer Kommentar (Zod-validiert, Rate-Limit 5/min) |
| `/api/events/[id]/content/[contentId]/comments/[commentId]` | DELETE | Eigener / Organisator / Admin |

GET liefert Kommentare in einem Query mit Author-Daten (analog zur reactions-Aggregation in PROJ-31).

### Realtime
Channel `comments-<itemId>` lauscht auf INSERT/DELETE der `comments`-Tabelle gefiltert nach `content_item_id`. Reuse des Patterns aus PROJ-28/31.

### Undo-Mechanismus
Client-seitig: Delete wird **erst nach Toast-Ablauf** (5s) an die API geschickt. Bei "Rückgängig"-Klick wird der API-Call abgebrochen — der Kommentar war serverseitig nie weg. Kein Re-Insert nötig, keine Race Conditions.

### Rate-Limiting
Bestehender `isRateLimited`-Helper aus `src/lib/rate-limit.ts` mit neuem Tag `comments-write`, 5 Requests pro Minute pro Member-ID.

### Tech-Entscheidungen
- **shadcn/ui Sheet** für Bottom Sheet — bereits installiert
- **Cursor-Pagination** statt "alles laden" — spart Bandbreite bei vielen Kommentaren
- **Optimistic UI für POST** wie bei Reactions — sofortiges Feedback
- **Keine Edit-Funktion** (nicht in den ACs) — nur Löschen + Neuschreiben

### Abhängigkeiten
Keine neuen npm-Pakete. `Sheet`, `Button`, `Textarea`, `Avatar`, `Badge` aus shadcn/ui bereits installiert.

### Was nicht angefasst wird
`ContentCard` bekommt **nur** das CommentBadge unten ergänzt — gleicher Stil wie ReactionBar bei PROJ-31. Alle anderen Komponenten bleiben unverändert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
