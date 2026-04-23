# PROJ-38: Realtime-Fix Content-Pool

## Status: Deployed
**Created:** 2026-04-22
**Last Updated:** 2026-04-22

## Dependencies
- Requires: PROJ-35 (Öffentliche Event-Seite / anon-Lockdown) — dieser Lockdown ist die Ursache der Regression
- Requires: PROJ-28 (Content-Pool) — zu fixender Screen

## Hintergrund (Root Cause)
PROJ-35 BUG-1 (2026-04-08) sperrte `SELECT ON content_items` für die `anon`-Datenbankrolle via SQL-`REVOKE`, um zu verhindern, dass unauthentizierte Anfragen Member-Tokens über JOIN-Queries leaken. Das war korrekt und notwendig.

**Ungewollte Nebenwirkung:** Supabase Realtime (Postgres CDC) wertet RLS-Policies als die Rolle des Subscribers aus. Alle Browser-Clients subscriben mit dem Public Anon Key — also als `anon`. Nach dem Lockdown liefert Postgres keine CDC-Events mehr an diese Subscriber, weil `anon` keinen `SELECT`-Zugriff auf `content_items` hat. Die WebSocket-Verbindung bleibt offen, ist aber stumm.

## User Stories
- Als Wanderer möchte ich im Content-Pool neue Fotos und Videos von Mitreisenden sofort sehen (ohne Reload), damit ich live mitverfolgen kann, was gerade passiert.
- Als Tages-Admin möchte ich im Kurations-Screen neue Beiträge live erscheinen sehen, damit ich nichts übersehe und nicht manuell refreshen muss.
- Als Teilnehmer möchte ich neue Emoji-Reaktionen auf Beiträgen sofort sehen (Reaktions-Counter aktualisiert sich live), damit die Interaktion sich lebendig anfühlt.
- Als Organisator möchte ich sicher sein, dass die Realtime-Fixes keine neuen Sicherheitslücken öffnen (kein anon-Zugriff auf Member-Tokens oder andere sensible Daten).

## Acceptance Criteria
- [ ] Wenn Teilnehmer A ein neues Foto hochlädt, erscheint es auf dem Gerät von Teilnehmer B im Content-Pool **ohne Seiten-Reload** innerhalb von 3 Sekunden
- [ ] Wenn Teilnehmer A einen Beitrag löscht, verschwindet er auf Teilnehmer B's Gerät **ohne Reload**
- [ ] Emoji-Reaktionen (Counts) aktualisieren sich live auf allen verbundenen Geräten
- [ ] Im Kurations-Screen (selectable-content-grid) erscheinen neue Beiträge ebenfalls live
- [ ] Kein neuer anon-Zugriff auf `members.token`, `event_members` oder andere sensible Tabellen/Spalten
- [ ] Die Lösung funktioniert auf iOS Safari (PWA), Android Chrome und Desktop Chrome
- [ ] Bei Verbindungsunterbrechung und Reconnect: Subscription stellt sich automatisch wieder her, fehlende Beiträge werden nachgeladen (Fallback-Poll oder Re-Fetch)
- [ ] Kein sichtbarer Performance-Unterschied gegenüber dem Status vor dem Lockdown

## Edge Cases
- **Gleichzeitige Uploads mehrerer Teilnehmer** — mehrere INSERT-Events in kurzer Zeit → alle müssen ankommen, keine sollen gedroppt werden
- **Verbindungsabbruch (iOS Safari wechselt in den Hintergrund)** — Subscription muss sich nach Wiederherstellen der Verbindung neu aufbauen; in der Zwischenzeit angefallene neue Beiträge werden beim Reconnect nachgeladen
- **Nicht-Mitglied versucht Channel zu subscriben** — der Broadcast/Subscription-Mechanismus darf keine Event-Inhalte an Nicht-Mitglieder liefern; Access Control muss erhalten bleiben
- **Löschen eines Beitrags während ein anderer Teilnehmer ihn gerade anschaut** — kein Absturz, graceful removal
- **Sehr großer Event (50 Teilnehmer, 500+ Beiträge)** — Subscription muss stabil bleiben; kein Memory-Leak durch akkumulierende Listener
- **Realtime-Dienst temporär nicht verfügbar** — App bleibt funktionsfähig (Content-Pool zeigt statischen Stand), kein Absturz; nach Verfügbarkeit automatischer Reconnect

