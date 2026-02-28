# PROJ-4: Fotogalerie

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Navigation und Seitenstruktur
- Requires: PROJ-5 (PWA) — Foto-Upload ausschliesslich über mobile PWA
- Related: PROJ-3 (Reisetagebuch) — Fotos können in Tagebuchseiten erscheinen
- Related: PROJ-6 (Interaktive Karte) — Foto-Fähnchen auf der Karte

## Konzept

**Upload nur über mobile PWA** — kein Desktop-Upload auf der Landing Page. Die Landing Page zeigt die Galerie nur zum Anschauen.

**Zwei Upload-Wege in der PWA:**
1. **PWA-Kamera (Quick-Capture)** — Direkt in der App fotografieren → Foto + GPS + Zeitstempel automatisch
2. **Import aus Mediathek** — Fotos aus dem iPhone-Fotoalbum auswählen und hochladen

**Einfacher Upload-Flow auf dem Handy:**
```
Tour auswählen → "Fotos hochladen" → Mediathek öffnet sich → Fotos wählen → Fertig
```
Fotos werden automatisch der richtigen Tour zugeordnet.

**Nachträgliche Uploads:** Wanderer können jederzeit (auch nach der Tour) Fotos in die Galerie hochladen. Diese beeinflussen aber nicht die bereits erstellten Tagebuchseiten.

## User Stories
- Als Wanderer möchte ich in der PWA direkt ein Foto aufnehmen (Quick-Capture), das automatisch mit GPS und Zeitstempel gespeichert wird.
- Als Wanderer möchte ich Fotos aus meiner iPhone-Mediathek in die Galerie einer Tour hochladen.
- Als Wanderer möchte ich beim Upload eine Tour auswählen und die Fotos landen automatisch in der richtigen Galerie.
- Als Wanderer möchte ich auch nach der Tour noch Fotos in die Galerie hochladen.
- Als Besucher möchte ich alle Fotos einer Tour in einer Galerie auf der Landing Page sehen.
- Als Besucher möchte ich ein Foto in einer Lightbox gross ansehen mit Swipe-Funktion.
- Als Besucher möchte ich Fotos nach Etappe/Tag filtern.

## Acceptance Criteria
- [ ] Foto-Upload ausschliesslich über mobile PWA (kein Desktop-Upload)
- [ ] PWA-Kamera: Direkt fotografieren mit automatischem GPS + Zeitstempel
- [ ] Mediathek-Import: Fotos aus iPhone-Fotoalbum auswählen und hochladen
- [ ] Einfacher Upload-Flow: Tour wählen → "Fotos hochladen" → Mediathek → Fertig
- [ ] Unterstützte Formate: JPG, PNG, HEIF (iPhone-Format), max. 20MB pro Foto
- [ ] Mehrere Fotos gleichzeitig hochladbar
- [ ] GPS-Koordinaten werden automatisch aus EXIF-Daten ausgelesen (falls vorhanden)
- [ ] Fotos werden in Galerie-Raster angezeigt (responsive, dynamische Spaltenanzahl)
- [ ] Lightbox: Tap öffnet Foto gross mit Swipe-Funktion (vor/zurück)
- [ ] Filter nach Etappe/Tag möglich
- [ ] Bildtext und Autorname optional bei Upload eintragbar
- [ ] Fotos werden komprimiert/optimiert für Web (max. 1920px Breite)
- [ ] Nachträgliche Uploads jederzeit möglich — beeinflussen nicht die Tagebuchseiten
- [ ] Kein Login zum Anschauen nötig
- [ ] Fluid Responsive Design — dynamische Anpassung an jede Bildschirmgrösse

## Edge Cases
- Was wenn ein Foto kein EXIF enthält? → Ohne GPS-Koordinaten speichern
- Was wenn das Format nicht unterstützt wird? → Klare Fehlermeldung
- Was wenn das Foto zu gross ist (> 20MB)? → Fehlermeldung
- Was wenn der Upload abbricht? → Möglichkeit zum Wiederholen
- Was wenn sehr viele Fotos vorhanden sind (100+)? → Lazy Loading / Pagination
- Was wenn die Galerie leer ist? → Platzhalter mit Hinweis

## Technical Requirements
- Supabase Storage für Foto-Dateien
- Automatische Bildkomprimierung vor Upload (client-seitig)
- Lazy Loading für Galerie-Bilder
- EXIF-Auslesen für GPS und Aufnahmedatum
- HTML File Input mit `accept="image/*"` und `capture="environment"` für Kamera

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
