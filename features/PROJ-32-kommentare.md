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

**QA Round 1 — Static Code Review** — 2026-04-07
**Tester:** QA Engineer (Claude)
**Scope:** Code review of migration, API routes, components. Production smoke test against live Vercel URL was NOT executable from the sandbox (no network egress) — Frank must run it manually before deploy.

### Acceptance Criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Sprechblasen-Icon mit Anzahl-Badge auf Karteikarte | PASS | `CommentBadge` mounted in `content-card.tsx:258`. |
| 2 | Badge bei 0 nur Icon, sonst Zahl | PASS | `comment-badge.tsx:41` `count > 0 && <span>`. |
| 3 | Tap → Bottom Sheet | PASS | shadcn `Sheet side="bottom"`. Desktop nutzt denselben Sheet — Spec verlangt "Inline-Expand auf Desktop". Siehe BUG-1. |
| 4 | Textarea max 500, Counter, Send-Button | PASS | Counter zeigt `charCount/500`, wird rot bei Overlimit. Aber `maxLength={MAX_LENGTH+50}` (550) erlaubt 50 Zeichen mehr — siehe BUG-3. |
| 5 | Send-Button deaktiviert wenn leer/whitespace | PASS | `text.trim().length > 0` in `canSubmit`. |
| 6 | Liste mit Avatar, Name, Text, relativer Zeit | PASS | `formatDistanceToNow(..., {locale: de})`. |
| 7 | Eigene Kommentare zeigen Löschen-Button | PARTIAL | Mülleimer-Icon auf Mobile + Desktop. Spec verlangt explizit **Swipe-to-Delete auf Mobile** — nicht implementiert. Siehe BUG-2. |
| 8 | Realtime ohne Reload | PASS | Channel `comments-${itemId}`, INSERT + DELETE postgres_changes. |
| 9 | Organisator + Tages-Admin können löschen | PARTIAL | Server erlaubt beides (`[commentId]/route.ts:85-109`). UI gibt aber nur `canModerate={isOrganizer}` weiter (`content-card.tsx:270`) — **Tages-Admin sieht Löschen-Button nicht im UI**. Siehe BUG-4 (High). |
| 10 | Löschen mit Undo-Toast 5s, kein Confirm | PASS | `setTimeout(..., 5000)`, sonner-Toast mit `action.label="Rueckgaengig"`. Sauberes Pattern. |
| 11 | Kommentare auf öffentlicher Event-Seite lesbar | UNVERIFIED | RLS `SELECT using (true)` erlaubt anonymen Read. PROJ-35 (öffentliche Seite) ist noch nicht gebaut → AC kann nicht final getestet werden. |
| 12 | Eingabefeld nur für eingeloggte Mitglieder | PASS | `{currentMemberId && (<div>...</div>)}` (`comment-thread-sheet.tsx:380`). |

### Edge Cases

| Case | Status | Notes |
|------|--------|-------|
| 0 Kommentare → Placeholder | PASS | "Noch kein Kommentar — sei der Erste!". |
| Nur Whitespace | PASS | Server trimmt zusätzlich, gibt 400 wenn leer. |
| > 500 Zeichen → rot, deaktiviert | PASS | Aber siehe BUG-3 (maxLength=550 erlaubt Eintippen über 500). |
| Lange Wörter ohne Umbruch | PARTIAL | `wordBreak: "break-word"` statt spec-konformem `break-all`. `break-word` reicht in 99% aller Fälle, aber bei einer 500-Zeichen-Buchstabenkette ohne Trennstellen kann es überlaufen. Low. Siehe BUG-5. |
| > 50 Kommentare → Pagination | PASS | Cursor-basiert, "Aeltere laden" Button. PAGE_SIZE=20, hasMore wenn `fetched.length === PAGE_SIZE`. |
| Beitrag während Thread gelöscht | NOT IMPLEMENTED | Spec verlangt: Thread schließt sich + Toast "Beitrag wurde gelöscht". Es gibt keinen entsprechenden Listener im Sheet. Siehe BUG-6 (Medium). |
| Nicht eingeloggter Nutzer kommentiert | PASS | Eingabe-UI ist gar nicht sichtbar; falls direkt POST → 401 "Nicht angemeldet". |
| Spam-Schutz 5/min/User | FAIL | Spec verlangt **5 pro Minute pro User-ID**. Implementiert ist der globale `isRateLimited(ip, "write")` mit **30/min/IP**. Kommentar im Code (`route.ts:184-186`) gibt das selbst zu. Siehe BUG-7 (Medium). |
| Offline beim Absenden | PASS | `catch` zeigt "Verbindungsfehler" + Rollback. |

