# Next Steps

Stand: 2026-05-28

## Als Erstes Lesen

1. `CLAUDE.md`
2. `features/PROJ-42-storage-optimierung-archivierung.md`
3. Diese Datei

## Aktueller PROJ-42 Stand

- Supabase-Projekt `xqopetmpzjbxksonmhjw` war pausiert und wurde am 2026-05-28 reaktiviert.
- DNS/REST-Erreichbarkeit danach wieder OK.
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

## Morgen Nicht Vergessen

- Nicht einfach verwaiste Dateien löschen, bevor Frank bestätigt.
- Nicht alle nicht-Tagebuch-Fotos löschen, weil das finale Hong-Kong-Tagebuch noch nicht kuratiert ist.
- Slideshows sind jetzt der größte Speicherblock: 112.08 MB.
- Fachlicher nächster Schritt: Hong-Kong-Tagebuch kuratieren und entscheiden, welche Slideshows/Fotos final ins Archiv gehören.

## Empfohlene Reihenfolge Morgen

1. `git status --short`
2. Prüfen, ob GitHub-Push von heute erfolgreich ist.
3. Lokale App starten:

```powershell
cd C:\DEV\sandbox\Frank-lernt
npm run dev
```

4. Als Organizer Hong-Kong öffnen und visuell prüfen:
   - Sammlung lädt
   - optimierte Fotos sehen gut genug aus
   - Event-Einstellungen zeigen Speicherkarte
   - Dry-Run zeigt 6.57 MB bereinigbar

5. Slideshow-Speicher prüfen:
   - Welche 3 Slideshows sind final?
   - Sind alte Varianten vorhanden?
   - Müssen Slideshow-Dateien neu kleiner gerendert werden?

6. Danach erst Archiventscheidung:
   - Voll-Archiv: alle optimierten Fotos behalten, nur verwaiste Dateien löschen
   - Tagebuch-Archiv: nur finale Tagebuch-Fotos + finale Slideshows behalten

## Bereits Gelaufene Checks

```text
npm run lint: PASS, bestehende Warnungen
npx tsc --noEmit: PASS
npm run build: PASS
Hong-Kong Dry-Run: PASS
Hong-Kong Fotooptimierung mit Backup: PASS
```
