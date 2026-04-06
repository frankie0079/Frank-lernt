# PROJ-30: Sprachmemo + automatische Transkription

## Status: Planned
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
_To be added by /qa_

## Deployment
_To be added by /deploy_
