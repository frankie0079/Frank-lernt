# Next Steps

Stand: 2026-05-29

## Als Erstes Lesen

1. `CLAUDE.md`
2. `features/PROJ-42-storage-optimierung-archivierung.md`
3. Diese Datei

## Aktueller PROJ-42 Stand

- Supabase-Projekt `xqopetmpzjbxksonmhjw` war pausiert und wurde am 2026-05-28 reaktiviert.
- DNS/REST-Erreichbarkeit danach wieder OK.
- GitHub-Push ist OK: `main` steht auf `origin/main` bei `caad2ee feat(PROJ-42): optimize storage and remove camera capture`.
- Kamera-Feature und direkte Videoaufnahme sind aus dem Wanderer-Screen entfernt.
- Upload bleibt: Fotos/Videos aus der Handy-Mediathek, Notiz, Tour-Tracker.
- Neue Fotos werden auf max. 1600px / ca. 700 KB Zielgröße komprimiert.
- Video-Dateiupload ist auf 15 MB begrenzt.
- Organizer-Speicherkarte ist in `/events/[id]/settings` eingebaut.
- API: `GET/POST /api/events/[id]/storage`.
- Keine Supabase-Migration nötig.

## Hong-Kong Speicherstand

Event: `hong-kong-april-2026`

Vor Fotooptimierung:

```text
Referenzierter Event-Storage: 212.91 MB
Fotos: 70.93 MB
Videos: 29.86 MB
Slideshows: 112.08 MB
Bereinigbar Dry-Run: 6.57 MB
```

Nach Fotooptimierung:

```text
Referenzierter Event-Storage: 160.25 MB
Fotos: 18.31 MB
Videos: 29.86 MB
Slideshows: 112.08 MB
Bereinigbar Dry-Run: 6.57 MB
```

Optimierung:

```text
96 Fotoeinträge
192 Storage-Objekte
0 Fehler
0 Datenbankzeilen gelöscht
```

Lokales Backup:

```text
storage-backups/hong-kong-april-2026-2026-05-28T17-30-35-091Z
```

Das Backup ist durch `.gitignore` ausgeschlossen.

## Review 2026-05-29

- Lokaler Dev-Server (`npm run dev`) gestartet und Hong-Kong als Organizer geöffnet.
- `/events` ohne Cookie leitet korrekt auf `/login?redirect=/events`.
- Hong-Kong Event-Dashboard lädt; Erfassen-Tab zeigt nur noch `Medien hochladen`, `Notiz`, `Tour-Tracker` - keine Kamera-/Direktvideo-Buttons.
- Sammlung lädt und zeigt optimierte Fotos/Videos.
- Lokale Speicherkarte in `/events/[id]/settings` zeigt:
  - Event-Speicher: 161 MB / 1 GB
  - Fotos: 18.3 MB / 193 Dateien
  - Videos: 29.9 MB / 1 Datei
  - Slideshows: 112 MB / 3 Dateien
  - Cover: 485 KB / 1 Datei
  - Avatare: 42 KB / 1 Datei
  - Bereinigbar: 6.6 MB / 18 Dateien
- Dry-Run lokal ausgeführt: bestätigt 6.6 MB / 18 Dateien, keine Löschung.
- Production-Smoke auf `https://frank-lernt.vercel.app/events/85f0339d-edac-462d-bc0e-85d448a375f1/settings`: PROJ-42-Speicherkarte ist live und zeigt dieselben Zahlen.
- Slideshow-Speicher geprüft: genau 3 Objekte im `slideshows`-Bucket unter dem Event-Prefix, alle 3 sind in `daily_reports.slideshow_url` referenziert. Keine alten Slideshow-Varianten als offensichtlicher Müll gefunden.
- Tagebuch-Stand geprüft:
  - Tag 1 `Dark side of HK & Hafenlichter`: sichtbar, 2 Seiten, 6 Fotos
  - Tag 2 `Budda, Michelin-Gans, Bar-Hopping`: sichtbar, 1 leere Seite, 0 Fotos
  - Tag 3 `Vicoria Peak und Inselhopping`: sichtbar, 0 Seiten, 0 Fotos
- Fazit: Archiventscheidung ist fachlich noch nicht dran. Erst Tag 2/3 im Tagebuch kuratieren.

## Nicht Vergessen

- Nicht einfach verwaiste Dateien löschen, bevor Frank bestätigt.
- Nicht alle nicht-Tagebuch-Fotos löschen, weil das finale Hong-Kong-Tagebuch noch nicht kuratiert ist.
- Slideshows sind jetzt der größte Speicherblock: 112.08 MB.
- Fachlicher nächster Schritt: Hong-Kong-Tagebuch kuratieren und entscheiden, welche Slideshows/Fotos final ins Archiv gehören.

## Empfohlene Reihenfolge

1. Hong-Kong-Tagebuch im Editor öffnen:

```powershell
http://localhost:3000/events/85f0339d-edac-462d-bc0e-85d448a375f1/book/edit
```

2. Tag 2 und Tag 3 kuratieren:
   - finale Fotobuch-Seiten anlegen
   - finale Fotos auswählen
   - optional Kommentare/Text pro Seite setzen

3. Danach erst Archiventscheidung:
   - Voll-Archiv: alle optimierten Fotos behalten, nur verwaiste Dateien löschen
   - Tagebuch-Archiv: nur finale Tagebuch-Fotos + finale Slideshows behalten

## Bereits Gelaufene Checks

```text
npm run lint: PASS, bestehende Warnungen
npx tsc --noEmit: PASS
npm run build: PASS
Hong-Kong Dry-Run: PASS
Hong-Kong Fotooptimierung mit Backup: PASS
Lokaler PROJ-42 Browser-Smoke: PASS (2026-05-29)
Production PROJ-42 Speicherkarte: PASS (2026-05-29)
```
