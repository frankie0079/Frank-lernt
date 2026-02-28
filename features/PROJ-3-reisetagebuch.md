# PROJ-3: Reisetagebuch

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Navigation und Seitenstruktur
- Related: PROJ-4 (Fotogalerie) — Fotos im Tagebuch anzeigen
- Related: PROJ-6 (Interaktive Karte) — GPS-Position von Einträgen

## User Stories
- Als Wanderer möchte ich einen Tageseintrag erstellen (Text, Stimmung, Highlight des Tages), damit die Erlebnisse dokumentiert werden.
- Als Wanderer möchte ich einen Kommentar mit GPS-Position hinzufügen, damit Follower sehen wo das Erlebnis stattfand.
- Als Follower möchte ich alle Tageseinträge chronologisch lesen, damit ich die Tour miterlebe.
- Als Follower möchte ich einen Kommentar hinterlassen (Text + optionaler Name), damit ich Mut zusprechen kann.
- Als Besucher möchte ich Fotos direkt im Tagebucheintrag sehen, damit der Eintrag lebendiger wird.
- Als Wanderer möchte ich einen Eintrag nachträglich bearbeiten, damit ich Tippfehler korrigieren kann.

## Acceptance Criteria
- [ ] Tageseintrag erstellbar: Datum, Titel, Freitext, Highlight-Satz
- [ ] Kommentare können mit Text und optionalem Autorname hinzugefügt werden
- [ ] Tageseinträge werden chronologisch angezeigt (neueste zuerst)
- [ ] Fotos können einem Tageseintrag zugeordnet werden
- [ ] GPS-Koordinaten werden bei Einträgen gespeichert (wenn verfügbar)
- [ ] Einträge und Kommentare sind öffentlich lesbar (kein Login)
- [ ] Einträge und Kommentare können ohne Login erstellt werden
- [ ] Mobile-optimierte Eingabe (grosse Textfelder, einfaches Tippen)
- [ ] Einträge können nachträglich bearbeitet werden

## Edge Cases
- Was wenn ein Eintrag sehr langer Text ist? → Kürzen mit "Mehr lesen" expandierbar
- Was wenn kein GPS verfügbar ist? → Eintrag ohne Koordinaten speichern
- Was wenn beleidigende Kommentare gepostet werden? → Kein automatischer Filter für MVP; manuelles Löschen möglich
- Was wenn die Verbindung während dem Schreiben abbricht? → Text lokal zwischenspeichern (LocalStorage)
- Was wenn kein Autorname angegeben wird? → Als "Anonym" anzeigen

## Technical Requirements
- Texteingabe mit einfachem Markdown-Support (Fettschrift, Listen)
- Optimistic UI — Kommentar erscheint sofort, wird im Hintergrund gespeichert
- Realtime-Updates via Supabase Realtime (neue Kommentare erscheinen ohne Reload)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