### Security Audit (Red Team)

| Test | Status | Notes |
|------|--------|-------|
| XSS via Kommentar-Text | PASS | React rendert Text als Kind-Node → escaped. Kein `dangerouslySetInnerHTML`. |
| SQL Injection via cursor | PASS | Zod-ähnliche Validierung: `isNaN(Date.parse(cursor))` → 400. Supabase ist parameterized. |
| Auth-Bypass POST ohne Cookie | PASS | 401. |
| IDOR DELETE fremder Kommentar | PASS | Server prüft `author_id === currentMember.id || organizer || daily_admin`. |
| Cross-Event Smuggle (commentId in anderem Event löschen) | PASS | `comment.content_item_id !== contentId` und `item.event_id !== id` werden geprüft. |
| RLS überschreibbar via direktem REST-Call | **FAIL** | RLS ist `INSERT with check (true)` und `DELETE using (true)`. Jeder mit dem Anon-Key kann direkt via PostgREST `POST /rest/v1/comments` einen Kommentar mit beliebiger `author_id` einfügen oder fremde Kommentare löschen — komplett unter Umgehung der API-Route. Spec verlangt explizit "RLS als zweite Verteidigungslinie". Siehe BUG-8 (Critical). |
| Comment > 500 via direktem REST | PASS | DB CHECK constraint (`length(btrim(text)) between 1 and 500`) blockt das. |
| Rate-Limit-Bypass durch IP-Wechsel | KNOWN | In-memory Limiter, nicht persistent — siehe BUG-7. |
| Sensitive Data in API-Response | PASS | Nur `id, name, avatar_url`, kein `token`. |
| Information-Leak via öffentlichen SELECT | EXPECTED | `SELECT using (true)` ist Spec-konform (öffentliche Event-Seite). Aber: Kommentare zu **privaten/nicht-öffentlichen Events** sind dadurch ebenfalls global lesbar via REST. Wenn nicht alle Events public sind: Information Leak. Siehe BUG-9 (High). |

### Production Smoke Test (Step 2b)

**SKIPPED — kann von QA-Sandbox nicht ausgeführt werden** (kein Netzwerk).
Frank muss vor Deploy manuell verifizieren:
1. `GET https://xqopetmpzjbxksonmhjw.supabase.co/rest/v1/comments?select=id&limit=0` → muss 200 sein. Wenn 404/relation does not exist → **Migration `20260407_comments.sql` ist nicht in Production angewendet** (Blocker, schema drift).
2. Realtime-Publication: gleiche Tabelle muss in `supabase_realtime` Publication sein, sonst funktioniert AC #8 nicht.
3. End-to-End: Kommentar in Production posten, in zweitem Browser sehen, löschen, undo testen.

### Bugs

**BUG-1 — Medium — Desktop nutzt Bottom Sheet statt Inline-Expand**
- AC #3 verlangt explizit "Bottom Sheet (Mobile) **oder** Inline-Expand (Desktop)".
- `CommentThreadSheet` rendert immer `<Sheet side="bottom">`. Auf Desktop sollte ein Popover/Inline-Bereich rendern.
- Steps: Desktop 1440px → auf Sprechblase klicken → Sheet schiebt von unten rein.
- Priority: Medium (UX, nicht funktionsbrechend).

**BUG-2 — Low — Kein Swipe-to-Delete auf Mobile**
- AC #7 verlangt "Swipe-to-Delete auf Mobile, Papierkorb-Icon auf Desktop".
- Aktuell: nur Papierkorb-Icon auf beiden Plattformen.
- Priority: Low (Funktion existiert, nur die Geste fehlt).

**BUG-3 — Low — Textarea erlaubt Eingabe bis 550 Zeichen**
- `maxLength={MAX_LENGTH + 50}` in `comment-thread-sheet.tsx:389`.
- Send-Button blockt korrekt, Counter wird rot — Funktion ist sicher. Aber UX-Verwirrend, dass man weitertippen kann.
- Priority: Low.

**BUG-4 — High — Tages-Admin kann im UI keine Kommentare löschen**
- `content-card.tsx:270`: `canModerate={isOrganizer}` — daily-admin Flag fehlt.
- Server-Endpoint erlaubt es korrekt, aber das UI rendert den Mülleimer für den Tages-Admin nicht. AC #9 nur halb erfüllt.
- Steps: Login als daily admin → Beitrag im Pool öffnen → Kommentar fremden Autors → kein Löschen-Button.
- Priority: High.

