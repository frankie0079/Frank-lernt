# PROJ-41: Tour-Tracker

## Status: In Review
**Created:** 2026-04-23
**Last Updated:** 2026-04-23

## Dependencies
- Requires: PROJ-27 (Wanderer-Screen) — der Erfassen-Tab, in den der Tour-Tracker-Button eingebaut wird
- Requires: PROJ-24 (Auth) — Tour wird nur für eingeloggte Teilnehmer gestartet
- Nutzt automatisch: PROJ-39 (Upload-SHA-256-Dedup) — der Dedup-Pfad greift beim Reportfoto-Upload ohne Anpassung

## Hintergrund

Wandergruppen auf mehrtägigen Events (z.B. Rota Vincentina, Portugal, 8 Tage) legen täglich 20–30 km zurück. Bisher gibt es keine Möglichkeit, eine Tagesetappe automatisch zu erfassen — die Teilnehmer können Fotos, Videos und Notizen hochladen, aber keine strukturierten Bewegungsdaten.

Der Tour-Tracker schließt diese Lücke: Ein Tipp auf „Tour-Tracker" startet die GPS-Aufnahme. Nach der Etappe tippt der Wanderer auf „Speichern" — und ein **Reportfoto** (Canvas-PNG) landet automatisch im Content-Pool des Events, sichtbar für alle Teilnehmer, reaktionsbar, kommentierbar, in der Slideshow nutzbar und im PDF-Tagebuch exportierbar. Das Reportfoto enthält alle Kennzahlen der Etappe sowie eine Polyline-Karte des Routenverlaufs.

## Design-Entscheidungen (abgestimmt)

1. **Speicherung: nur als PNG-Reportfoto** — kein neues DB-Schema, keine neue Tabelle, keine neue Spalte. Das Reportfoto ist ein normales `content_items`-Row mit `type="photo"`, erkennbar an einer spezifischen Caption. Nicht nachträglich editierbar.
2. **Karte: Polyline auf weißem Canvas** — kein Tile-Fetch, kein externer Service, vollständig offline-fähig. Die Route als einfarbige Linie auf hellem Hintergrund, Start- und Endpunkt als farbige Kreise.
3. **iOS-Safari-Constraint** — JavaScript pausiert wenn der Bildschirm sperrt. Kein Workaround für Background-Tracking möglich (kein nativer App-Zugang). Benutzer wird aktiv darauf hingewiesen und Wake-Lock wird angefordert.

## User Stories

- Als Wanderer möchte ich während einer Tagesetappe auf „Tour-Tracker starten" tippen und meine Bewegung automatisch aufnehmen lassen, damit ich mich auf das Wandern konzentrieren kann, statt manuell Zeit und Distanz zu notieren.
- Als Wanderer möchte ich die Tour kurz unterbrechen können (Mittagspause, Fotostopp), um dann nahtlos weiterzumachen, ohne eine neue Aufnahme starten zu müssen.
- Als Wanderer möchte ich am Ende der Etappe auf „Speichern" tippen, und ein Reportfoto soll automatisch in den Content-Pool des Events hochgeladen werden, damit alle Teilnehmer die Tagesleistung sehen können.
- Als Teilnehmer im Content-Pool möchte ich das Reportfoto kommentieren und mit Emojis reagieren können, genau wie auf ein normales Foto.
- Als Tages-Admin möchte ich das Reportfoto in der Kurations-Ansicht sehen und für die Tages-Slideshow auswählen können.
- Als Organisator möchte ich, dass das Reportfoto auch im PDF-Tagebuch erscheint, damit die Streckendaten dauerhaft festgehalten sind.
- Als Wanderer möchte ich nach einem unerwarteten Absturz der App oder einem Neustart gefragt werden, ob ich die unterbrochene Tour fortsetzen möchte.

## Acceptance Criteria

