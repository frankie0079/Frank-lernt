# PROJ-27: Wanderer-Screen (Eingabe-Interface)

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-24 (Auth & User-Accounts) — Nutzer muss eingeloggt sein
- Requires: PROJ-25 (Event-Erstellung & -Verwaltung) — Event und Agenda müssen existieren
- Requires: PROJ-26 (Teilnehmer-Einladung & Member-Management) — Nutzer muss Mitglied des Events sein

## User Stories
- Als Wanderer möchte ich auf einem einfachen Screen 4 Aktionen sehen: Kamera, Video, Upload, Kommentar, damit ich schnell und ohne Ablenkung dokumentieren kann.
- Als Wanderer möchte ich direkt ein Foto aufnehmen und mit einem kurzen Kommentar versehen.
- Als Wanderer möchte ich meinen Beitrag einem Agenda-Punkt zuordnen, damit alles strukturiert bleibt.
- Als Wanderer möchte ich GPS-Koordinaten automatisch erfassen lassen, damit Fotos auf der Karte erscheinen.

## Acceptance Criteria
- [ ] Screen unter `/capture` oder als untere Tab-Navigation in der PWA erreichbar
- [ ] 4 große, Touch-optimierte Aktions-Buttons: Kamera (Foto direkt aufnehmen), Video (bis 90 s), Upload (aus Galerie wählen), Kommentar (reiner Text)
- [ ] Jeder Beitrag wird dem aktuell aktiven Agenda-Punkt zugeordnet (basierend auf heutigem Datum, anpassbar per Dropdown)
- [ ] GPS wird automatisch beim Öffnen des Screens angefragt (Geolocation API) und bei jedem Beitrag mitgespeichert (optional, überspringbar)
- [ ] Foto-Workflow: Kamera öffnen (`<input capture="environment">`) → Vorschau → optionaler Kommentar (max 1000 Zeichen) → Absenden
- [ ] Upload-Workflow: Mediathek öffnen → Auswahl (1 Datei) → EXIF-Extraktion → Kompression (max 1920px / 1 MB) → Thumbnail (400px) → optionaler Kommentar → Absenden
- [ ] Kommentar-Workflow: Textarea (max 1000 Zeichen) → Agenda-Punkt wählen → Absenden
- [ ] Autoren-Name und Avatar werden automatisch aus dem eingeloggten Profil übernommen (kein manuelles Eingeben)
- [ ] Nach Absenden: Toast "Beitrag gespeichert ✓", Formular wird geleert, GPS-Koordinate wird neu abgerufen
- [ ] Haptic Feedback bei erfolgreichem Absenden (iOS: `navigator.vibrate([50])`)
- [ ] Agenda-Dropdown zeigt nur Agenda-Punkte des aktuellen Events, heutiger Eintrag vorausgewählt
- [ ] Beitrag ohne Agenda-Punkt möglich (Dropdown-Option "Kein Tagesabschnitt")
- [ ] Upload-Fortschrittsbalken während des Speicherns

## Edge Cases
- Kein GPS-Zugriff (verweigert oder nicht verfügbar) → GPS-Feld bleibt leer, Beitrag wird trotzdem gespeichert, kein Fehler
- Kamera-Zugriff verweigert → Fehlermeldung "Kamera-Zugriff benötigt" mit Link zu iOS-Einstellungen
- Datei > 20 MB → Fehlermeldung "Datei zu groß (max. 20 MB)" vor dem Upload, kein Upload-Start
- Datei falsches Format (nicht Bild/Video) → Fehlermeldung "Nur Bilder und Videos erlaubt"
- Kein Agenda-Punkt vorhanden (leere Agenda) → Dropdown ausgeblendet, Beitrag ohne Zuordnung gespeichert
- Offline → Beitrag in lokalem Queue speichern (IndexedDB), Upload-Retry wenn wieder online (PWA Background Sync via Serwist)
- Kommentar 1001+ Zeichen → Zeichenzähler rot, Absenden-Button deaktiviert
- Upload schlägt fehl (Netzwerkfehler) → Fehlermeldung mit Retry-Button, Queue bleibt erhalten
- Nutzer wechselt App während Upload → Upload läuft weiter (Service Worker)
- EXIF-Extraktion fehlgeschlagen → Beitrag ohne EXIF-Daten speichern, kein Fehler für Nutzer

## Technical Requirements
- Mobile-first Design, optimiert für iPhone (375px Breite, Touch-Targets min. 44px)
- `<input type="file" accept="image/*" capture="environment">` für Kamera-Direktzugriff
- EXIF-Extraktion via `exifr` (GPS, Datum, Kameramodell) vor Kompression
- Bildkompression via `browser-image-compression` (max 1920px, 1 MB)
- Thumbnail-Generierung via Canvas API (400px, JPEG 0.8)
- Upload zu Supabase Storage (Bucket: `media`, Pfad: `[event_id]/[user_id]/[timestamp]-[uuid]`)
- `content_items` Tabelle (id UUID PK, event_id UUID FK, agenda_item_id UUID FK nullable, author_id UUID FK profiles, type TEXT CHECK ('photo'|'video'|'text'|'audio'), media_url TEXT, thumbnail_url TEXT, caption TEXT, latitude FLOAT8, longitude FLOAT8, exif_date TIMESTAMPTZ, created_at TIMESTAMPTZ)
- Zod-Schema für Beitrag-Validierung (caption max 1000 Zeichen, type enum)
- Rate-Limiting: 30 POST-Requests pro Minute pro IP (in-memory)
- PWA Background Sync: Serwist `BackgroundSyncPlugin` für fehlgeschlagene Uploads

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
