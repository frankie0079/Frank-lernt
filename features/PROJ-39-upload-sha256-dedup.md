# PROJ-39: Upload-SHA-256-Dedup

## Status: Planned
**Created:** 2026-04-23
**Last Updated:** 2026-04-23

## Dependencies
- Requires: PROJ-27 (Wanderer-Screen) — betroffener Upload-Einstiegspunkt
- Requires: PROJ-28 (Content-Pool) — zeigt deduplizierte Beiträge
- Requires: PROJ-29 (Video-Aufnahme) — betroffener Upload-Pfad
- Requires: PROJ-30 (Sprachmemo) — betroffener Upload-Pfad

## Hintergrund

Beim Hong-Kong-Test (April 2026, 104 Fotos über 3 Tage) hat Frank dieselben Fotos mehrfach hochgeladen. Das passiert leicht beim Bulk-Upload aus der iOS-Foto-App: man scrollt zurück, sieht ein Foto, denkt „das hatte ich noch nicht", tippt es an — obwohl es bereits drin ist. Die Duplikate landeten als separate `content_items`-Einträge in der DB und belegten doppelt Speicherplatz im Storage-Bucket. Sie tauchten im Content-Pool, in der Kurations-Ansicht und potenziell im PDF auf.

Die Lösung: Bevor eine Datei hochgeladen wird, berechnet der Browser ihren SHA-256-Hash (SubtleCrypto API, browser-nativ). Der Server prüft, ob für dieses Event bereits ein Beitrag mit diesem Hash existiert. Falls ja: kein zweiter Upload, das vorhandene Item wird zurückgegeben.

## User Stories

