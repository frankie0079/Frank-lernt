# PROJ-30: Sprachmemo + automatische Transkription

## Status: Deployed
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-27 (Wanderer-Screen) — Sprachmemo ist eine der Eingabe-Aktionen
- Requires: PROJ-28 (Content-Pool) — Sprachmemos werden im Content-Pool als eigener Medientyp angezeigt

## User Stories
- Als Wanderer möchte ich schnell eine Sprachnotiz aufnehmen, wenn Tippen zu umständlich ist.
- Als Zuschauer möchte ich Sprachmemos als Text lesen, damit ich sie ohne Ton und ohne Kopfhörer verstehen kann.
- Als Wanderer möchte ich den transkribierten Text vor dem Absenden korrigieren können, damit Fehler der Spracherkennung nicht veröffentlicht werden.

## Acceptance Criteria
- [ ] Aufnahme via MediaRecorder API (Format: WebM/Opus oder OGG/Opus)
- [ ] Aufnahme-Button: Mikrofon-Icon, Tap startet/stoppt die Aufnahme
- [ ] Maximale Aufnahmedauer: 3 Minuten (automatischer Stop), Warnung ab 2:45
- [ ] Live-Timer während Aufnahme (Format: `0:00` bis `3:00`)
- [ ] Waveform-Visualisierung während Aufnahme: Amplitude-Balken (Canvas 2D, `AnalyserNode` aus Web Audio API)
- [ ] Automatische Transkription via Web Speech API (`SpeechRecognition`, läuft live während Aufnahme)
- [ ] Transkribierter Text erscheint live in einem Textfeld unterhalb des Aufnahme-Buttons
- [ ] Nach Aufnahme: Transkribierter Text ist vollständig editierbar (Textarea, max 2000 Zeichen)
- [ ] Audio-Upload zu Supabase Storage (Bucket: `media`, Pfad: `[event_id]/audio/[user_id]/[timestamp]-[uuid].[ext]`)
- [ ] Gespeichert in `content_items` (type: `audio`, media_url: Audio-URL, caption: transkribierter Text)
- [ ] Im Content-Pool: Mikrofon-Icon + Transkriptions-Text in Anführungszeichen + kompakter Audio-Player
- [ ] Audio-Player: Play/Pause-Button, Fortschrittsbalken (seekbar), Dauer-Anzeige
- [ ] Optionaler Kommentar zusätzlich zur Transkription (max 500 Zeichen)
- [ ] Absenden nur möglich wenn Aufnahme vorhanden (kein Leer-Upload)

## Edge Cases
- Web Speech API nicht verfügbar (Firefox Desktop, ältere Browser) → Aufnahme funktioniert, aber Transkriptions-Feld zeigt "Automatische Transkription nicht verfügbar in diesem Browser — bitte Text manuell eingeben"
- Mikrofon-Zugriff verweigert → Fehlermeldung "Mikrofon-Zugriff benötigt" mit Link zu iOS/Browser-Einstellungen
- Schlechte Spracherkennung durch Umgebungslärm → Web Speech API liefert partielles Ergebnis, User kann manuell korrigieren (keine Fehlermeldung, normales Verhalten)
- Stille / zu leise Aufnahme → `AnalyserNode` erkennt niedrige Amplitude → nach 5 Sekunden Toast-Hinweis "Zu leise — bitte näher ans Mikrofon"
- Sprache nicht Deutsch → `SpeechRecognition.lang = 'de-DE'` gesetzt, bei anderer Sprache entstehen Transkriptionsfehler → User muss manuell korrigieren
- Aufnahme wird durch eingehenden Anruf unterbrochen → `mediaRecorder`-`stop`-Event → Dialog "Aufnahme unterbrochen — speichern oder verwerfen?"
- Upload schlägt fehl → Retry-Button, lokale Blob-URL bleibt erhalten
- Transkribierter Text leer (Spracherkennung liefert nichts) → Warnung "Keine Transkription — möchtest du trotzdem absenden?" + Möglichkeit, Text manuell einzugeben
- Audio-Datei > 20 MB (extrem lange Aufnahme, unkomprimiert) → Fehlermeldung vor Upload (sollte bei 3 min / Opus selten vorkommen)
- Kein Internet beim Absenden → Lokaler Queue (PWA Background Sync), Retry wenn online

