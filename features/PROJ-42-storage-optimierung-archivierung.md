# PROJ-42: Storage-Optimierung & Event-Archivierung

## Status

In Review

## Ziel

Wandervögel soll auf Supabase Free länger nutzbar bleiben. Neue Medien werden kleiner gespeichert, Kamera-/Videoaufnahme in der App entfällt, Organizer sehen den Speicherverbrauch pro Event und können verwaiste Dateien nach Dry-Run bereinigen.

## Produktentscheidungen

- Teilnehmer fotografieren und filmen mit der normalen Handy-Kamera-App.
- Wandervögel speichert keine Originalfotos, sondern nur optimierte App-Versionen.
- Der Datei-Hash bleibt auf der Originalauswahl vor Kompression, damit Galerie-Duplikate zuverlässig erkannt werden.
- Bestehende Event-Medien werden zunächst nur analysiert. Reale Neu-Kompression oder Löschung braucht eine bewusste Bestätigung.

## User Stories

- Als Teilnehmer möchte ich fertige Fotos und Videos aus meiner Galerie hochladen, damit die Originale auf meinem Gerät bleiben.
- Als Organizer möchte ich pro Event sehen, wie viel Supabase Storage verbraucht wird.
- Als Organizer möchte ich verwaiste Dateien zuerst als Dry-Run sehen, bevor ich sie lösche.
- Als Organizer möchte ich alte große Fotos erkennen, damit ich Speicherprobleme früh sehe.
- Als Organizer möchte ich sicher sein, dass Tagebuch, Slideshow und öffentliche Seite keine benötigten Medien verlieren.

## Acceptance Criteria

- Der Erfassen-Screen enthält keinen Kamera-Button und keinen direkten Videoaufnahme-Button mehr.
- Foto-Uploads werden clientseitig auf maximal 1600px lange Kante und ca. 700 KB Zielgröße komprimiert.
- Video-Dateiuploads sind auf 15 MB begrenzt und zeigen eine Speicherwarnung.
- Organizer sehen in den Event-Einstellungen einen Speicherbericht mit Kategorien, Gesamtgröße, Warnungen und bereinigbarem Speicher.
- Die Bereinigung bietet einen Dry-Run und löscht Dateien nur nach ausdrücklicher Bestätigung.
- Verwaiste Dateien werden nur gelöscht, wenn sie unter dem Event-Prefix im Storage liegen und keine Datenbankreferenz mehr haben.
- PDF-Export bleibt clientseitig und legt keine dauerhaften Storage-Dateien an.
- Slideshow-Veröffentlichung bleibt WhatsApp-kompatibel; alte nicht referenzierte Slideshow-Dateien werden über die Bereinigung erfasst.

## Edge Cases

- Supabase Storage listet Ordner und Dateien unterschiedlich: Ordner müssen rekursiv gelesen werden.
- Öffentliche Storage-URLs können Query-Parameter enthalten; Referenzen müssen ohne Cache-Buster verglichen werden.
- Cover und Avatare liegen nicht zwingend unter dem Event-Prefix; sie werden soweit möglich per URL-Größe in den Bericht aufgenommen, aber nicht automatisch bereinigt.
- Bestehende große Fotos werden nicht automatisch ersetzt, weil das reale Medien überschreiben würde.
- Wenn Supabase Secrets lokal fehlen, muss die UI/API sauber fehlschlagen und QA die Einschränkung dokumentieren.

## Testevent

Hong-Kong (`hong-kong-april-2026`) dient als realer Analysefall. Erlaubt sind Speicherbericht und Dry-Run. Echte Medienoptimierung oder Löschung erfolgt erst nach separater Bestätigung.

## QA Stand

- `npm run lint`: PASS mit bestehenden Warnungen.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS.
- Lokaler Browser-Smoke bis `/events`: PASS, leitet ohne Cookie korrekt auf `/login`.
- Hong-Kong-Dry-Run nach Projekt-Reaktivierung: PASS.
- Hong-Kong-Fotooptimierung: PASS. 96 Fotoeinträge / 192 Storage-Objekte wurden mit lokalem Backup optimiert. Fotos: 70,93 MB → 18,31 MB. Event-Storage referenziert: 212,91 MB → 160,25 MB. Keine Datenbankzeilen gelöscht.
- 2026-05-29 Local Smoke: PASS. Hong-Kong Event-Dashboard lädt als Organizer, Erfassen-Tab enthält keine Kamera-/Direktvideo-Buttons, Sammlung lädt Medien, Speicherkarte zeigt 161 MB Gesamt und 6.6 MB / 18 Dateien bereinigbar. Dry-Run erneut ausgeführt, keine Löschung.
- 2026-05-29 Production Smoke: PASS für lesenden Happy Path. Vercel-URL `/events/85f0339d-edac-462d-bc0e-85d448a375f1/settings` zeigt die PROJ-42-Speicherkarte mit denselben Zahlen.
- 2026-05-29 Slideshow Audit: PASS. Genau 3 Slideshow-Objekte im Event-Prefix, alle 3 in `daily_reports.slideshow_url` referenziert; keine offensichtlichen alten Slideshow-Varianten zum Löschen.
- 2026-05-29 Archiv-Handoff: Noch keine Archiventscheidung. Tagebuch ist nicht final kuratiert: Tag 1 hat 6 Fotos, Tag 2/3 haben 0 Fotos.
