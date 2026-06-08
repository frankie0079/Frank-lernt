# PROJ-45: Agenda jederzeit sicher bearbeiten

## Status: Deployed
**Created:** 2026-06-08
**Last Updated:** 2026-06-08

## Ziel

Der Organisator kann die Agenda eines Events jederzeit bearbeiten, auch
waehrend oder nach dem Event und nachdem Kuratierung, Tagebuch oder Archiv
bereits erstellt wurden.

Bestehende Agenda-Punkte behalten dabei ihre technische ID. Dadurch bleiben
Fotos, Videos, Tagesberichte, Slideshows, Tagebuchseiten und Archivseiten mit
dem richtigen Agenda-Punkt verbunden.

## User Stories

- Als Organisator moechte ich Titel, Beschreibung, Datum und Ort eines
  Agenda-Punkts nachtraeglich aendern.
- Als Organisator moechte ich Agenda-Punkte neu sortieren und neue Punkte
  hinzufuegen.
- Als Organisator moechte ich Texte auch nach Eventende oder nach Erstellung
  des Tagebuchs korrigieren.
- Als Organisator moechte ich, dass Agenda-Aenderungen automatisch in
  Sammlung, Kuratierung, Tagebuch und Archiv sichtbar werden.
- Als Organisator moechte ich davor geschuetzt werden, einen Agenda-Punkt mit
  verknuepften Inhalten versehentlich zu loeschen.

## Acceptance Criteria

- [x] Nur der Organisator kann die Agenda bearbeiten.
- [x] Bestehende Agenda-Punkte behalten beim Speichern ihre ID.
- [x] Titel, Beschreibung, Datum, Ort und Reihenfolge koennen jederzeit
      geaendert werden.
- [x] Neue Agenda-Punkte koennen hinzugefuegt werden.
- [x] Nicht verwendete Agenda-Punkte koennen geloescht werden.
- [x] Agenda-Punkte mit verknuepften Fotos, Tagesberichten oder Tagebuchseiten
      koennen nicht versehentlich geloescht werden.
- [x] Aenderungen erscheinen nach Neuladen in Event-Ansicht, Sammlung,
      Kuratierung, Tagebuch und Archiv.
- [x] Bestehende Foto-, Report- und Tagebuch-Zuordnungen bleiben erhalten.
- [x] Agenda-Punkte koennen im Editor nach oben und unten verschoben werden.

## Edge Cases

- Ein bestehender Agenda-Punkt hat bereits Fotos, aber noch kein Tagebuch.
- Ein bestehender Agenda-Punkt hat bereits Tagesbericht, Slideshow und
  Tagebuchseite.
- Ein Agenda-Punkt wird nur umbenannt oder neu datiert.
- Ein neuer Agenda-Punkt wird zwischen zwei bestehende Punkte eingefuegt.
- Ein verwendeter Agenda-Punkt wird im Editor entfernt und gespeichert.
- Der Editor wird geschlossen und spaeter mit zwischenzeitlich aktualisierten
  Daten erneut geoeffnet.

## Non-Goals

- Kein automatisches Aufteilen eines Agenda-Punkts auf mehrere neue Punkte.
- Keine automatische KI-Umsortierung von Fotos.
- Keine Loeschung verknuepfter Inhalte.

## Tech Design (Solution Architect)

### Component Structure

Event-Dashboard fuer Organisator
+-- Event bearbeiten
    +-- Agenda-Liste
        +-- Agenda-Punkt bearbeiten
        +-- Nach oben / nach unten verschieben
        +-- Neuen Punkt hinzufuegen
        +-- Nicht verwendeten Punkt entfernen

### Data Model

`agenda_items.id` bleibt die stabile Verbindung zu:

- `content_items.agenda_item_id`
- `daily_reports.agenda_item_id`
- `book_pages.agenda_item_id`

Bearbeitungen aktualisieren die bestehende Agenda-Zeile. Nur neue Punkte
erhalten eine neue ID. Entfernte Punkte werden nur geloescht, wenn keine
abhaengigen Inhalte existieren.

### Backend Need

Die bestehende Event-PATCH-Route wird von "alle Agenda-Punkte loeschen und neu
anlegen" auf differenziertes Aktualisieren, Hinzufuegen und sicheres Loeschen
umgestellt.

### Dependencies

- PROJ-25 Event-Erstellung
- PROJ-28 Content-Pool
- PROJ-33 Tages-Admin
- PROJ-36 Post-Event Tagebuch
- PROJ-43/44 Archiv und Tagebuchdarstellung

## QA

- `npx tsc --noEmit`: bestanden
- `npm run lint`: bestanden, 13 bestehende Warnungen, keine Fehler
- `npm run build`: bestanden
- Lokaler Organizer-Smoke-Test mit dem bestehenden Hongkong-Event:
  Agenda-Editor geoeffnet, bestehende Inhalte und Verschiebe-Buttons sichtbar.
- Unveraendertes Speichern erfolgreich; bestehende Agenda-IDs bleiben erhalten.
- Versuch, einen verwendeten Agenda-Punkt zu entfernen, liefert `409
  agenda_in_use`; Event und Verknuepfungen bleiben unveraendert.
- Production-Smoke-Test auf `frank-lernt.vercel.app` bestanden: Editor sichtbar,
  unveraendertes Speichern erfolgreich, Loeschschutz erfolgreich.
