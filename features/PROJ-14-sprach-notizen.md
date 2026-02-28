# PROJ-14: Sprach-Notizen (Audio-Kommentare)

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-3 (Reisetagebuch) — Sprach-Notizen erscheinen als Kommentare im Tagebuch
- Requires: PROJ-5 (PWA) — Mikrofon-Zugriff über PWA

## User Stories
- Als Wanderer möchte ich unterwegs eine kurze Sprachnotiz aufnehmen, damit ich nicht tippen muss wenn meine Hände besetzt sind.
- Als Follower möchte ich Sprachnotizen im Tagebuch abspielen, damit ich die Stimmen und Atmosphäre der Tour höre.
- Als Wanderer möchte ich eine Sprachnotiz mit GPS-Position verknüpfen, damit sie auf der Karte verortet wird.

## Acceptance Criteria
- [ ] Aufnahme-Button in der PWA: Tap zum Starten, nochmals Tap zum Stoppen
- [ ] Max. Aufnahmelänge: 60 Sekunden
- [ ] Aufnahme wird mit GPS-Position und Zeitstempel gespeichert
- [ ] Audio-Player im Tagebuch (Play/Pause, Fortschrittsbalken)
- [ ] Mikrofon-Zugriff wird beim ersten Mal angefragt
- [ ] Sprach-Notizen erscheinen als eigener Kommentar-Typ im Tagebuch

## Edge Cases
- Was wenn Mikrofon-Zugriff verweigert wird? → Feature deaktiviert, Hinweis anzeigen
- Was wenn die Aufnahme zu lang wird? → Automatisch stoppen bei 60 Sekunden
- Was wenn der Upload fehlschlägt? → Lokal speichern und bei nächster Verbindung hochladen
- Was wenn das Format nicht unterstützt wird? → WebM als primäres Format, MP4 als Fallback

## Technical Requirements
- MediaRecorder API für Aufnahme
- Supabase Storage für Audio-Dateien
- WebM/Opus-Format (gute Browser-Kompatibilität)
- Offline-Queue für Uploads ohne Verbindung

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