## Technical Requirements
- `navigator.mediaDevices.getUserMedia({audio: true})` für Aufnahme
- MediaRecorder mit MIME-Type: `audio/webm;codecs=opus` (Chrome), `audio/ogg;codecs=opus` (Firefox), `audio/mp4` (Safari Fallback)
- Web Audio API: `AudioContext` → `createAnalyser()` → `getByteTimeDomainData()` für Waveform-Visualisierung (60fps `requestAnimationFrame`)
- Web Speech API: `window.SpeechRecognition || window.webkitSpeechRecognition`, `lang = 'de-DE'`, `interimResults = true`, `continuous = true`
- Transkriptions-Events: `onresult` → Interim- und Final-Results in Textarea einfügen
- `content_items.type = 'audio'`, `caption` = finaler Transkriptions-Text (nach User-Korrektur)
- Keine externe API-Abhängigkeit (kostenlos, komplett client-side)
- Audio-Player: natives `<audio>` Element mit Custom-Controls (Play/Pause + Seek-Slider via Range-Input)

---

## Tech Design (Solution Architect)

### Overview
Sprachmemo folgt dem gleichen Muster wie Video-Aufnahme (PROJ-29): Button → Bottom-Sheet → Upload → API. Kein neues Backend, keine neue DB-Tabelle. Besonderheit: Live-Transkription läuft parallel zur Aufnahme über die Web Speech API.

### Component Structure

```
WandererScreen (modified)
+-- ActionButtonGrid (modified: 5. Mic-Button, Layout 2×3)
+-- AudioSheet (NEW — Bottom Sheet, 3 Zustände)
    +-- [idle] "Aufnahme starten" Button mit Mikrofon-Icon
    +-- [recording]
    |   +-- WaveformVisualizer (Canvas, Amplitude-Balken, 60fps)
    |   +-- Live-Timer (0:00 → 3:00, Warnung ab 2:45)
    |   +-- Transkriptions-Textarea (live interim results, editierbar)
    |   +-- Stopp-Button
    +-- [preview]
        +-- <audio controls> Player mit Play/Pause + Seekbar
        +-- Transkriptions-Textarea (vollständig editierbar, max 2000 Zeichen)
        +-- Optionaler Kommentar (max 500 Zeichen)
        +-- Progress Bar + "Verwenden" / "Neu aufnehmen" Buttons

useAudioRecorder Hook (NEW)
+-- getUserMedia (audio-only)
+-- MediaRecorder (WebM/Opus → OGG/Opus → MP4 Fallback)
+-- SpeechRecognition (Web Speech API, de-DE, interimResults, continuous)
+-- AnalyserNode (Web Audio API, Amplitude für Waveform)
+-- 3-Minuten Auto-Stopp + Stille-Erkennung (5s Toast)
+-- Gibt zurück: isRecording, elapsedSeconds, blob, transcript, amplitudeData, start(), stop()

ContentCard (modified)
+-- [type='audio'] Mikrofon-Icon + Transkript in Anführungszeichen + kompakter Player
```

### Datenmodell
Keine DB-Änderungen. `content_items` unterstützt bereits `type='audio'`, `media_url`, `caption`.

- Storage: `audio` Bucket (bereits live), Pfad `[event_id]/audio/[user_id]/[timestamp]-[uuid].webm`
- `caption` = finaler Transkriptions-Text nach User-Korrektur

### Tech-Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Aufnahme | MediaRecorder API (audio-only) | Browser-nativ, kostenlos, gleiche Pipeline wie PROJ-29 |
| Format | WebM/Opus → OGG/Opus → MP4 Fallback | Kleinste Dateigröße für Sprache; MIME-Erkennung wie bei PROJ-29 |
| Transkription | Web Speech API (Browser-nativ) | Kostenlos, kein Server, läuft live parallel zur Aufnahme |
| Waveform | Canvas + Web Audio API (AnalyserNode) | Browser-nativ, kein extra Paket |
| Audio-Player | Natives `<audio>` + Range-Input als Seekbar | Keine Bibliothek nötig, iOS-kompatibel |
| Storage | `audio` Bucket (bereits live, 20 MB) | Schon vorhanden, kein Setup nötig |
| API-Endpunkt | `POST /api/events/[id]/content` (bestehend) | Akzeptiert bereits `type: 'audio'` und `caption` |