- [ ] Ein 5. Button „Tour-Tracker" erscheint auf dem Erfassen-Tab, deutlich vom Rest unterscheidbar (volles Breite, eigene Zeile oder `col-span-2`)
- [ ] Tippen auf „Tour-Tracker" öffnet ein Sheet; dort ist ein roter Button mit Text „Starte die Aufnahme" sichtbar
- [ ] Tippen auf „Starte die Aufnahme" startet die GPS-Aufnahme; das Sheet zeigt danach Live-Stats in Echtzeit: aktuelle Geschwindigkeit (km/h), Durchschnittsgeschwindigkeit (km/h), zurückgelegte Distanz (km), Höhenmeter aufwärts (m), Höhenmeter abwärts (m)
- [ ] Während der Aufnahme ist ein „Pausieren"-Button sichtbar; Tippen friert alle Stats ein und stoppt das GPS-Tracking
- [ ] Im Pause-Zustand erscheint ein roter „Fortsetzen"-Button und ein „Speichern"-Button; Tippen auf Fortsetzen nimmt das Tracking wieder auf
- [ ] Tippen auf „Speichern" beendet die Aufnahme, rendert ein Reportfoto (Canvas-PNG) und lädt es als normalen Beitrag in den Content-Pool des aktuellen Events hoch; das Sheet schließt sich nach erfolgreichem Upload
- [ ] Das Reportfoto enthält: Event-Name, Datum, alle 5 Stats (Distanz, Dauer, Ø-Speed, Aufstieg, Abstieg), eine Polyline-Karte des Routenverlaufs mit Start- und Endpunkt-Markern
- [ ] Der hochgeladene Beitrag erscheint im Content-Pool mit Badge „Foto", hat Reaktions- und Kommentar-Funktionalität wie jedes andere Foto
- [ ] Beim Sheet-Öffnen erscheint ein einmaliger Toast/Hinweis: „Bitte Bildschirm aktiv halten — Aufnahme pausiert wenn der Bildschirm sperrt"
- [ ] Wenn GPS-Berechtigung verweigert wurde, zeigt das Sheet einen erklärenden Fehlerhinweis und den Weg zur Einstellung; der Aufnahme-Button bleibt deaktiviert
- [ ] Wenn GPS-Signal verloren geht (während laufender Tour), friert die Geschwindigkeit ein (zeigt 0 km/h), die Distanz akkumuliert nicht weiter; ein Hinweis informiert über den Signalverlust; wenn das Signal zurückkommt, läuft die Aufnahme automatisch weiter
- [ ] Nach App-Neustart (während eine Tour lief): Öffnen des Tour-Tracker-Sheets zeigt einen „Tour fortsetzen"-Dialog mit den gespeicherten Stats; Ablehnen löscht den Snapshot und startet neu

## Edge Cases

- **GPS-Permission denied beim Start:** Sheet zeigt GpsStatusBadge mit Erklärungstext und Link zu den iOS/Android-Einstellungen. Aufnahme-Button ist disabled.
- **GPS-Signalverlust mitten in der Tour:** Aktuelle Geschwindigkeit auf 0 setzen, kein weiterer Distanz-Zuwachs. Hinweisbanner im Sheet. Beim Wiederverbinden automatisch weiter akkumulieren.
- **Bildschirm-Sperre auf iOS Safari (PWA):** JS pausiert, watchPosition-Callbacks kommen nicht mehr an. Dank localStorage-Snapshot (alle 30s) gehen maximal 30s Daten verloren. Beim Tippen auf „Fortsetzen" (nach Entsperren) läuft die Tour weiter ohne Reset.
- **Sehr lange Tour (>2h, >2000 GPS-Punkte):** Neue Punkte werden auf 1/3s gedrosselt (min. 3s Abstand). Bei >2000 Punkten wird für die Polyline-Darstellung eine Ramer-Douglas-Peucker-Simplifikation angewendet (nur Darstellung, Stats bleiben aus den vollen Rohdaten berechnet).
- **Höhen-Rauschen (GPS-Altitude-Noise):** EMA-Filter auf Altitude (α=0.3) + Mindest-Delta von 2m bevor ein Höhenunterschied akkumuliert wird. Verhindert fiktive Höhenmeter durch GPS-Jitter.
- **Wake-Lock-API nicht verfügbar (Safari < 17, Firefox ohne Flag):** Graceful Degradation — kein Fehler, nur Toast-Warnung ohne Wake-Lock-Bestätigung.
- **App-Neustart / Tab-Reload während Aufnahme:** localStorage-Snapshot (Stats + Punkte) wird erkannt, Resume-Dialog erscheint.
- **Tippen auf „Speichern" ohne GPS-Punkte (z.B. GPS nie gestartet):** Fehlermeldung „Keine Tourendaten vorhanden — mindestens 10 Sekunden aufnehmen vor dem Speichern". Kein Upload.
- **Upload schlägt fehl (Offline, Storage-Error):** Toast-Fehlermeldung, Sheet bleibt offen, Stats bleiben erhalten; Nutzer kann erneut versuchen.
- **Doppeltes Speichern derselben Tour:** Dedup via SHA-256 (PROJ-39) greift automatisch — zweiter Upload wird als Duplikat erkannt.

