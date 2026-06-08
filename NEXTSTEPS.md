# Next Steps

Stand: 2026-06-08

## Aktueller Stand

PROJ-43 bis PROJ-45 sind deployed und in Production geprüft.

- PROJ-43: Wandervögel-Archiv, private Archivlinks und direkte Admin-Join-Redirects funktionieren.
- PROJ-44: Tagebuch-/Archivdarstellung ist breiter, responsiver und tagebuchartiger.
- Hong-Kong-Tagebuch ist gefüllt und privat veröffentlicht.
- Archiv und interne Tagebuchansicht verwenden denselben Layout-Kern.
- Foto-Captions, Notizen, Tour-Tracker-Fotos und Tagesinformationen haben Platz im Tagebuch.
- Foto-Lightbox öffnet fullscreen und bleibt bei Querformat-Rotation `object-fit: contain`.
- Speicherkarte unter Event-Einstellungen hat getrennte Aktionen für bereinigbare Dateien, Slideshows und loeschbare Videos.
- Slideshow-Storyboard erzeugt künftig keine doppelte Intro-/Cover-Szene mehr; alte `cover`-Szenen und leere Textkarten werden vor dem Rendern entfernt.
- Organisatoren können die Agenda jederzeit bearbeiten; bestehende Zuordnungen bleiben durch stabile Agenda-IDs erhalten.

## Production-Verifikation

Verifiziert gegen `https://frank-lernt.vercel.app`:

- Privates Hong-Kong-Archiv rendert die Tagebuchseiten.
- Archiv-Lightbox: Foto passt im Querformat vollständig in den Viewport.
- Hong-Kong-Speicherkarte:
  - `Dry-Run` ist nicht mehr sichtbar.
  - `Bereinigbare löschen`, `Slideshows löschen`, `Videos löschen` sind sichtbar.
  - Anzeige ca. 6,6 MB bereinigbar, 112 MB Slideshows, 29,9 MB loeschbare Videos.
- Admin-Seite Hong-Kong lädt.
- Agenda-Editor Hong-Kong lädt, unverändertes Speichern funktioniert und der Löschschutz blockiert verwendete Agenda-Punkte.

Nicht ausgeführt:

- Keine produktive Löschaktion.
- Keine alten Slideshow-MP4s überschrieben.

## Wichtige Produktentscheidung

Wir archivieren aktuell nicht extern und übertragen keine Originale in einen zweiten Speicher. Supabase bleibt vorerst Arbeits- und Archivspeicher.

Der Ablauf ist damit:

1. Während des Events werden Fotos/Videos/Notizen in der PWA gesammelt.
2. Der Admin kuratiert pro Tag.
3. Das Tagebuch übernimmt genau diese Auswahl als Quelle der Wahrheit.
4. Nach Eventabschluss wird nicht nochmal in einer zweiten Archivdatenbank kuratiert.
5. Speicher wird nur gezielt optimiert:
   - verwaiste Dateien löschen,
   - generierte Slideshows löschen,
   - Videos löschen, sofern sie nicht im Tagebuch verwendet werden.

## Was Als Nächstes Ansteht

1. Bei Bedarf Hong-Kong-Slideshows neu rendern:
   - nötig, wenn die vorhandenen MP4s den doppelten Titel und die rosa Leerszene noch enthalten.
   - Der Code-Fix wirkt erst auf neu gerenderte Videos.

2. Bei Bedarf Speicher in Hong-Kong bereinigen:
   - nur über die neuen Einzelbuttons in den Event-Einstellungen.
   - Vorher bewusst entscheiden, welche Kategorie gelöscht wird.
   - Keine Löschung ohne explizite Bestätigung.

3. Neues Feature nur mit neuer Spec starten:
   - Nächste ID: PROJ-46.
   - Workflow: `/requirements` → `/architecture` → `/frontend` → `/backend` → `/qa` → `/deploy`.

## Technischer Stand

Letzte relevante Commits auf `main`:

- `4db6446 fix(PROJ-43): clarify event settings title`
- `82fa0f2 feat(PROJ-44): improve diary archive reading experience`
- `84564e3 fix(PROJ-44): simplify diary photo lightbox controls`
- `48a7cf9 feat(PROJ-44): add targeted storage cleanup actions`
- `44fad99 fix(PROJ-44): prevent cropped lightbox and duplicate slideshow intro`
- `f7e7259 feat(PROJ-45): allow safe agenda editing`

Checks zuletzt grün:

- `npx tsc --noEmit`
- `npm run lint` mit bestehenden Warnungen
- `npm run build`

## Nicht Vergessen

- Keine Passwörter, Tokens oder Service-Keys in Chat oder Doku wiederholen.
- Keine untracked Ordner `.agents/`, `.codex/`, `supabase/.temp/` committen.
- Keine Produktionsdaten löschen, ohne vorher explizit zu fragen.
- Bestehende MP4s ändern sich nicht durch Code-Deploy; sie müssen neu gerendert werden.