### Was sich ändert vs. was neu ist

**Neu:** `AudioSheet`, `useAudioRecorder` (inkl. WaveformVisualizer als inline Canvas)

**Modifiziert:**
- `ActionButtonGrid` — 5. Mic-Button, Grid wird 2×3
- `WandererScreen` — AudioSheet-State + Handler
- `ContentCard` — Audio-Karte: Mikrofon-Icon, Transkript, kompakter Player

**Unverändert:** Alle API-Routen, DB-Schema, `ContentLightbox` (behandelt `audio` bereits), `VideoSheet`, `PhotoSheet`

### Dependencies
Keine neuen Pakete — Web Speech API, MediaRecorder, Web Audio API und Canvas API sind Browser-nativ.

## QA Test Results

**Tester:** QA (Round 1)  **Date:** 2026-04-06  **Build:** `npm run build` PASS (0 errors, 0 warnings)

### Acceptance Criteria — 13/14 PASS, 1 PARTIAL

| # | AC | Result | Evidence |
|---|---|---|---|
| 1 | MediaRecorder WebM/Opus or OGG/Opus | PASS | use-audio-recorder.ts:64-76 (candidate list incl. mp4 fallback) |
| 2 | Mic-Icon Button starts/stops | PASS | action-button-grid.tsx:53-62, audio-sheet.tsx:335-342, 387-395 |
| 3 | Max 3 min auto-stop, warning at 2:45 | PASS | audio-sheet.tsx:47-48 (MAX=180, WARN=165), use-audio-recorder.ts:376-382 |
| 4 | Live timer 0:00–3:00 | PASS | audio-sheet.tsx:52-56, 359 |
| 5 | Waveform canvas via AnalyserNode | PASS | use-audio-recorder.ts:249-284, audio-sheet.tsx:61-113 |
| 6 | Web Speech API live transcription | PASS | use-audio-recorder.ts:326-366 (de-DE, interim, continuous, auto-restart) |
| 7 | Live transcript appears below recorder | PASS | audio-sheet.tsx:369-385 |
| 8 | Editable textarea after recording, max 2000 | PASS | audio-sheet.tsx:431-453 (TRANSCRIPT_MAX=2000, counter shown) |
| 9 | Audio upload to Storage `[event]/audio/[user]/[ts]-[uuid].[ext]` | PASS | content-upload.ts:328-366 (uses `media` bucket; spec mentions `audio` bucket but CLAUDE.md confirms `media` is the live bucket) |
| 10 | Stored in `content_items` type=audio | PASS | audio-sheet.tsx:236-248 |
| 11 | Pool card: mic icon + transcript in quotes + audio player | PASS | content-card.tsx:145-172 |
| 12 | Audio player play/pause/seek/duration | PASS | content-card.tsx:161-170 (native `<audio controls>` provides all) |
| 13 | Optional comment max 500 | PARTIAL | UI enforces 500 (audio-sheet.tsx:50, 455-477) BUT see BUG-1: combined transcript+comment is capped to 1000 chars total by backend, not the spec's 2000+500=2500 |
| 14 | No empty submit | PASS | audio-sheet.tsx:192-197 (confirm dialog if both empty); submit button disabled if no blob (524-526) |

### Edge Cases — 9/10 PASS

