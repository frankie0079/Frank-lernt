# Next Steps

Stand: 2026-05-31

## Heute Geprueft

PROJ-43 "Die Wandervoegel Event-Archiv" ist live verifiziert.

- Production-Direktlink mit `next=/events/.../settings`: PASS.
- Zielseite: Hong-Kong-Event-Einstellungen statt Rueckfall auf `/events`: PASS.
- Nutzerkontext: `Frank (Du)` als Organisator sichtbar: PASS.
- Event-Uebersicht fuer Frank zeigt Rota Vincentina und Hong Kong April 2026: PASS.
- Gemeinsames Wandervoegel-Archiv zeigt Rota Vincentina: PASS.
- Rota-Archivdetail zeigt den erwarteten Zustand "Noch kein Tagebuch": PASS.
- Privates Hong-Kong-Archiv rendert die veroeffentlichten Tagebuchseiten: PASS.
- Rota-Einstellungen: Sichtbarkeit `Wandervoegel-Archiv`, Status `Veroeffentlicht`: PASS.
- Hong-Kong-Einstellungen: Sichtbarkeit `Privat`, Status `Veroeffentlicht`: PASS.

## Was Als Naechstes Ansteht

1. UI-Copy-Pass fertigstellen und deployen:
   - Seitentitel wurde lokal von "Einstellungen" auf "Event-Einstellungen" geaendert.
   - Lokale Checks sind gruen: `npx tsc --noEmit`, `npm run lint` (nur bestehende Warnungen), `npm run build`.
   - Noch offen: Commit, Push, Production-Verifikation nach Vercel-Deployment.

2. Nachreich-Upload nur bei echtem Bedarf testen:
   - Nicht mit Dummy-Dateien in Production testen.
   - Wenn eine echte Datei fehlt: ueber Event-Einstellungen hochladen, danach im Tagebuch/Archiv uebernehmen und kontrollieren.

3. Speicher-Thema spaeter separat planen:
   - Rota/Hong-Kong zeigen bereits relevante Storage-Nutzung.
   - Keine Produktionsdaten loeschen, ohne vorher explizit zu fragen.
   - Vor einer Bereinigung erst Dry-Run auswerten.

## Technischer Stand

Commits auf `main`:

- `7e6c3ce feat(PROJ-43): add Wandervoegel archive`
- `102318d docs(PROJ-43): mark archive deployed`
- `deb394e feat(PROJ-43): allow organizer archive media uploads`
- `452d97b fix(PROJ-43): support direct admin join redirects`

Supabase:

- Migration `20260530133000_wandervoegel_archive.sql` angewendet.
- Migration History remote repariert: `20260530133000` ist applied.
- Keine manuelle Schema-Aenderung im Dashboard.

Verifikation:

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS mit bestehenden Warnungen.
- `npm run build`: PASS.
- Lokaler Direktlink mit `?next=`: PASS.
- Production-Archivseiten: PASS.
- Production-Settings nach Direktlink-Fix: PASS.

## Spaeter Separat Planen

- Canvas-/Layout-Studio fuer finale Archivseiten.
- PDF-Export aus dem Archiv.
- ZIP-/Event-Download.
- Auslagerung von Originaldateien aus Supabase in externen Speicher.
- Kontrolliertes Leeren von Supabase nach Archivierung.

## Nicht Vergessen

- Keine Passwoerter, Tokens oder Service-Keys in Chat oder Doku wiederholen.
- Keine untracked Ordner `.agents/`, `.codex/`, `supabase/.temp/` committen.
- Keine Produktionsdaten loeschen, ohne vorher explizit zu fragen.
