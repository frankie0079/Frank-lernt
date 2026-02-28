# PROJ-2: Reiseplanung

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Navigation und Seitenstruktur

## User Stories
- Als Wanderer möchte ich Flugdaten (Abflug, Ankunft, Flugnummer) eintragen und einsehen, damit alle Teilnehmer die Reisedaten auf einen Blick haben.
- Als Wanderer möchte ich Hoteldaten (Name, Adresse, Check-in/out) pro Etappe eintragen, damit alle wissen wo wir übernachten.
- Als Wanderer möchte ich Mietwagendetails eintragen (Abholung, Rückgabe, Fahrzeug), damit die Logistik klar ist.
- Als Wanderer möchte ich die geplante Route pro Etappe eintragen (Start, Ziel, km, Höhenmeter), damit alle die Tour kennen.
- Als Follower möchte ich die Reiseplanung lesen, damit ich weiss wo die Gruppe gerade ist und wohin sie geht.
- Als Wanderer möchte ich Links zu Buchungsbestätigungen hinzufügen können, damit alle Dokumente an einem Ort sind.

## Acceptance Criteria
- [ ] Flugdaten können eingetragen werden: Hinflug und Rückflug (Datum, Uhrzeit, Flugnummer, Airline)
- [ ] Hoteldaten pro Etappe eintragbar: Name, Adresse, Check-in, Check-out, Buchungslink
- [ ] Mietwagendetails eintragbar: Abholort, Rückgabeort, Datum, Fahrzeugtyp
- [ ] Etappenplanung: Jede Tagesetappe mit Name, Startpunkt, Zielpunkt, geplante km, Höhenmeter
- [ ] Alle Felder sind bearbeitbar (kein Login nötig)
- [ ] Änderungen werden sofort gespeichert (kein "Speichern"-Button nötig, Auto-Save)
- [ ] Planung ist für Follower lesbar (öffentlich)
- [ ] Mobile-optimierte Darstellung

## Edge Cases
- Was passiert wenn ein Pflichtfeld leer bleibt? → Fehlermeldung, aber kein Absturz
- Was wenn zwei Personen gleichzeitig bearbeiten? → Last-Write-Wins (kein Konflikt-Management nötig für MVP)
- Was wenn ein Buchungslink ungültig ist? → Link trotzdem speichern, keine Validierung der URL-Erreichbarkeit
- Was wenn keine Etappen eingetragen sind? → Leere Planung mit Hinweis "Noch keine Etappen geplant"

## Technical Requirements
- Formularvalidierung mit Zod
- Auto-Save nach kurzer Debounce-Zeit (1-2 Sekunden)
- Datums- und Uhrzeitfelder browserkompatibel

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
