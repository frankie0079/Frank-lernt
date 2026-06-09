# PROJ-47: Abwechslungsreiche Tagesfilm-Stile

## Status: Deployed
**Created:** 2026-06-09
**Last Updated:** 2026-06-09

## Ziel

Der Tages-Admin kann vor dem Rendern zwischen drei klar unterscheidbaren
Filmstilen wählen. Dadurch wirken die täglichen Grüße einer mehrtägigen Reise
nicht jeden Tag gleich, ohne dass Fotos erneut kuratiert werden müssen.

## User Stories

- Als Tages-Admin möchte ich einen Filmstil wählen, damit aufeinanderfolgende
  Tagesfilme unterschiedlich wirken.
- Als Tages-Admin möchte ich den Stil jederzeit wechseln können, ohne Auswahl,
  Reihenfolge oder Texte zu verlieren.
- Als Zuschauer möchte ich einen ruhigen Postkartenfilm sehen können.
- Als Zuschauer möchte ich einen lebhafteren Tagesrückblick sehen können.
- Als Zuschauer möchte ich einen tagebuchartigen Film mit gut lesbaren
  Bildkommentaren sehen können.

## Acceptance Criteria

- [x] Im Storyboard-Editor stehen die Stile `Postkarte`, `Tagesrückblick` und
      `Reisetagebuch` zur Auswahl.
- [x] `Postkarte` zeigt Bilder ruhig, mit weichen Übergängen und persönlichem
      Grußcharakter.
- [x] `Tagesrückblick` nutzt lebhaftere Übergänge, sichtbare Tages-/Szenenmarker
      und eine dynamischere Inszenierung.
- [x] `Reisetagebuch` zeigt Bilder in einer hellen Tagebuch-/Papiergestaltung
      und stellt vorhandene Kommentare besonders lesbar dar.
- [x] Startseite, Schlussseite, Musik, Medienreihenfolge und Texte bleiben bei
      einem Stilwechsel unverändert.
- [x] Der gewählte Stil wird mit dem Storyboard gespeichert und auf anderen
      Geräten wieder geladen.
- [x] Alte Storyboards ohne Stil werden automatisch als `Postkarte` behandelt.
- [x] Maximal 12 Medien und mindestens vier Sekunden pro Medium bleiben
      unverändert.
- [x] Bestehende MP4s ändern sich erst nach erneutem Rendern.

## Edge Cases

- Ein Foto ohne Caption wird in jedem Stil sinnvoll dargestellt.
- Ein fehlendes Event-Cover fällt weiterhin auf den vorhandenen
  Farbflächen-Fallback zurück.
- Hoch- und Querformatfotos bleiben vollständig sichtbar.
- Ein altes Storyboard ohne Filmstil lässt sich ohne manuelle Migration laden.
- Ein Stilwechsel während eines ungespeicherten Edits verändert keine anderen
  Storyboard-Felder.

## Non-Goals

- Keine persönliche Video- oder Audio-Begrüßung in diesem Feature.
- Keine zusätzliche Medienauswahl pro Stil.
- Keine automatische tägliche Stilwahl.
- Keine Änderung oder automatische Neuerzeugung bestehender MP4-Dateien.

## Tech Design (Solution Architect)

### Bedienung

Storyboard-Editor
+-- Filmstil
|   +-- Postkarte
|   +-- Tagesrückblick
|   +-- Reisetagebuch
+-- bestehende Start-/Schlussseiten-, Musik- und Szenenbearbeitung

Die Stilwahl steht am Anfang des Editors und beschreibt knapp die jeweilige
Wirkung. Ein Wechsel ändert nur die Stil-Einstellung.

### Datenmodell

Das bestehende Storyboard-JSON erhält ein Feld für den Filmstil. Alte
Storyboards ohne dieses Feld verwenden automatisch `Postkarte`. Es ist keine
Datenbankmigration erforderlich.

### Rendering

Alle Stile verwenden dieselben Medien, Texte und Zeitgrenzen, aber
unterschiedliche visuelle Regeln:

- **Postkarte:** weiche Übergänge, dunkle gut lesbare Bildunterschrift,
  persönlicher Absender.
- **Tagesrückblick:** lebhaftere Übergänge, Tagesdatum und fortlaufende
  Szenennummer als wiederkehrende Orientierung.
- **Reisetagebuch:** helle Papierfläche, eingerahmtes Foto und besonders
  lesbarer Kommentarbereich.

### Bestehende Daten

Der Storyboard-Parser ergänzt bei alten Daten automatisch `Postkarte`.
Bestehende Videos bleiben unverändert und erhalten den Stil erst beim nächsten
Rendern.

### Dependencies

- PROJ-34 Slideshow-Generierung
- PROJ-46 MP4-Filmstruktur neu

## QA

- `npx tsc --noEmit`: bestanden.
- `npm run lint`: bestanden, 13 bestehende Warnungen, keine Fehler.
- `npm run build`: bestanden.
- Lokaler Tirana-Smoke-Test:
  - Altes Storyboard öffnet mit ausgewähltem Stil `Postkarte`.
  - Alle drei Stiloptionen sind im Editor sichtbar und bedienbar.
  - Wechsel zu `Tagesrückblick` und `Reisetagebuch` erhält Filmtitel und alle
    neun vorhandenen Szenen unverändert.
  - Kein bestehendes Tirana-MP4 wurde neu gerendert oder überschrieben.
- Logikprüfung Renderer:
  - `Postkarte` verwendet den bestehenden ruhigen Renderpfad.
  - `Tagesrückblick` ergänzt Tagesmarker, Szenenzähler und Reveal-Übergang.
  - `Reisetagebuch` verwendet Papierfläche, Fotorahmen und Kommentarbereich.
  - Alle Stile verwenden weiterhin dieselben Szenen und Zeitlimits.

## Production-Verifikation

- Deployed und gegen `https://frank-lernt.vercel.app` geprüft am 2026-06-09.
- Tirana-Storyboard von `Postkarte` auf `Tagesrückblick` gestellt und
  gespeichert.
- Frische Sitzung lud `Tagesrückblick` korrekt wieder.
- Tirana anschließend wieder auf `Postkarte` zurückgesetzt und in einer
  weiteren frischen Sitzung verifiziert.
- Kein produktives MP4 wurde neu gerendert oder überschrieben.
- Eine bereits während des Deployments geöffnete Browser-Sitzung zeigte
  einmalig eine clientseitige Fehlerseite; der Fehler war in zwei frischen
  Sitzungen nicht reproduzierbar.
