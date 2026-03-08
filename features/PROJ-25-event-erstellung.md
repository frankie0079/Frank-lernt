# PROJ-25: Event-Erstellung & -Verwaltung

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-03-08

## Dependencies
- Requires: PROJ-24 (Auth & User-Accounts) — Organisator muss eingeloggt sein, um Events zu erstellen

## User Stories
- Als Organisator möchte ich ein Event erstellen (Name, Datum, Beschreibung, Cover-Foto), damit Teilnehmer einen gemeinsamen Raum haben.
- Als Organisator möchte ich eine Agenda mit Tagesabschnitten (Datum, Titel, Beschreibung) erstellen, damit der Content strukturiert wird.
- Als Organisator möchte ich täglich einen Tages-Admin zuweisen können, damit die Kuration rotiert.
- Als Organisator möchte ich ein Event archivieren können wenn es abgeschlossen ist.
- Als Teilnehmer möchte ich alle Events sehen, zu denen ich eingeladen bin.

## Acceptance Criteria
- [ ] Event-Felder: Name (max 100 Zeichen, Pflicht), Beschreibung (max 500 Zeichen, optional), Startdatum (Pflicht), Enddatum (Pflicht), Cover-Foto (optional)
- [ ] Event-URL: `/events/[id]` — ID ist UUID, kein lesbarer Slug (Datenschutz)
- [ ] Öffentliche URL: `/e/[slug]` — slug wird aus Event-Name generiert (lowercase, Bindestriche)
- [ ] Agenda: Pro Event 1–30 Tages-Abschnitte, jeder mit Datum (Pflicht) + Titel (max 80 Zeichen, Pflicht) + optionaler Beschreibung (max 300 Zeichen)
- [ ] Tages-Admin-Zuweisung: Organisator kann pro Agenda-Eintrag einen Teilnehmer (aus Mitgliederliste) als Admin zuweisen
- [ ] Event-Liste auf `/events` zeigt nur Events, in denen der eingeloggte Nutzer Mitglied ist
- [ ] Event-Status: `planned` | `active` | `archived` — wird automatisch anhand von Datum gesetzt (cron oder on-read)
- [ ] Nur Organisator kann Event-Details bearbeiten (Name, Beschreibung, Cover-Foto, Agenda)
- [ ] Nur Organisator kann Event archivieren
- [ ] Cover-Foto ohne Angabe → Platzhalter-Gradient (Teal/Amber basierend auf Event-Name-Hash)
- [ ] Event-Erstellungsformular mit Zod-Validierung (client + server)
- [ ] Nach Erstellung wird Organisator automatisch als erstes Mitglied eingetragen (Rolle: `organizer`)

## Edge Cases
- Enddatum vor Startdatum → Validierungsfehler "Enddatum muss nach Startdatum liegen"
- Enddatum gleich Startdatum → Erlaubt (eintägiges Event)
- Cover-Foto > 5 MB → Fehlermeldung vor Upload, client-seitige Kompression (max 1920px)
- Event-Name führt zu Slug-Kollision → Zufälliges Suffix anhängen (z.B. `-2`)
- 0 Agenda-Einträge → Erlaubt, Beiträge werden ohne Tages-Zuordnung gespeichert
- 30+ Agenda-Einträge → Validierungsfehler "Maximal 30 Tages-Abschnitte"
- Event löschen → Bestätigungs-Dialog mit Text "Alle Beiträge, Fotos und Kommentare werden unwiderruflich gelöscht", alle Daten werden per CASCADE gelöscht
- Organisator ändert Tages-Admin-Zuweisung rückwirkend → Neuer Admin kann Entwurf des Vorgängers weiterbearbeiten
- Teilnehmer öffnet `/events/[fremdeId]` → 403 Forbidden (nicht Mitglied)

## Technical Requirements
- Supabase Tabellen: `events` (id UUID PK, name TEXT, description TEXT, start_date DATE, end_date DATE, cover_url TEXT, slug TEXT UNIQUE, status TEXT, organizer_id UUID FK auth.users, created_at TIMESTAMPTZ)
- Supabase Tabellen: `agenda_items` (id UUID PK, event_id UUID FK events CASCADE, date DATE, title TEXT, description TEXT, admin_user_id UUID FK profiles nullable, sort_order INT, created_at TIMESTAMPTZ)
- RLS auf `events`: SELECT für Mitglieder, INSERT für authentifizierte Nutzer, UPDATE/DELETE nur für Organisator
- RLS auf `agenda_items`: SELECT für Event-Mitglieder, INSERT/UPDATE/DELETE nur für Organisator
- Zod-Schema für Event-Validierung und Agenda-Validierung
- Slug-Generierung: `event-name-lowercased` → Kollisionsprüfung → ggf. `-2`, `-3` Suffix
- Cover-Foto: Supabase Storage Bucket `covers` (public read, authentifiziertes Write)
- `unstable_cache` für Event-Daten (selten geändert, 60s Revalidierung)

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
