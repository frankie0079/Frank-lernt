# PROJ-32: Kommentar-Threads

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