| Case | Result | Evidence |
|---|---|---|
| Speech API unavailable | PASS | use-audio-recorder.ts:119, audio-sheet.tsx:329-334, 371-373 |
| Mic denied | PASS | use-audio-recorder.ts:387-401 (NotAllowedError handled with German message) |
| Partial recognition | PASS | onerror silent, user can edit |
| Silence > 5s toast | PASS | use-audio-recorder.ts:268-281, audio-sheet.tsx:132-134 |
| Lang non-DE | PASS (by design) | lang hard-coded de-DE |
| Interrupted recording | PASS | use-audio-recorder.ts:310-313, audio-sheet.tsx:126-131 (toast, not modal as spec says, see BUG-3) |
| Upload fail retry | PASS | audio-sheet.tsx:495-505 (retry button in alert) |
| Empty transcript warn | PASS | audio-sheet.tsx:192-197 |
| File > 20 MB | PASS | audio-sheet.tsx:214-219 |
| Offline | PARTIAL | Network error message shown but no offline-queue enqueue for audio (offline-queue is started in wanderer-screen but AudioSheet does not enqueue on failure) — see BUG-2 |

### Bugs

**Medium**
- **BUG-1 (Medium)** `audio-sheet.tsx:199-212` — Spec AC requires transcript max 2000 + comment max 500 (=2500). Implementation enforces 2000/500 in the textareas but then combines them into a single `caption` field that the backend Zod schema (`CONTENT_MAX_CAPTION_LENGTH=1000`) rejects above 1000 chars. Result: a user can fill a valid 2000-char transcript and the submit silently fails with "Text zu lang (max. 1000 Zeichen kombiniert)". The textarea limit (2000) is misleading. Suggested fix: either (a) raise backend `CONTENT_MAX_CAPTION_LENGTH` to 2500 and store comment in a separate field, or (b) lower the textarea max to match backend (e.g. transcript 800 + comment 200) and update the spec.

- **BUG-2 (Medium)** `audio-sheet.tsx:263-270` — Edge case "Kein Internet" expects offline queue (PWA Background Sync). Other sheets (PhotoSheet) integrate with `offline-queue`, but AudioSheet only displays a network-error message; the recording is lost on close. Suggested fix: enqueue audio blob via `offline-queue` on `isNetworkError`, mirroring PhotoSheet pattern.

**Low**
- **BUG-3 (Low)** `audio-sheet.tsx:126-131` — Spec edge case "Aufnahme unterbrochen" expects a Dialog "speichern oder verwerfen?". Implementation shows only a toast and lands the user in preview phase (which effectively allows save/discard, so functionality is fine, but UX deviates from spec). Suggested fix: replace toast with shadcn AlertDialog OR update spec.

- **BUG-4 (Low)** `use-audio-recorder.ts:184` — `cleanup` callback depends on `previewUrl` and is recreated whenever the URL changes; the `useEffect` unmount-cleanup at lines 186-203 has empty deps and bypasses `cleanup`, so this is functionally OK but the `cleanup` dependency in `start()`'s useCallback (lines 403-412) causes `start` to be re-created mid-recording, which can subtly invalidate references. Suggested fix: keep `previewUrl` in a ref, not state-dep of cleanup.

- **BUG-5 (Low)** `audio-sheet.tsx:447-452` — Editable transcript textarea in preview phase has no `maxLength` HTML attribute; the JS check happens only on submit. A user can paste 5000 chars and only learn at submit time. Suggested fix: add `maxLength={TRANSCRIPT_MAX}` to both textareas.

- **BUG-6 (Low)** `content-card.tsx:151-159` — Transcript rendered with `&ldquo;{item.caption}&rdquo;` inside JSX (text node) — XSS-safe (React escapes), but the curly quotes around a user-supplied string that may itself contain quotes will look odd. Cosmetic only. No fix required for MVP.

- **BUG-7 (Low)** `use-audio-recorder.ts:330` — Hard-coded `lang = "de-DE"`. Spec accepts this but no a11y/i18n hook. Acceptable for MVP. No fix.

- **BUG-8 (Low)** `audio-sheet.tsx:404` — `<audio>` preview lacks an explicit `preload="metadata"` (defaults to browser, often "metadata"). On iOS Safari with blob URL this can briefly show 0:00 duration. Cosmetic. Suggested: add `preload="metadata"`.

**Critical / High:** none.