## Technical Requirements

- **Keine Datenbankänderung** — Reportfoto wird als `type="photo"` content_item gespeichert; die Caption enthält den Tour-Hinweis (z.B. „🗺️ Tour-Report: X km · Xh Xm · ↑Xm ↓Xm")
- **Keine neuen API-Routes** — bestehende `POST /api/events/[id]/content` reicht
- **Neue Dateien:**
  - `src/hooks/use-tour-tracker.ts` — kontinuierliches GPS-Tracking via `watchPosition`, Live-Stats-Berechnung, Pause/Resume/Reset-Steuerung, localStorage-Snapshot
  - `src/components/tour-tracker-sheet.tsx` — UI-Sheet mit drei Phasen (Idle/Recording/Paused), Reportfoto-Generierung via `tour-report.ts`, Upload via bestehender Pipeline
  - `src/lib/tour-report.ts` — Pure Canvas-Rendering-Funktion, gibt `Blob` zurück
- **Geänderte Dateien:**
  - `src/components/action-button-grid.tsx` — 5. Button mit `col-span-2`, Icon + Label „Tour-Tracker"
  - `src/components/wanderer-screen.tsx` — Sheet-State + Handler einbauen
- **Wiederverwendung:**
  - `src/lib/content-upload.ts` → `processAndUploadImage` für Storage-Upload
  - `src/lib/file-hash.ts` → `computeSHA256` + `checkDuplicate` (automatisch aktiv)
  - `src/components/gps-status-badge.tsx` → Erlaubnis-Anzeige
  - `src/components/ui/sheet.tsx` → Container (shadcn, bereits installiert)
- **Browser-APIs:** `navigator.geolocation.watchPosition` (GPS), `navigator.wakeLock.request('screen')` (Wake Lock, optional), `localStorage` (Snapshot), `HTMLCanvasElement` (Reportfoto)

---

## Tech Design (Solution Architect)
_Übersprungen — vollständiger Tech-Plan liegt in `.claude/plans/gleaming-questing-tide.md`_

## Frontend Implementation

**Implementiert am:** 2026-04-23

### Neue Dateien
- **`src/hooks/use-tour-tracker.ts`** — GPS-Tracking-Hook. Kapselt `navigator.geolocation.watchPosition` mit `{ enableHighAccuracy: true, timeout: 10_000, maximumAge: 2_000 }`. Drosselt Punkte auf min. 3 s Abstand. Berechnet Distanz via Haversine zwischen konsekutiven Punkten. Elevation Gain/Loss mit EMA-Filter (α=0,3) und 2 m-Mindest-Delta. Current Speed bevorzugt `coords.speed`, fällt zurück auf Δ-Distanz/Δ-Zeit der letzten beiden Punkte. Avg Speed = `distanceM / (activeDurationMs/1000)` in km/h. `pause()`/`resume()` verwalten Segment-basierte `activeDurationMs`-Akkumulation und setzen ein Skip-Flag, damit der erste Punkt nach Resume nicht als Distanz-Schritt zum pre-pause Punkt gezählt wird. Signalverlust: wenn >10 s seit dem letzten Update kein Tick, `currentSpeedKmh=0` und `signalLost=true`. localStorage-Snapshot (`tour-tracker-snapshot-${eventId}`, TTL 24 h) alle 30 s während Recording, beim Pause und beim Start. `resumeFromSnapshot()` lädt den Snapshot und setzt den Status auf `paused`, damit der User aktiv weiterstarten muss. GPS-Status wird initial über `navigator.permissions.query` probiert.
- **`src/components/tour-tracker-sheet.tsx`** — Drei-Phasen-UI (Idle / Recording / Paused). Im Idle: Info-Alert zu iOS-Wake-Lock + destructive „Starte die Aufnahme"-Button. In Recording: Timer (HH:MM:SS), 6 StatCards (Geschwindigkeit, Ø-Geschwindigkeit, Distanz, Dauer, ↑ Aufstieg, ↓ Abstieg), Pausieren- + Speichern-Button. In Paused: identische Stats (gedimmt), Fortsetzen- + Speichern-Button + Verwerfen-Footer. Resume-Dialog (AlertDialog) beim Öffnen wenn `hasSnapshot=true`. Wake-Lock wird beim Eintritt in `recording` angefordert und bei `visibilitychange` reakquiriert. Speichern-Flow: `renderTourReport()` → `File` → `computeSHA256` → `checkDuplicate` → `processAndUploadImage` → `POST /api/events/[id]/content` mit `type="photo"`, `caption = formatTourCaption(stats)`, Startpunkt-GPS als lat/lng, `exif_date = startedAt.toISOString()`. Mindestanforderung zum Speichern: 50 m Distanz UND 5 GPS-Punkte. Schließen während Recording zeigt Bestätigungsdialog; Tour bleibt via localStorage-Snapshot erhalten.
- **`src/lib/tour-report.ts`** — Pure-Canvas-Rendering (OffscreenCanvas wenn verfügbar, sonst `document.createElement("canvas")`). 1200×1200 px. Kopf (200 px): Event-Name in Caveat/Dancing Script-Schrift (auto-shrink wenn zu breit) + Datum. Mitte (600 px): Polyline-Karte auf hellgrauem Rounded-Rect, Teal-Route, grüner A-Marker (Start), roter B-Marker (Ende). RDP-Simplifikation (ε=0,00005°) bei >2000 Punkten. Kollabierte/fehlende Routen zeigen Platzhalter „Kein Routenverlauf". Unten (400 px): Stats in 2 Reihen (Distanz/Dauer/Ø-Speed in Reihe 1, Aufstieg/Abstieg grün/rot in Reihe 2). Export via `canvas.convertToBlob({ type: "image/png" })` mit Fallback auf `HTMLCanvasElement.toBlob`. Exportiert Formatter `formatDistance`, `formatDuration`, `formatSpeed`, `formatTourCaption` für Sheet-Wiederverwendung.

### Geänderte Dateien
- **`src/components/action-button-grid.tsx`** — Neue Prop `onTourTracker`, 5. Button mit `col-span-2`, horizontalem Layout, Icon `Route`, Label „Tour-Tracker".
- **`src/components/wanderer-screen.tsx`** — Neue Prop `eventName`, neuer State `tourSheetOpen`, Handler `handleTourTracker`, `<TourTrackerSheet>` unten eingebaut. Disabled-Logik für ActionButtonGrid erweitert um `tourSheetOpen`.
- **`src/app/events/[id]/page.tsx`** — `eventName={event.name}` an `<WandererScreen>` durchgereicht.

### Edge-Cases, die durch die Implementierung gelöst sind
- **GPS-Permission denied:** Banner im Sheet zeigt Erklärung, Start-Button ist disabled.
- **GPS-Signalverlust mitten in der Tour:** `currentSpeedKmh=0`, Alert-Banner, Distanz wächst nicht, Tour läuft weiter sobald Position wiederkommt.
- **iPhone-Sperre während Recording:** Wake-Lock-API wird angefordert; bei Fehlen eine Toast-Warnung. visibilitychange-Listener reakquiriert den Lock beim Foreground-Wechsel. Snapshot alle 30 s minimiert Datenverlust.
- **>2000 Punkte:** RDP-Simplifikation vor Polyline-Draw; Stats bleiben aus Rohdaten korrekt.
- **Altitude-Noise:** EMA α=0,3 + 2 m-Delta-Filter.
- **OffscreenCanvas nicht verfügbar:** Fallback auf `document.createElement("canvas")` + Promise-Wrapper um `toBlob`.
- **Doppelter Speicher-Klick:** `saving` Guard im Sheet, dedup via SHA-256 (PROJ-39) greift automatisch.
- **Pause mitten in einem Meter-Sprung:** `skipNextHaversineRef` überspringt den ersten Punkt nach Resume.
- **Ranzige Snapshots >24 h:** werden beim Read automatisch gelöscht.

### Nicht implementiert (Field-Test erforderlich)
- Echter GPS-Test unter Bewegung (iPhone, Feldbedingungen, >30 min Aufnahme, Tunnel/Gebäude, iOS Safari PWA Lock/Unlock).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
