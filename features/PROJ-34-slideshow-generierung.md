# PROJ-34: Slideshow-MP4 Generierung & WhatsApp-Export

## Status: In Progress
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

### Übersicht

PROJ-34 ist ein **reines Frontend-Feature** mit zwei kleinen Backend-Ergänzungen:
1. Ein neuer Datenbank-Eintrag für Event-Einstellungen (Übergangseffekt, Anzeigedauer)
2. Upload der fertigen Slideshow in Supabase Storage (Bucket `slideshows`)

Alles andere — Rendering, Encoding, Preview — passiert vollständig im Browser des Admins. Kein Server, keine bezahlte API.

---

### Komponenten-Struktur

```
/events/[id]/admin  (bestehende Seite — Admin Workflow)
└── ReportEditor (bestehend: src/components/report-editor.tsx)
    └── SlideshowGeneratorPanel  ← NEU
        ├── GenerateButton  ("Slideshow erstellen" / "Bereits erstellt — neu generieren?")
        ├── SlideshowProgressBar  (während Generierung: "Bild X von Y — 60%", Abbrechen-Button)
        ├── SlideshowPreviewPlayer  ← NEU (nach Generierung: natives <video> mit Blob-URL)
        ├── ExportActions  (Download-Button + Teilen-Button — Teilen nur wenn Web Share API mit Files vorhanden)
        └── SlideshowWarningBanner  (Datei > 16 MB → WhatsApp-Limit-Hinweis, Safari-Fallback-Hinweis)

Web Worker (src/workers/slideshow-worker.ts)  ← NEU
    Rendert Frame für Frame auf OffscreenCanvas
    Schickt Fortschritts-Updates ans UI
    Liefert fertigen Blob zurück

Event-Einstellungen (Erweiterung bestehender event-edit-sheet.tsx)
    ├── Übergang: Fade / Slide von rechts  (Radio Group)
    ├── Foto-Anzeigedauer: 1–8 Sekunden  (Slider oder Select)
    └── Format: 9:16 Hochformat / 16:9 Querformat  (Toggle)
```

---

### Datenmodell (Ergänzungen)

**Neue Tabelle: `event_settings`**
- Verknüpft mit einem Event (1:1)
- Felder: `slideshow_transition` (fade oder slide, Standard: fade), `photo_duration_sec` (Zahl 1–8, Standard: 3), `slideshow_format` (portrait oder landscape, Standard: portrait)
- Wird nur beim Ändern der Event-Einstellungen angelegt/aktualisiert

**Supabase Storage — Bucket `slideshows`** (bereits im Spec geplant)
- Pfad: `[event_id]/[agenda_item_id].webm`
- Wird nach Generierung hochgeladen — schlägt der Upload fehl, bleibt der lokale Blob trotzdem verfügbar

**Keine neuen Spalten in bestehenden Tabellen nötig** — `daily_reports` bleibt unverändert.

---

### Tech-Entscheidungen

| Entscheidung | Warum |
|---|---|
| **Web Worker + OffscreenCanvas** | Rendering blockiert nicht den UI-Thread — Fortschrittsbalken bleibt flüssig, Seite friert nicht ein |
| **MediaRecorder / WebM** | Einziges Format, das client-side ohne externe Libraries encodiert werden kann. Chrome + Firefox: WebM/VP8. Safari iOS: kein MediaRecorder → ZIP-Fallback |
| **Safari-Fallback: JPEG-Sequenz als ZIP** | Statt nichts zu liefern bekommt der Admin einzelne Bilder zum manuellen Zusammenfügen — besser als Fehlermeldung |
| **Kein FFmpeg.wasm, kein Remotion** | Beide Optionen kosten entweder Geld (Remotion Lambda) oder erzeugen ~30 MB Bundle-Größe (FFmpeg). Native APIs reichen |
| **Blob-URL für Preview** | Fertige Slideshow liegt als Blob im Speicher → sofortiger Preview im Browser ohne Upload-Wartezeit |
| **Upload erst nach Preview** | Admin kann Qualität prüfen bevor Datei hochgeladen wird — verhindert unnötige Storage-Kosten |
| **Einstellungen in Event-Settings, nicht Report** | Übergang + Dauer sind globale Event-Präferenzen, nicht pro Tagesbericht — konsistentes Aussehen über alle Tage |

---

### Neue Dateien (Übersicht)

| Datei | Zweck |
|---|---|
| `src/components/slideshow-generator-panel.tsx` | Haupt-UI: Button, Fortschritt, Preview, Export |
| `src/components/slideshow-preview-player.tsx` | Video-Player für Blob-URL |
| `src/workers/slideshow-worker.ts` | Web Worker: Canvas-Rendering + Encoding |
| `src/app/api/events/[id]/settings/route.ts` | GET + PUT Event-Einstellungen |
| `supabase/migrations/20260407_event_settings.sql` | Neue Tabelle `event_settings` mit RLS |

### Geänderte Dateien (Übersicht)

| Datei | Änderung |
|---|---|
| `src/components/report-editor.tsx` | SlideshowGeneratorPanel einbinden |
| `src/components/event-edit-sheet.tsx` | Slideshow-Einstellungen (Übergang, Dauer, Format) hinzufügen |

---

### Abhängigkeiten (neue Packages)

| Package | Zweck |
|---|---|
| `jszip` | ZIP-Download-Fallback für Safari (JPEG-Sequenz) |

Alle anderen Tools (Canvas API, MediaRecorder, Web Share API, OffscreenCanvas) sind Browser-nativ — kein weiteres Package nötig.

---

### Generierungs-Ablauf (plain language)

1. Admin klickt "Slideshow erstellen"
2. Browser lädt alle Bilder des kuratierten Berichts vor (CORS-konform aus Supabase Storage)
3. Web Worker startet — rendert Frame für Frame auf OffscreenCanvas:
   - Deckblatt (Event-Name, Datum, Agenda-Titel, Cover-Foto mit Dunkel-Overlay)
   - Pro Beitrag: Vollbild-Foto / Gradient-Karte (Text) / Video-Standbild mit Video-Icon
   - Autoren-Badge unten links (Avatar-Kreis + Name)
   - Übergänge (Fade oder Slide) zwischen Frames
4. MediaRecorder zeichnet den Canvas-Stream auf → WebM-Datei entsteht
5. Fortschrittsbalken zeigt "Bild X von Y" in Echtzeit
6. Fertig: Video-Preview erscheint im Browser
7. Admin wählt: Herunterladen oder Teilen (WhatsApp via Web Share API)
8. Im Hintergrund: Upload nach Supabase Storage

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
