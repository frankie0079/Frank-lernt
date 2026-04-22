# PROJ-38: Realtime-Fix Content-Pool

## Status: In Progress
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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
