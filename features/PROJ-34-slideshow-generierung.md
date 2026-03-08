# PROJ-34: Slideshow-MP4 Generierung & WhatsApp-Export

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-33 (Tages-Admin Kurations-Workflow) — kuratierter Tagesbericht als Input für die Slideshow

## User Stories
- Als Tages-Admin möchte ich aus dem kuratierten Tagesbericht automatisch eine Slideshow generieren, damit ich Followern einen visuellen Tagesrückblick schicken kann.
- Als Tages-Admin möchte ich die Slideshow vor dem Versenden vorschauen, damit ich sicherstellen kann dass sie gut aussieht.
- Als Tages-Admin möchte ich die Slideshow direkt via WhatsApp teilen, damit Follower sie sofort auf ihrem Handy erhalten.
- Als Organisator möchte ich einmalig einen Style (Übergänge, Geschwindigkeit) festlegen, damit alle Slideshows einheitlich aussehen.

## Acceptance Criteria
- [ ] Slideshow-Generierung vollständig client-side (Canvas API + MediaRecorder, kein Server nötig)
- [ ] Ausgabeformat: WebM/VP8 (Chrome, Firefox), MP4-Fallback-Hinweis für Safari (Download als WebM)
- [ ] Auflösung: 1080×1920 (9:16 Hochformat, Standard), optional 1920×1080 (16:9 Querformat) wählbar
- [ ] Deckblatt: Event-Name, Datum, Tages-Titel (Agenda-Punkt-Name), Cover-Foto als Hintergrund mit Dunkel-Overlay
- [ ] Pro Beitrag: Foto-Vollbild / Video-Standbild-Frame + Autoren-Badge (Avatar + Name, unten links) + optionaler Caption-Text
- [ ] Text-Only Beiträge: Gradient-Hintergrund (Teal → Amber) + Text zentriert + Autoren-Badge
- [ ] Übergänge: Fade (Standard) oder Slide von rechts (wählbar in Event-Einstellungen)
- [ ] Anzeigedauer pro Foto: Standard 3 Sekunden, einstellbar von 1–8 Sekunden (Event-Einstellung)
- [ ] Generierungsdauer für 20 Fotos: max. 60 Sekunden
- [ ] Fortschrittsbalken während Generierung: "Bild X von Y", Prozent-Anzeige
- [ ] Vorschau-Button: Slideshow im Browser abspielen (natives `<video>` mit Blob-URL) vor Download/Teilen
- [ ] Export-Optionen: "Herunterladen" (Browser-Download) + "Teilen" (Web Share API mit File-Sharing)
- [ ] Fertige Slideshow wird zu Supabase Storage hochgeladen (Bucket: `slideshows`, Pfad: `[event_id]/[agendaItemId].[ext]`)
- [ ] Generierungs-Button: "Slideshow erstellen" — Meldung wenn kein Foto im Bericht
- [ ] Abbrechen-Button während Generierung

## Edge Cases
- Kein Foto im Bericht (nur Text-Beiträge) → Text-Karten mit Gradient-Hintergrund werden generiert, kein Fehler
- Video-Beitrag im Bericht → Erster Frame wird per Canvas als Standbild verwendet, Video-Icon-Overlay auf dem Frame
- Browser unterstützt MediaRecorder nicht / kein WebM-Support (Safari iOS < 16) → Fallback: JPEG-Sequenz als ZIP-Download, Hinweis "Für MP4-Unterstützung Chrome oder Firefox nutzen"
- Web Share API mit File-Objekt nicht verfügbar (`navigator.share` ohne Files-Support) → Nur Download-Button sichtbar, Teilen-Button ausgeblendet
- Generierung schlägt fehl (Speicher voll, Canvas-Error) → Retry-Button + Fehlermeldung "Generierung fehlgeschlagen — bitte erneut versuchen"
- Slideshow > 50 MB (sehr viele hochauflösende Fotos, langer Clip) → Warnung "Grosse Datei — WhatsApp-Limit ist 16 MB. Weniger Fotos wählen oder Dauer verkürzen."
- Nutzer verlässt Seite während Generierung → Generierung bricht ab (Web Worker wird beendet), beim nächsten Öffnen kein Auto-Start
- Bereits generierte Slideshow für diesen Tag vorhanden → Hinweis "Slideshow bereits erstellt am [Datum]. Neu generieren?"
- Supabase Storage Upload schlägt fehl nach lokaler Generierung → Slideshow bleibt als lokale Blob-URL, Download trotzdem möglich
- Bild aus Supabase Storage nicht ladbar → Platzhalter-Frame (Teal-Gradient + Autoren-Badge) wird verwendet

## Technical Requirements
- Canvas 2D Context (OffscreenCanvas in Web Worker für Non-Blocking-Rendering)
- `requestAnimationFrame` für flüssige 30fps Frame-Generierung (alternativ: synchrones Frame-für-Frame in Worker)
- MediaRecorder API: `new MediaRecorder(canvasStream, {mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 2_500_000})`
- `canvas.captureStream(30)` für Echtzeit-Stream aus Canvas
- Übergangs-Implementierung: Fade = `globalAlpha`-Interpolation über N Frames; Slide = `drawImage` mit X-Offset-Animation
- Bild-Vorladung: Alle Bilder per `new Image()` + CORS voraufladen bevor Generierung startet
- Web Worker: Wenn `OffscreenCanvas` verfügbar → Worker, sonst Main Thread mit `setTimeout`-Yielding alle 100ms
- Supabase Storage Upload nach Generierung: `supabase.storage.from('slideshows').upload(path, blob, {contentType: 'video/webm', upsert: true})`
- Event-Einstellungen-Tabelle: `event_settings` (event_id UUID FK, slideshow_transition TEXT DEFAULT 'fade', photo_duration_sec INT DEFAULT 3)
- Keine externen Bibliotheken (kein FFmpeg.wasm, kein Remotion) — komplett native Web APIs

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
