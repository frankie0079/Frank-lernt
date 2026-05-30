# Next Steps

Stand: 2026-05-30

## Morgen Als Erstes

1. Live-Direktlink für Frank testen:

```text
https://frank-lernt.vercel.app/join/Wizz750?next=/events/85f0339d-edac-462d-bc0e-85d448a375f1/settings
```

Erwartung: Der Link setzt den Frank-Zugang neu und öffnet direkt die Event-Einstellungen von Hong Kong.

2. Falls der Browser trotzdem wieder nur Rota zeigt:
   - prüfen, ob Vercel den Commit `452d97b` bereits live ausliefert
   - im Browser alte Cookies für `frank-lernt.vercel.app` löschen oder erneut den Direktlink öffnen
   - `/api/members/me` prüfen: es muss `Frank` und nicht `Ciano` sein

3. Danach mit dem eigentlichen Archiv weiterarbeiten:
   - gemeinsames Wandervögel-Archiv öffnen
   - privaten Hong-Kong-Link öffnen
   - Archiv-Einstellungen pro Event prüfen
   - Nachreich-Upload nur bei Bedarf mit echter Datei testen

## Was Heute Gebaut Wurde

PROJ-43 „Die Wandervögel Event-Archiv“ ist implementiert und deployed.

Produktmodell:

- Mobile App bleibt Generator, Uploader und Kuratierwerkzeug.
- Archiv ist die dauerhafte Web-Ausgabe.
- Slideshow wird nicht archiviert.
- Archiv basiert auf der Tagebuch-/Archiv-Auswahl.
- Community-Events erscheinen im gemeinsamen Wandervögel-Archiv.
- Private Events haben einen eigenen privaten Link.
- Organizer kann nachträglich Archivmedien ergänzen.

## Wichtige Links

Gemeinsames Archiv:

```text
https://frank-lernt.vercel.app/archiv/a021e149415a40e20ce8c1b4f49d0f3d
```

Rota im gemeinsamen Archiv:

```text
https://frank-lernt.vercel.app/archiv/a021e149415a40e20ce8c1b4f49d0f3d/rota-vincentina
```

Privates Hong-Kong-Archiv:

```text
https://frank-lernt.vercel.app/archiv/privat/a21e6d9e87b00f6685531b104ce9dae0
```

Hong-Kong Event-Einstellungen über Frank-Login:

```text
https://frank-lernt.vercel.app/join/Wizz750?next=/events/85f0339d-edac-462d-bc0e-85d448a375f1/settings
```

## Datenstand

- Frank ist Organizer von Hong Kong und Rota.
- `Wizz750` gehört zu Frank.
- Hong Kong April 2026 ist `private` und veröffentlicht.
- Rota Vincentina ist `community` und veröffentlicht.
- Im Chrome-Screenshot war der aktive Nutzer `Ciano`; deshalb wurde Hong Kong nicht angezeigt und der Direktlink auf die Einstellungen landete wieder bei `/events`.

## Technischer Stand

Commits auf `main`:

- `7e6c3ce feat(PROJ-43): add Wandervoegel archive`
- `102318d docs(PROJ-43): mark archive deployed`
- `deb394e feat(PROJ-43): allow organizer archive media uploads`
- `452d97b fix(PROJ-43): support direct admin join redirects`

Supabase:

- Migration `20260530133000_wandervoegel_archive.sql` angewendet.
- Migration History remote repariert: `20260530133000` ist applied.
- Keine manuelle Schema-Änderung im Dashboard.

Verifikation:

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS mit bestehenden Warnungen.
- `npm run build`: PASS.
- Lokaler Direktlink mit `?next=`: PASS.
- Production-Archivseiten: PASS.
- Production-Settings vor Direktlink-Fix: PASS.
- Production-Direktlink-Fix muss morgen noch einmal geprüft werden, sobald Vercel den letzten Commit sicher live ausliefert.

## Offene Punkte

- Direktlink nach Vercel-Deployment live prüfen.
- Begriffe in der UI klären: besser „Event-Einstellungen“ oder „Archiv-Einstellungen“ statt „HK Einstellungen“.
- Kein echter Test-Upload ins Hong-Kong-Archiv wurde gemacht, damit keine künstliche Datei im Event landet.
- Später separat planen:
  - Canvas-/Layout-Studio für finale Archivseiten
  - PDF-Export aus dem Archiv
  - ZIP-/Event-Download
  - Auslagerung von Originaldateien aus Supabase in externen Speicher
  - kontrolliertes Leeren von Supabase nach Archivierung

## Nicht Vergessen

- Kein Passwort, Token oder Service-Key in Chat oder Doku wiederholen.
- Keine untracked Ordner `.agents/`, `.codex/`, `supabase/.temp/` committen.
- Keine Produktionsdaten löschen, ohne vorher explizit zu fragen.