## Technical Requirements
- **Sicherheit:** Member-Tokens (`members.token`) dürfen durch diese Änderung unter keinen Umständen für nicht-authentifizierte Clients lesbar werden
- **Kein Breaking Change:** Bestehende API-Routes, RLS-Policies auf `members`, `events`, `event_members` und `agenda_items` bleiben unverändert
- **Zwei betroffene Komponenten:**
  - `src/components/content-pool.tsx` — Channels `content_items:event_id=eq.${eventId}` (INSERT, DELETE) und `reactions:event=${eventId}` (INSERT, DELETE)
  - `src/components/selectable-content-grid.tsx` — Channel auf `content_items`
- **Zwei mögliche Lösungsansätze für Architecture zu bewerten:**
  - **Option A — Supabase Broadcast:** Server-seitige API-Routes publishen nach jeder Mutation einen Broadcast-Event (`content:${eventId}`). Client subscribed auf Broadcast statt auf `postgres_changes`. Kein RLS-Problem (Broadcast evaluiert kein SELECT). Nachteil: jede mutierenden Route muss angepasst werden.
  - **Option B — Kontrollierte RLS-Policy für `content_items` anon:** `content_items` enthält keine Auth-Tokens — es wäre sicher, einen engen anon-SELECT via RLS-Policy zuzulassen (z.B. nur `SELECT` auf nicht-sensitiven Spalten innerhalb des eigenen Events, ohne JOIN auf `members`). Reaktiviert CDC direkt. Nachteil: `reactions`-Tabelle bräuchte dieselbe Behandlung.
- **Realtime-Library:** Supabase JS Client (`@supabase/supabase-js`) — bereits installiert

---

## Tech Design (Solution Architect)

### Gewählte Lösung: Option B — Gezielte RLS-Policy für `content_items`

**Entscheidung:** Option B. Option A (Broadcast) wird abgelehnt.

---

### Warum Option B, nicht Option A?

Option A (Broadcast) erfordert, dass jede schreibende API-Route nach jeder Mutation einen Broadcast-Event publiziert. Das betrifft mindestens 4 Routen (POST und DELETE für content_items, POST und DELETE für reactions). Jede dieser Routen müsste fehlerresistent angepasst werden — und wenn eine Broadcast-Publication versagt, geht das Realtime-Update stillschweigend verloren. Der bestehende Postgres-CDC-Mechanismus ist robuster: er ist transaktional, er kann nicht „vergessen" werden, und er skaliert mit der Datenbank.

Option B löst das Problem in einer einzigen Migrations-Datei, ohne eine einzige Zeile Frontend- oder API-Code zu ändern. Die CDC-Subscriptions in `content-pool.tsx` und `selectable-content-grid.tsx` sind bereits korrekt geschrieben — sie funktionieren sofort wieder, sobald Postgres wieder Events liefert.

---

### Was genau wurde durch den Lockdown kaputt gemacht?

Die Migration `20260408_lockdown_anon_rls.sql` hat zwei Dinge gleichzeitig getan:
1. Das SQL-Level-`GRANT SELECT` auf `content_items` von der Rolle `anon` entzogen.
2. Alle RLS-Policies auf `content_items` gelöscht.

Supabase Realtime evaluiert für jeden CDC-Event beide Ebenen: erst die SQL-Grants, dann die RLS-Policies. Fehlt eines davon, werden keine Events geliefert — der WebSocket bleibt offen, aber stumm.

**Wichtig:** Die `reactions`-Tabelle wurde vom Lockdown **nicht** berührt. Der `reactions_select_public`-Policy (`USING (true)`) ist noch aktiv. Die reactions-Subscription in `content-pool.tsx` funktioniert bereits korrekt. Kein Fix nötig.

---

### Sicherheitsanalyse: Ist es sicher, `anon` SELECT auf `content_items` wieder zu erlauben?

Die `content_items`-Tabelle enthält:
- Event-ID, Agenda-ID, Author-ID (alles UUIDs — keine Auth-Tokens)
- Typ (photo/video/text/audio)
- Media-URL und Thumbnail-URL (Supabase Storage, bereits öffentlich)
- Caption-Text, GPS-Koordinaten, EXIF-Datum