### Security Audit
- Transcript rendered as text node (React-escaped) — no XSS. PASS
- Upload uses authenticated Supabase client; backend `/api/events/[id]/content` already verifies membership for other types. PASS
- File path includes `eventId/userId` — RLS-friendly. PASS
- MIME type sniffed via `MediaRecorder.isTypeSupported` — no client-controlled blob type passed unchecked (it is the recorder's own output). PASS
- No secrets, no `dangerouslySetInnerHTML`. PASS

### Build / Lint
`npm run build` → compiled successfully, 0 errors, 0 warnings, all 10 routes generated.

### Verdict
**Production Ready: NO** — BUG-1 (caption length cap) is a real user-facing failure path that should be resolved before deploy. BUG-2 (offline queue) breaks a documented edge case and an existing app convention. BUG-3 to BUG-8 are Low and may be deferred but per project rule "fix all bugs before deploy" should be addressed.

**Recommended next step:** Send back to `/backend` or `/frontend` to fix BUG-1 + BUG-2, then re-run `/qa`.

### QA Round 2 (Re-test)
**Date:** 2026-04-06 — Verifying 7 fixes from Round 1 (BUG-7 N/A per spec).

**BUG-1 (M) — Caption length raised to 2500:** PASS
- `src/lib/validations/content.ts:15` Zod `.max(2500, ...)` and `:40` `CONTENT_MAX_CAPTION_LENGTH = 2500`. AudioSheet uses the constant at `src/components/audio-sheet.tsx:212`.

**BUG-2 (M) — Offline queue for audio:** PASS
- `src/components/audio-sheet.tsx:269-294` catch block checks `isNetworkError(err)` and calls `enqueue(...)` with the recorded blob; handles `OfflineQuotaError` correctly.
- `src/lib/offline-queue.ts:168-184` `flushQueue` re-uploads `payload.type === "audio"` items via `uploadAudioToStorage` using stored `audio_mime_type`, then strips the helper field before POST.

**BUG-3 (L) — Interruption prompt:** PASS
- `src/components/audio-sheet.tsx:127-136` `onInterrupted` callback uses `window.confirm(...)` (no `toast.info`); discards on cancel via `setTimeout(recorder.discard, 0)`.

**BUG-4 (L) — `cleanup` no longer depends on `previewUrl` state:** PASS
- `src/hooks/use-audio-recorder.ts:113` introduces `previewUrlRef`. `cleanup` deps `[clearTimer, stopAnalyser, stopRecognition, stopStreamTracks]` (line 191) — no `previewUrl`. `start` deps (line 412-420) and `discard` (line 443) likewise omit it. Revoke uses `previewUrlRef.current` at lines 179, 215, 431.

**BUG-5 (L) — Textareas have `maxLength`:** PASS
- Live transcript `maxLength={TRANSCRIPT_MAX}` at line 411.
- Edit transcript `maxLength={TRANSCRIPT_MAX}` at line 481.
- Comment `maxLength={COMMENT_MAX}` at line 506.

**BUG-6 (L) — Curly quotes removed:** PASS
- `src/components/content-card.tsx:151-159` audio caption rendered as plain `{item.caption}` inside `<p>`; no `&ldquo;`/`&rdquo;` entities present.

**BUG-7 (L) — Locale hardcoded:** N/A (de-DE per spec, no fix required).

**BUG-8 (L) — `<audio preload="metadata">`:** PASS
- `src/components/audio-sheet.tsx:434` preview `<audio>` element has `preload="metadata"`.

### Build
`npm run build` → compiled successfully, 0 errors, all routes generated.

### Regression Spot-Check
Re-reviewed AudioSheet states (idle/recording/preview), recorder lifecycle (start/stop/discard/cleanup with ref-based URL handling), and offline queue (photo branch unchanged at lines 146-165, audio branch additive). No regressions to PROJ-27/28/29 surfaces. Caption max raise from 1000→2500 is backward compatible (no existing data exceeds 1000).

### Verdict
**Production Ready: YES** — All 7 actionable bugs from Round 1 are fixed and verified by file/line evidence. BUG-7 is N/A by design. Build is clean. Ready for `/deploy`.

## Deployment

**Deployed:** 2026-04-06
**Production URL:** https://frank-lernt.vercel.app
**QA Status:** Round 2 — all 7 actionable bugs fixed (BUG-7 N/A per spec). Build clean, no regressions.