**BUG-5 — Low — `word-break` statt spec-`break-all`**
- Spec sagt `word-break: break-all`, Code nutzt `break-word`. Einzeilige 500-char-Strings können auf schmalen Viewports überlaufen.
- Priority: Low.

**BUG-6 — Medium — Beitrag-Lösch-Listener fehlt im Thread**
- Edge Case "Beitrag wird während geöffnetem Thread gelöscht → Thread schließt sich, Toast" ist nicht implementiert.
- Aktuelles Verhalten: Sheet bleibt offen, Realtime-DELETE auf `content_items` wird nicht gehört → Kommentare können in geistertem Sheet weiter geschrieben werden (POST schlägt mit 404 fehl).
- Priority: Medium.

**BUG-7 — Medium — Rate-Limit ist 30/min/IP statt 5/min/User**
- Spec: 5 Kommentare pro Minute pro Nutzer-ID.
- Code (`route.ts:184-192`): nutzt globalen IP-Limiter mit 30/min und kommentiert "Tighten via Upstash/KV".
- Auswirkung: Spam-Schutz schwächer als spezifiziert; mehrere User hinter derselben IP (NAT) blockieren sich gegenseitig.
- Priority: Medium.

**BUG-8 — Critical — RLS bietet keinen Schutz gegen direkten REST-Zugriff**
- Migration:
  ```
  create policy "comments_insert_via_api" ... with check (true);
  create policy "comments_delete_via_api" ... using (true);
  ```
- Anyone mit dem `NEXT_PUBLIC_SUPABASE_ANON_KEY` (alle Browser-User!) kann direkt:
  - `POST /rest/v1/comments` mit beliebiger `author_id` und `content_item_id` (Spoofing)
  - `DELETE /rest/v1/comments?id=eq.<x>` jeden Kommentar löschen
- Dadurch sind alle Server-Side-Checks (Membership, Ownership, Moderation, Rate-Limit) trivial umgehbar.
- Spec sagt "RLS als zweite Verteidigungslinie" — die Linie existiert nicht.
- Fix-Richtung: Nur `service_role` darf INSERT/DELETE; API-Route muss mit Service-Role-Client schreiben (nicht Anon-Key wie aktuell in `createSupabase()`). Oder echte RLS-Policies, die membership prüfen.
- Priority: **Critical (Blocker)**.

**BUG-9 — High — Public SELECT leakt Kommentare aller Events**
- `comments_select_public ... using (true)` macht **alle** Kommentare aller Events öffentlich lesbar via PostgREST, auch von noch nicht öffentlich gemachten / privaten Events.
- Mit AC #11 ist das für veröffentlichte Events gewollt — aber nicht für Events ohne öffentliche Seite.
- Fix: Policy sollte nur Kommentare freigeben, deren `content_item → event` einen `is_public=true`-Flag hat (existiert PROJ-35 noch nicht → bis dahin Policy auf membership einschränken).
- Priority: High.

### Regression Test

| Feature | Status |
|---|---|
| PROJ-28 Content-Pool: Liste lädt + comment_count enrichment | PASS (Code-Pfad sauber, keine N+1, single Query) |
| PROJ-31 Reactions: ReactionBar neben CommentBadge | PASS (Layout `flex justify-between`) |
| PROJ-27 Wanderer-Screen | NOT TOUCHED |
| PROJ-26 Member-Management | NOT TOUCHED |

### Summary

- **Acceptance Criteria:** 8 PASS / 2 PARTIAL / 1 UNVERIFIED / 1 mit BUG
- **Edge Cases:** 6 PASS / 2 FAIL / 1 PARTIAL
- **Bugs:** 1 Critical, 2 High, 3 Medium, 3 Low (9 total)
- **Production Smoke Test:** SKIPPED — muss von Frank ausgeführt werden

### Production-Ready Decision: **NOT READY**

Blocker-Begründung:
1. **BUG-8 (Critical)** RLS lässt anonymes Schreiben/Löschen direkt via REST zu.
2. **BUG-9 (High)** Public-SELECT leakt Kommentare nicht-öffentlicher Events.
3. **BUG-4 (High)** Tages-Admin Moderation im UI fehlt (AC #9 nicht erfüllt).
4. Production-Smoke-Test muss noch laufen — Migration `20260407_comments.sql` ist möglicherweise noch nicht angewendet (Schema-Drift-Risiko).

**Empfohlene Fix-Reihenfolge:** BUG-8 → BUG-9 → BUG-4 → BUG-7 → BUG-6 → BUG-1 → BUG-3 → BUG-5 → BUG-2 → Re-QA → Production Smoke Test.

## Deployment
_To be added by /deploy_