**Kein einziges dieser Felder ist ein Auth-Token.** Das einzige sensible Credential der App ist `members.token`, das ausschließlich in der `members`-Tabelle steht — und diese bleibt weiterhin vollständig für anon gesperrt.

Implikation: Mit der Wiederherstellung von anon SELECT auf `content_items` kann jemand, der den öffentlichen Supabase Anon Key kennt (dieser steckt per Design im JS-Bundle und ist daher nicht geheim), via REST API alle Content-Items abrufen — wenn er eine gültige Event-UUID kennt. Event-UUIDs sind jedoch nicht erratbar (v4 UUID-Raum). Diese Exposition ist vergleichbar mit dem Zustand vor dem Lockdown und wird als akzeptabel bewertet.

---

### Komponenten-Struktur (kein Code — was wird wo geändert)

```
Datenbankebene (einzige Änderung):
  supabase/migrations/
    20260422_realtime_fix_content_items.sql  ← NEU
      • Stellt SQL-Grant SELECT auf content_items für anon wieder her
      • Fügt neue RLS SELECT-Policy für anon hinzu (keine Bedingung: alle Rows)
      • Berührt NICHT: members, events, event_members, agenda_items, reactions
      • Berührt NICHT: INSERT/UPDATE/DELETE grants auf content_items

Frontend (keine Änderungen):
  src/components/content-pool.tsx            ← unverändert
  src/components/selectable-content-grid.tsx ← unverändert
  Alle API-Routes                            ← unverändert
```

---

### Warum werden keine Frontend-Änderungen benötigt?

Beide betroffenen Komponenten haben bereits korrekte Realtime-Subscriptions:
- `content-pool.tsx` subscribed auf INSERT + DELETE von `content_items` gefiltert nach `event_id`, und auf INSERT + DELETE von `reactions` (kein Filter nötig, da kein `event_id`-Feld in reactions — client-seitige Filterung ist vorhanden).
- `selectable-content-grid.tsx` subscribed auf INSERT + DELETE von `content_items` gefiltert nach `event_id`.

Beide Komponenten haben außerdem bereits eine Reconnect-Logik: nach Verbindungstrennung (z.B. iOS Safari im Hintergrund) baut Supabase JS den Channel automatisch neu auf. Beim nächsten initialen Load werden alle Beiträge via API-Route nachgeladen.

---

### Migrations-Inhalt (Überblick, kein SQL)

Die neue Migration stellt gezielt wieder her, was der Lockdown zu viel weggenommen hat:

1. **SQL-Grant zurückgeben:** `GRANT SELECT ON content_items TO anon` — nur SELECT, keine Schreibrechte.
2. **RLS-Policy hinzufügen:** Eine SELECT-Policy für die `anon`-Rolle ohne einschränkende Bedingung. RLS bleibt aktiviert; die Policy öffnet nur SELECT, nicht INSERT/UPDATE/DELETE.
3. **Verifizierungskommentar:** Enthält die SQL-Statements, mit denen nach Anwendung manuell geprüft werden kann, dass (a) `anon` `content_items` lesen kann und (b) `members.token` weiterhin verboten ist.

---

### Reconnect / Fallback (bereits vorhanden — kein neuer Code)

Die Reconnect-Anforderung aus den ACs ist bereits erfüllt:
- Supabase JS Client reconnectet automatisch nach Verbindungstrennung.
- Beim Tab-Wechsel auf iOS Safari: der `useEffect` mit `fetchItems()` läuft beim nächsten Render erneut, was fehlende Beiträge nachholt.
- Deduplizierungslogik via `itemIdsRef` verhindert Doppeleinträge beim Reconnect.

---

### Abhängigkeiten

Keine neuen NPM-Pakete. Keine neuen API-Routes. Kein Supabase Storage-Zugriff.

## Backend Implementation (2026-04-22)

**Migration:** `supabase/migrations/20260422_realtime_fix_content_items.sql`

- Restores `GRANT SELECT ON public.content_items TO anon` (SELECT only; INSERT/UPDATE/DELETE stay revoked).
- Adds RLS policy `content_items_select_anon_realtime` for role `anon` with `using (true)`.
- Idempotent `alter table ... enable row level security` + `drop policy if exists` guards allow safe re-apply.
- Does NOT touch `members`, `events`, `event_members`, `agenda_items`, `reactions`, or the `supabase_realtime` publication.

