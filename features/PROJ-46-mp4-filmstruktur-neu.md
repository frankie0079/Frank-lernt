# PROJ-46: MP4-Filmstruktur neu

## Status: Deployed
**Created:** 2026-06-09
**Last Updated:** 2026-06-09

## Ziel

Die generierten Tagesfilme erhalten eine klare, kontrollierbare Struktur:
editierbare Startseite, maximal 12 kuratierte Fotos oder Videos und
editierbare Schlussseite. Schwarze Kapitel-, Einzelwort- und Leerszenen werden
vollstaendig entfernt.

## User Stories

- Als Tages-Admin moechte ich vor dem Abspielen das gewaehlte Startbild statt
  eines schwarzen Video-Players sehen.
- Als Tages-Admin moechte ich Foto und Text der Startseite bearbeiten.
- Als Tages-Admin moechte ich Foto und Text der Schlussseite bearbeiten.
- Als Tages-Admin moechte ich hoechstens 12 Fotos oder Videos verwenden, damit
  der Film ruhig und lesbar bleibt.
- Als Zuschauer moechte ich jedes Foto mindestens vier Sekunden sehen.
- Als Tages-Admin moechte ich keine automatisch erzeugten Wort-, Kapitel- oder
  Leerszenen im Film haben.

## Acceptance Criteria

- [x] Der Film besteht nur aus Startseite, maximal 12 Medien und Schlussseite.
- [x] Start- und Schlussseite erlauben die Wahl zwischen Event-Cover und einem
      kuratierten Tagesmedium sowie frei editierbaren Text.
- [x] Das gewaehlte Startbild wird als Poster im Video-Player angezeigt.
- [x] Jede Foto-/Video-Szene dauert mindestens 4 und maximal 6 Sekunden.
- [x] Bei mehr als 12 kuratierten Fotos/Videos wird Planung und Rendering
      blockiert; nichts wird stillschweigend ausgelassen.
- [x] `chapter-title`, `text-card`, leere und alte `cover`-Szenen werden beim
      Laden und Speichern entfernt.
- [x] Kommentare/Captions duerfen weiter als Overlay auf dem zugehoerigen
      Medium erscheinen.
- [x] Bestehende MP4s bleiben unveraendert, bis sie neu gerendert werden.

## Non-Goals

- Kein separates Hochladen eines Start- oder Schlussfotos.
- Keine schwarzen Textkarten.
- Keine automatische Auswahl, welche von mehr als 12 Medien entfallen.
- Keine Aenderung bestehender MP4-Dateien ohne erneutes Rendern.

## Tech Design (Solution Architect)

### Filmstruktur

Tagesfilm
+-- Startseite
|   +-- Bild: Event-Cover oder kuratiertes Tagesmedium
|   +-- frei editierbarer Text
+-- 1 bis 12 Medien-Szenen
|   +-- Foto oder Video-Standbild
|   +-- optional vorhandene Caption als Overlay
+-- Schlussseite
    +-- Bild: Event-Cover oder kuratiertes Tagesmedium
    +-- frei editierbarer Text

### Datenmodell

Das bestehende Storyboard-JSON wird um Einstellungen fuer Start- und
Schlussseite erweitert. `null` als Bildreferenz bedeutet Event-Cover. Eine
Content-ID verweist auf ein bereits kuratiertes Foto oder Video.

Es ist keine Datenbankmigration erforderlich, weil das Storyboard bereits als
JSON gespeichert wird.

### Bestehende Daten

Alte Storyboards werden beim Laden normalisiert:

- Nur Foto- und Video-Szenen bleiben erhalten.
- Alte Cover-, Kapitel-, Text- und Leerszenen werden entfernt.
- Fehlende Start-/Schlussseiten erhalten sichere Standardwerte.

### Vorschau

Der native Video-Player erhaelt das Startseitenbild als Poster. Dadurch zeigt
er vor dem Abspielen kein rein schwarzes Rechteck mehr.

### Validierung

Server, Editor und Renderer pruefen unabhaengig voneinander:

- maximal 12 Foto-/Video-Szenen,
- keine anderen Szenentypen,
- mindestens 4 Sekunden pro Medium.

### Dependencies

- PROJ-33 Tages-Admin Kurations-Workflow
- PROJ-34 Slideshow-MP4 Generierung
- PROJ-44 Slideshow-Intro-Bereinigung

## QA

- `npx tsc --noEmit`: bestanden
- `npm run lint`: bestanden, 13 bestehende Warnungen, keine Fehler
- `npm run build`: bestanden
- Lokaler Tirana-Smoke-Test, Abschnitt "Zentrum, Markt und Geschichte":
  - fertiger Video-Player hat ein echtes Posterbild statt schwarzer Flaeche;
  - bestehendes Alt-Storyboard wird im Editor von 12 Szenen auf 9 reine
    Fotoszenen normalisiert;
  - die drei alten Kapitel-/Wortkarten sind nicht mehr sichtbar;
  - alle neun Fotoszenen zeigen 4,0 Sekunden;
  - Start- und Schlussseite zeigen Bildvorschau, Bildwahl und Textfeld.
- Kein bestehender Tirana-MP4 wurde neu gerendert oder ueberschrieben.
- Production-Smoke-Test mit Tirana bestanden:
  - Player zeigt Posterbild statt schwarzer Flaeche;
  - Start- und Schlussseite sind editierbar;
  - neun reine Fotoszenen mit jeweils 4,0 Sekunden;
  - keine Kapitel-, Wort- oder Leerszene sichtbar.

## Deployment

- Deployed und in Produktion verifiziert am 2026-06-09.
- Feature-Commit: `bb92234 feat(PROJ-46): rebuild slideshow film structure`
