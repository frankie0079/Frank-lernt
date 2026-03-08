# PROJ-29: Video-Aufnahme (bis 90 Sekunden)

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-27 (Wanderer-Screen) — Video-Aufnahme ist eine der 4 Aktionen im Wanderer-Screen
- Requires: PROJ-28 (Content-Pool) — Videos werden im Content-Pool angezeigt

## User Stories
- Als Wanderer möchte ich ein Video bis 90 Sekunden direkt in der PWA aufnehmen, damit ich Momente festhalten kann die ein Foto nicht einfängt.
- Als Zuschauer möchte ich Videos im Content-Pool mit einem Tap abspielen, ohne die App zu verlassen.
- Als Wanderer möchte ich vor dem Absenden eine Vorschau sehen, damit ich schlechte Aufnahmen verwerfen kann.

## Acceptance Criteria
- [ ] Video-Aufnahme via MediaRecorder API (`getUserMedia({video: true, audio: true})`)
- [ ] Ausgabeformat: WebM/VP8 (Chrome, Android), MP4/H.264 via fallback-Erkennung (Safari iOS)
- [ ] Maximale Aufnahmelänge: 90 Sekunden (automatischer Stop mit `mediaRecorder.stop()`)
- [ ] Live-Timer während Aufnahme sichtbar (Format: `00:00` bis `01:30`, rot bei > 1:15)
- [ ] Aufnahme-Button: Rotes Kreis-Icon zum Starten, Stopp-Button während Aufnahme
- [ ] Vorschau nach Aufnahme: Native `<video>` Element mit Play-Button, Loop deaktiviert
- [ ] Verwerfen-Button ("Neu aufnehmen") und Bestätigen-Button ("Verwenden") in Vorschau
- [ ] Standbild (erster Frame) wird als Thumbnail generiert via Canvas API (400px, JPEG 0.8)
- [ ] Video-Upload zu Supabase Storage (Bucket: `media`, max 100 MB)
- [ ] Thumbnail-URL wird separat in `content_items.thumbnail_url` gespeichert
- [ ] Im Content-Pool: Standbild mit Play-Symbol (▶) als Overlay
- [ ] Tap auf Karte → Video-Player Overlay (natives `<video>` mit `controls`, `playsInline`, `autoPlay`)
- [ ] Optionaler Kommentar (max 1000 Zeichen) vor dem Absenden
- [ ] Upload-Fortschrittsbalken (Prozent aus `XMLHttpRequest` oder Supabase Upload-Callback)

## Edge Cases
- Kamera- oder Mikrofon-Zugriff verweigert → Fehlermeldung "Kamera-Zugriff benötigt" mit Einstellungs-Link
- MediaRecorder API nicht unterstützt (Safari < 14.5) → Hinweismeldung "Video-Aufnahme nicht verfügbar — bitte Video aus der Galerie hochladen" + Weiterleitung zum Upload-Button
- Eingehender Anruf unterbricht Aufnahme → `mediaRecorder`-`stop`-Event feuert → Dialog "Aufnahme unterbrochen — speichern oder verwerfen?"
- Aufnahme-Datei > 100 MB (extrem langer, hochauflösender Clip) → Fehlermeldung "Datei zu groß" nach Generierung, vor Upload
- Gerätespeicher voll während Aufnahme → Fehler-Event vom MediaRecorder → "Gerätespeicher voll" Meldung
- Upload schlägt fehl (Verbindungsabbruch) → Fehlermeldung mit Retry-Button, lokale Blob-URL bleibt erhalten
- Nutzer tippt "Zurück" während Aufnahme → Bestätigungs-Dialog "Aufnahme abbrechen?"
- Video-Datei beschädigt / nicht abspielbar → Platzhalter in Content-Pool + Fehlermeldung beim Versuch abzuspielen
- Gleichzeitig Foto und Video absenden (schnelles Doppeltippen) → Race-Condition verhindert durch Deaktivieren der Buttons während Upload

## Technical Requirements
- `navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}, audio: true})`
- MediaRecorder MIME-Type-Erkennung: `MediaRecorder.isTypeSupported('video/webm;codecs=vp8')` → Fallback auf `video/mp4`
- Thumbnail-Generierung: Video-Element auf Canvas zeichnen nach `loadeddata`-Event, `canvas.toBlob('image/jpeg', 0.8)`
- Storage-Pfad: `[event_id]/videos/[user_id]/[timestamp]-[uuid].[ext]`
- `content_items.type = 'video'`, `media_url` = volle Video-URL, `thumbnail_url` = Thumbnail-URL
- Maximale Dateigröße: 100 MB (Supabase Storage Limit), client-seitige Prüfung der Blob-Größe
- Aufnahme-Timer: `setInterval` alle 1000ms, `requestAnimationFrame` für Live-Preview (`srcObject = stream`)
- Rate-Limiting: Gilt für alle Content-Items (PROJ-27), kein separates Limit

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