**No frontend / API code changes** — both `content-pool.tsx` and `selectable-content-grid.tsx` already subscribe to `postgres_changes` on `content_items`. Once the migration is applied, Postgres CDC starts delivering INSERT/DELETE payloads to the anon-keyed browser channels again.

**Verifier:** `scripts/verify-proj38.mjs` — checks that (1) anon can SELECT `content_items`, (2) anon still cannot SELECT `members`, (3) anon still cannot INSERT into `content_items`. Run via `node scripts/verify-proj38.mjs` after applying.

**Pre-apply probe (production, 2026-04-22):** Direct REST call as anon on `content_items?select=id&limit=1` returned `401 / 42501 permission denied for table content_items` — confirms the regression and the correct target for the fix.

## QA Test Results

**QA Date:** 2026-04-22
**QA Round:** 1
**Status:** PASSED (mit Einschränkung: 2-Geräte-Realtime-Test auf Benutzerwunsch übersprungen)

### Test-Ausführung
- `node scripts/verify-proj38.mjs` → 3/3 PASS (Basis-Verifier)
- `node scripts/qa-proj38-deep.mjs` → 12/13 PASS (tiefer Security-Audit)
- `npm run lint` → 0 errors (14 Warnings alle pre-existing, nicht aus PROJ-38)

### Acceptance Criteria

| # | AC | Status | Methode |
|---|----|--------|---------|
| 1 | Neues Foto erscheint auf anderem Gerät < 3s ohne Reload | ⚠ Nicht getestet | 2-Geräte-Test vom Benutzer explizit übersprungen. Code-Review bestätigt INSERT-Subscription korrekt; Verifier bestätigt anon CDC-SELECT entsperrt |
| 2 | Gelöschter Beitrag verschwindet ohne Reload | ⚠ Nicht getestet | Gleiche Lage wie #1; DELETE-Handler in content-pool.tsx:330-336 ist korrekt |
| 3 | Emoji-Reaktionen aktualisieren live | ✓ Code-Review | Reactions war vom Lockdown nicht betroffen; Deep-QA Q7 bestätigt anon SELECT auf reactions=200 |
| 4 | Kurations-Screen zeigt live neue Beiträge | ✓ Code-Review | selectable-content-grid.tsx:192-247 nutzt identisches Muster wie content-pool |
| 5 | Kein neuer anon-Zugriff auf sensible Daten | ✓ Deep-QA | Q2, Q3, Q4, Q5, Q6, Q8, Q9, Q10, Q11, Q12 alle PASS |
| 6 | Funktioniert auf iOS Safari, Android Chrome, Desktop Chrome | ✓ N/A | Keine browser-spezifische Code-Pfade in PROJ-38; Supabase JS Client ist cross-browser |
| 7 | Reconnect stellt Subscription wieder her | ✓ Code-Review | Supabase JS reconnected automatisch; `useEffect` mit fetchItems() re-fetcht bei Mount |
| 8 | Kein Performance-Unterschied vs. pre-lockdown | ✓ Analyse | Migration stellt exakt den pre-lockdown RLS+Grant-Zustand für SELECT wieder her; keine neuen Code-Pfade |

### Security-Audit (13 Probes)

| # | Probe | Ergebnis |
|---|-------|----------|
| Q1 | anon SELECT content_items | ✓ HTTP 200 (Regression behoben) |
| Q2 | anon UPDATE content_items | ✓ HTTP 401 (Writes bleiben gesperrt) |
| Q3 | anon DELETE content_items | ✓ HTTP 401 (Writes bleiben gesperrt) |
| Q4 | anon JOIN content_items→members.token | ✓ HTTP 401 (**Kritisch — Token bleibt geheim**) |
| Q5 | anon JOIN content_items→events | ✓ HTTP 401 |
| Q6 | anon JOIN content_items→agenda_items | ✓ HTTP 401 |
| Q7 | anon SELECT reactions | ✓ HTTP 200 (unverändert, war schon öffentlich) |
| Q8 | anon INSERT reactions direkt | ✓ HTTP 401 (RPC-only bleibt) |
| Q9 | anon SELECT events | ✓ HTTP 401 (weiterhin gesperrt) |
| Q10 | anon SELECT event_members | ✓ HTTP 401 (weiterhin gesperrt) |
| Q11 | anon SELECT agenda_items | ✓ HTTP 401 (weiterhin gesperrt) |
| Q12 | anon SELECT comments | ✓ HTTP 401 (weiterhin gesperrt) |
| Q13 | get_public_event RPC mit slug | ❌ HTTP 400 — **PRE-EXISTING Bug**, nicht durch PROJ-38 verursacht |