- Als Teilnehmer beim Bulk-Upload möchte ich, dass Fotos, die ich versehentlich zweimal auswähle, nur einmal hochgeladen werden, damit der Content-Pool keine Duplikate enthält.
- Als Teilnehmer möchte ich eine klare Rückmeldung bekommen, wenn ein Foto bereits hochgeladen wurde (Toast: „Dieses Foto wurde bereits hochgeladen"), damit ich verstehe warum es nicht noch einmal erscheint.
- Als Tages-Admin möchte ich keine doppelten Fotos im Kurations-Screen sehen, damit ich nicht versehentlich dasselbe Bild zweimal in die Slideshow wähle.
- Als Organisator möchte ich, dass Duplikat-Uploads nicht doppelt Speicherplatz im Supabase Storage verbrauchen, damit wir innerhalb der kostenlosen Storage-Limits bleiben.
- Als Entwickler möchte ich, dass die Dedup-Logik silent-fails, wenn der Hash nicht berechnet werden kann (z.B. sehr große Datei, Browser-Fehler), damit der Upload nicht blockiert wird.

## Acceptance Criteria

- [ ] Wenn ein Teilnehmer ein Foto/Video/Audio hochlädt, das er für dasselbe Event bereits einmal hochgeladen hat, wird kein zweites Objekt in Supabase Storage gespeichert
- [ ] Wenn ein Teilnehmer ein Foto/Video/Audio hochlädt, das er für dasselbe Event bereits einmal hochgeladen hat, wird kein zweites `content_items`-Row in der DB angelegt
- [ ] Der Teilnehmer sieht einen Toast: „Dieses Foto/Video/Audio wurde für dieses Event bereits hochgeladen" (oder sinngemäß), wenn ein Duplikat erkannt wird
- [ ] Beim Bulk-Upload (Multi-Select, mehrere Dateien) werden Duplikate unter den ausgewählten Dateien ebenfalls erkannt (zwei identische Dateien in derselben Auswahl → nur eine wird hochgeladen)
- [ ] Foto-Uploads (photo-sheet.tsx + wanderer-screen.tsx Bulk-Upload) sind dedupliziert
- [ ] Video-Uploads (video-sheet.tsx) sind dedupliziert
- [ ] Audio-Uploads (audio-sheet.tsx) sind dedupliziert
- [ ] Text-Posts (kein File) sind von dieser Änderung nicht betroffen
- [ ] Dasselbe Foto für zwei verschiedene Events hochladen → kein False Positive (Dedup ist pro Event, nicht global)
- [ ] Wenn die SHA-256-Berechnung fehlschlägt (Browser-Fehler, File API nicht verfügbar), läuft der Upload normal weiter ohne Dedup-Check (kein Blockieren)
- [ ] Bestehende `content_items` ohne Hash-Wert (vor diesem Feature hochgeladen) werden nicht fälschlicherweise als Duplikate erkannt
- [ ] Kein messbarer Performance-Unterschied bei normalem Upload (Hash-Berechnung < 500ms für typische Fotos ≤ 10MB)

## Edge Cases

- **Race Condition — zwei Teilnehmer laden dieselbe Datei gleichzeitig hoch:** Beide berechnen denselben Hash. Beide fragen gleichzeitig den Server, ob ein Duplikat existiert. Server antwortet bei beiden „nein". Beide starten den Upload. Einer gewinnt den INSERT-Race, der andere erhält einen UNIQUE-Constraint-Fehler auf `(event_id, file_hash)`. Der Verlierer bekommt trotzdem eine Erfolgsantwort — er erhält das bereits existierende Item (der Server löst den Conflict mit `ON CONFLICT DO NOTHING` + anschliessendem SELECT).
- **Sehr große Datei (Video, >20MB):** SHA-256-Berechnung dauert länger. Async in einem Web Worker oder per `SubtleCrypto.digest()` mit Streaming — kein UI-Block. Fallback: wenn Hash-Berechnung > 5s dauert oder fehlschlägt, Upload ohne Dedup fortsetzen.
- **Gleiche Datei, anderer Caption-Text:** Gleicher Hash, aber Teilnehmer will dieselbe Datei mit anderem Caption erneut hochladen. Das ist ein Duplikat auf Datei-Ebene — das vorhandene Item wird zurückgegeben (keine Ausnahme für unterschiedliche Captions). Nutzer muss Caption des vorhandenen Items bearbeiten, statt die Datei erneut hochzuladen.
- **Exakt 2 gleiche Dateien in derselben Bulk-Auswahl:** Client-seitig deduplizieren, bevor irgendetwas zum Server geht. Nur eine Datei wird hochgeladen; Toast meldet „1 Duplikat übersprungen".
- **Offline-Szenario (Service Worker Background Sync):** Hash wird client-seitig berechnet und im Upload-Request mitgesendet. Beim Sync-Replay sendet der Background-Sync-Request denselben Hash erneut → Server erkennt es als Duplikat und gibt das bereits vorhandene Item zurück (idempotent).
- **Hash-Kollision (theoretisch):** SHA-256 hat $2^{256}$ mögliche Werte. Für praktische Zwecke (Fotos aus einer Reisegruppe) ausgeschlossen. Kein Handling nötig.
- **Alte Items ohne Hash — Teilnehmer lädt dasselbe Foto erneut hoch, das vor dem Feature-Deploy hochgeladen wurde:** Da das alte Item keinen Hash hat, findet die Server-Prüfung kein Match. Das Foto wird ein zweites Mal hochgeladen (mit Hash). Kein False Positive, aber auch kein Schutz für Legacy-Items. Akzeptiert.

## Technical Requirements

- **Neue DB-Spalte:** `file_hash TEXT` auf `content_items` (nullable, kein UNIQUE allein — UNIQUE-Constraint auf `(event_id, file_hash)` PARTIAL: `WHERE file_hash IS NOT NULL`)
- **Hash-Algorithmus:** SHA-256 via `crypto.subtle.digest('SHA-256', buffer)` (browser-nativ, kein NPM-Paket)
- **Betroffene Upload-Komponenten:**
  - `src/components/photo-sheet.tsx` — Einzel- und Bulk-Upload
  - `src/components/wanderer-screen.tsx` — Bulk-Upload via Multi-File-Input
  - `src/components/video-sheet.tsx` — Video-Upload
  - `src/components/audio-sheet.tsx` — Audio-Upload
- **Betroffene API-Route:** `POST /api/events/[id]/content` — empfängt `file_hash` als FormData-Feld, prüft auf Duplikat vor Storage-Upload
- **Keine Änderung an:** Storage-Bucket-Konfiguration, RLS-Policies (Dedup läuft server-seitig mit service_role), Realtime-Subscriptions
- **Migration:** `supabase/migrations/20260423_content_items_file_hash.sql`

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
