# PROJ-4: Fotogalerie

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Navigation und Seitenstruktur
- Related: PROJ-3 (Reisetagebuch) — Fotos können Tageseinträgen zugeordnet werden
- Related: PROJ-6 (Interaktive Karte) — Foto-Fähnchen auf der Karte

## User Stories
- Als Wanderer möchte ich Fotos hochladen (einzeln oder mehrere), damit ich Erlebnisse dokumentiere.
- Als Wanderer möchte ich beim Upload einen kurzen Bildtext und GPS-Position hinzufügen, damit das Foto Kontext hat.
- Als Follower möchte ich alle Fotos der Tour in einer Galerie sehen, damit ich die Reise visuell miterlebe.
- Als Besucher möchte ich ein Foto in einer Lightbox gross ansehen, damit ich Details erkennen kann.
- Als Besucher möchte ich Fotos nach Etappe/Tag filtern, damit ich gezielt durch die Tour browsen kann.
- Als Follower möchte ich auch eigene Fotos hochladen (kein Login nötig), damit ich meine Schnappschüsse teilen kann.

## Acceptance Criteria
- [ ] Foto-Upload funktioniert: JPG, PNG, HEIF (iPhone-Format), max. 20MB pro Foto
- [ ] Mehrere Fotos gleichzeitig hochladbar
- [ ] GPS-Koordinaten werden automatisch aus EXIF-Daten ausgelesen (falls vorhanden)
- [ ] Fotos werden in Galerie-Raster angezeigt (3 Spalten Desktop, 2 Spalten Mobile)
- [ ] Lightbox: Klick/Tap öffnet Foto in gross mit Swipe-Funktion (vor/zurück)
- [ ] Filter nach Etappe/Tag möglich
- [ ] Bildtext und Autorname optional bei Upload eintragbar
- [ ] Fotos werden komprimiert/optimiert für Web (max. 1920px Breite)
- [ ] Kein Login zum Hochladen oder Anschauen nötig

## Edge Cases
- Was wenn ein Foto kein EXIF enthält? → Ohne GPS-Koordinaten speichern
- Was wenn das Format nicht unterstützt wird? → Klare Fehlermeldung mit erlaubten Formaten
- Was wenn das Foto zu gross ist (> 20MB)? → Fehlermeldung, Upload abbrechen
- Was wenn der Upload abbricht? → Fehlermeldung, Möglichkeit zum Wiederholen
- Was wenn sehr viele Fotos vorhanden sind (100+)? → Lazy Loading / Pagination
- Was wenn die Galerie leer ist? → "Noch keine Fotos — sei der Erste!" Platzhalter

## Technical Requirements
- Supabase Storage für Foto-Dateien
- Automatische Bildkomprimierung vor Upload (client-seitig)
- Lazy Loading für Galerie-Bilder
- EXIF-Auslesen für GPS und Aufnahmedatum

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