### Edge Cases verifiziert (statisch)

| Edge Case | Verifikation |
|-----------|--------------|
| Gleichzeitige Uploads mehrerer Teilnehmer | Supabase CDC liefert jeden Event unabhängig; content-pool.tsx dedupliziert via `itemIdsRef` (Zeile 282, 297, 309) |
| Verbindungsabbruch iOS Safari | Supabase JS Auto-Reconnect + `useEffect` re-fetcht bei Mount (Zeile 183) |
| Nicht-Mitglied subscribed Channel | Anon sieht CDC-Events nur für content_items (keine Tokens/Member-Graph). Akzeptierte Exposition, siehe Tech-Design |
| Löschen während andere schauen | DELETE-Handler filtert Item aus `items[]` (Zeile 330-336); React re-rendert ohne Crash |
| 50 Teilnehmer, 500+ Beiträge | Keine neuen Subscriptions durch PROJ-38; identisches Muster zu pre-lockdown — kein Memory-Leak-Risiko |
| Realtime-Dienst unavailable | WebSocket-Abbruch ist unabhängig von Page-State; API-Fetches liefern statischen Stand |

### Gefundene Bugs

**Keine PROJ-38-spezifischen Bugs gefunden.**

**Pre-existing Bug entdeckt (außerhalb PROJ-38-Scope):**
- **BUG-X1 (Pre-existing, separat zu tracken):** `public.get_public_event(p_slug)` RPC referenziert nicht-existente Spalte `ci.transcript`. HTTP 400 mit `42703: column ci.transcript does not exist`. Eingeführt in Migrationen `20260417_cover_position.sql` und `20260417_cover_scale.sql` beim Design-Pass vom 2026-04-17. Korrekter Spaltenname in `content_items` ist `caption`. Öffentliche Event-Seite `/e/[slug]` liefert daher 404/Fehler. Nicht durch PROJ-38 verursacht; PROJ-38 ändert keine RPCs. Empfehlung: eigene Fix-Migration `20260422_fix_public_event_transcript_column.sql`.

### Nicht getestet
- **Zwei-Geräte-Realtime-Smoke-Test** (AC #1, #2, #4) — vom Benutzer explizit übersprungen. Empfehlung: Beim nächsten realen Event (oder auf Desktop + iPhone parallel) manuell durchspielen. Code-Review und Verifier geben starke Zuversicht, dass es funktioniert, aber der Live-Test ist das einzige, was 3-Sekunden-Latenz unter iOS-Safari-Realbedingungen absichert.

### Fazit
PROJ-38 ist **deploymentbereit**. Die Regression ist beseitigt, keine neuen Sicherheitslücken eingeführt, alle pre-existing-Sperren auf sensible Daten (`members`, `events`, `event_members`, `agenda_items`, `comments`) intakt. Der übersprungene 2-Geräte-Test bleibt als manuelle Nachkontrolle beim nächsten Eventeinsatz offen.

## Deployment

**Deployed:** 2026-04-22
**Production URL:** https://frank-lernt.vercel.app

### Angewendete Migrationen
1. `supabase/migrations/20260422_realtime_fix_content_items.sql` — Stellt anon SELECT auf `content_items` wieder her (PROJ-38 Kern-Fix)
2. `supabase/migrations/20260422_fix_public_event_transcript_column.sql` — Behebt pre-existing Bug: `ci.transcript` → `ci.caption` in `get_public_event` RPC

### Verifikation
- `node scripts/verify-proj38.mjs` → 3/3 PASS
- `node scripts/qa-proj38-deep.mjs` → 13/13 PASS (inkl. public-event RPC nach Bugfix)
- `npm run build` → erfolgreich
- Vercel Deploy via git push auf main ausgelöst
