# PROJ-40: Event-Countdown

## Status: Deployed
**Created:** 2026-04-23
**Last Updated:** 2026-04-24

## Dependencies
- Requires: PROJ-25 (Event-Erstellung) — liefert `start_date`-Feld
- Requires: PROJ-24 (Auth) — Countdown ist nur für eingeloggte Teilnehmer sichtbar
- Wiederverwendet: `src/components/public-countdown.tsx` (PROJ-35) — Basis-Logik bereits vorhanden

## Hintergrund

Teilnehmer eines bevorstehenden Events sehen nach dem Login auf der Event-Seite aktuell keinen Hinweis darauf, wie bald das Event startet. Ein Countdown zwischen Cover-Foto und Event-Titel erzeugt Vorfreude und gibt eine schnelle Zeitorientation — besonders auf iPhone, wo die Seite oft als PWA-Shortcut geöffnet wird.

Eine frühere Version des Countdowns existiert bereits als `src/components/public-countdown.tsx` (genutzt auf der öffentlichen Event-Seite PROJ-35). Er zählt aber bis Mitternacht und zeigt Sekunden an. Für den Event-internen Countdown sind zwei Anpassungen nötig: Zielzeit 12:00 Uhr (Reisestart) statt Mitternacht, und keine Sekundenanzeige (zu unruhig für eine Übersichtsseite).

## User Stories

- Als Teilnehmer möchte ich beim Öffnen der Event-App sofort sehen, wie viele Tage, Stunden und Minuten es bis zum Eventstart sind, damit ich mich mental auf die Reise einstimmen kann.
- Als Organisator möchte ich, dass der Countdown automatisch verschwindet sobald das Event begonnen hat (start_date 12:00 Uhr), damit kein veralteter Countdown angezeigt wird wenn die Reise läuft.
- Als Teilnehmer möchte ich den Countdown auch im Erfassen-Tab sehen, damit ich — falls ich die App schon vor dem Start öffne — die Vorfreude spüre.
- Als Entwickler möchte ich, dass der Countdown auf dem bestehenden `PublicCountdown`-Baustein basiert (Zeitberechnung + Styling), damit wir nichts doppelt bauen.

## Acceptance Criteria

- [ ] Wenn `event.start_date` in der Zukunft liegt (bezogen auf start_date 12:00 Uhr Ortszeit), erscheint ein Countdown zwischen dem Cover-Foto und dem Event-Titel auf `/events/[id]`
- [ ] Der Countdown zeigt **Tage, Stunden, Minuten** — keine Sekunden
- [ ] Der Countdown aktualisiert sich automatisch (mindestens alle 60 Sekunden), ohne dass die Seite neu geladen werden muss
- [ ] Sobald die aktuelle Zeit ≥ start_date 12:00 Uhr ist, verschwindet der Countdown und die Seite sieht aus wie für laufende Events
- [ ] Der Countdown ist auf dem **Übersichts-Tab** (Standard-Ansicht von `/events/[id]`) sichtbar
- [ ] Der Countdown ist auf dem **Erfassen-Tab** sichtbar (weil er zwischen Cover und Titel liegt, oberhalb der Tab-Leiste)
- [ ] Events, die bereits begonnen haben oder abgeschlossen sind, zeigen keinen Countdown
- [ ] Der Countdown zeigt das Startdatum in lesbarer Form an (z.B. „Startet am Montag, 5. Mai 2026")
- [ ] Kein Countdown auf der öffentlichen Event-Seite `/e/[slug]` — dort gelten die bestehenden Regeln aus PROJ-35

## Edge Cases

- **Event startet heute** — Stunden/Minuten bis 12:00 korrekt anzeigen, auch wenn Tage = 0 (Anzeige: „0 Tage, 3 Std, 42 Min")
- **Event hat bereits um 12:00 begonnen** — Countdown verschwindet zur richtigen Zeit, auch ohne Seiten-Reload (client-seitiger Timer)
- **Event liegt in der Vergangenheit** — kein Countdown, ganz normale Event-Seite (kein Edge Case im Code, da der selbe `ms === 0`-Check greift)
- **Timezonen** — App ist auf Deutsch / Europa ausgelegt; `new Date(startDate + "T12:00:00")` ohne explizite Timezone nutzt die lokale Browser-Timezone, was für die Zielgruppe (iPhone-Nutzer in Europa) korrekt ist
- **Sehr kurze Events (Tagesausflug)** — start_date = end_date, Countdown funktioniert identisch
- **Offline** — Countdown läuft weiter, da er rein client-seitig rechnet (kein Netzwerkaufruf)

## Technical Requirements

- **Zu ändernde Datei:** `src/components/public-countdown.tsx`
  - Neue prop `targetHour?: number` (default: `12` für den neuen Einsatzort; bisheriger `0` für die öffentliche Seite wird als Default-Override übergeben)
  - Sekunden-Spalte aus dem Grid entfernen (`grid-cols-4` → `grid-cols-3`)
  - Interval von 1000ms auf 60000ms reduzieren
  - Beide bestehenden Aufrufer (`src/app/e/[slug]/page.tsx` oder ähnlich) erhalten explizit `targetHour={0}` damit das bestehende Verhalten erhalten bleibt
- **Zu ändernde Datei:** `src/app/events/[id]/page.tsx`
  - `PublicCountdown` zwischen dem Cover-Div (`</div>`) und dem Title-Div (`{/* Event Title + Meta */}`) einfügen
  - Nur rendern wenn `event.start_date` vorhanden — die Komponente selbst entscheidet per `if (parts.done) return null`
  - Kein neues Backend-Call nötig — `start_date` ist bereits im `event`-Objekt vorhanden
- **Keine neuen Pakete**
- **Keine Datenbankänderung**
- **Keine API-Änderung**

---

## Tech Design (Solution Architect)
_Skipped on Frank's request — tiny pure-frontend change, implementation details documented directly in spec above._

## Frontend Implementation

**Files changed:**

- `src/components/public-countdown.tsx`
  - New optional prop `targetHour?: number` (default `12`). Target is computed as `new Date(y, m-1, d, targetHour, 0, 0, 0)` in local browser time.
  - Seconds column removed (`grid-cols-4` → `grid-cols-3`), `seconds` field removed from `diffParts`.
  - Update interval reduced from `1000ms` to `60_000ms`. Switched to a `now`-state + derived `parts` pattern to avoid the `set-state-in-effect` lint rule while still recomputing immediately when `target` changes.
  - `aria-live="polite"` preserved.
- `src/app/e/[slug]/page.tsx`
  - Existing call site passes `targetHour={0}` explicitly to preserve midnight behavior from PROJ-35.
- `src/app/events/[id]/page.tsx`
  - `PublicCountdown` imported and rendered between the cover `<div>` and the "Event Title + Meta" block, guarded by `event.start_date`. Default `targetHour={12}` applies. Wrapper uses `mx-auto max-w-2xl px-4 pt-4` to line up with the title block on mobile. The component itself returns `null` once `parts.done`, so no extra status check is needed. Because the countdown sits above the `Tabs`, it is visible on every tab (including "Erfassen").

## QA Test Results

**QA Date:** 2026-04-23
**QA Round:** 1
**Status:** PASSED

### Test-Ausführung
- `npm run lint` → 0 errors (14 Warnings alle pre-existing)
- `npm run build` → grün, alle Routes kompiliert
- Visueller Smoke-Test auf Desktop: Frank hat mehrere UX-Iterationen durchgespielt (Rechteck rausgenommen, „in:"-Prefix, rechtsbündig, compact-Variante) und am Ende bestätigt: „ok. passt."

### Acceptance Criteria

| # | AC | Status | Methode |
|---|----|--------|---------|
| 1 | Countdown erscheint bei zukünftigem start_date auf /events/[id] | ✓ | Rota Vincentina (2026-06-14): Countdown sichtbar, HK (Vergangenheit): nicht sichtbar |
| 2 | Tage/Std/Min — keine Sekunden | ✓ | `grid-cols-4` → `grid-cols-3`, seconds aus `diffParts` entfernt |
| 3 | Automatisches Update mind. alle 60s | ✓ | setInterval 60_000ms in useEffect |
| 4 | Countdown verschwindet ab Startzeit | ✓ | `if (parts.done) return null` — Client-Timer bumpt `now`, parts wird neu berechnet |
| 5 | Sichtbar auf Übersichts-Tab | ✓ | Wrapper oberhalb der Tabs in /events/[id]/page.tsx |
| 6 | Sichtbar auf Erfassen-Tab | ✓ | Gleiche Position → automatisch auf jedem Tab sichtbar |
| 7 | Vergangene Events zeigen keinen Countdown | ✓ | Gleiche parts.done-Logik; HK-Event getestet |
| 8 | Lesbares Startdatum-Format | ✓ | `toLocaleDateString("de-DE", { weekday, day, month, year })` |
| 9 | Kein Countdown auf /e/[slug] | ✓ | Öffentliche Seite nutzt `targetHour={0}` + Full-Banner-Variante; Compact-Variante nur in /events |

### Zusätzlich: EventCard (Meine-Events-Liste)

Frank hat nach erstem Durchlauf gewünscht, dass der Countdown auch auf der Event-Liste erscheint. Ergänzt in `src/components/event-card.tsx`. Gleiche compact-Variante.

### UX-Iterationen (vor Final-Approval)

1. Rechteck mit Füllung (`border-2 border-primary bg-primary/15`) → zu prominent
2. Text-only, kein Rechteck → besser
3. „in:"-Prefix vor der ersten Zahl → Frank-Wunsch
4. Linksbündig → dann rechtsbündig (Finalversion)

### Fazit
PROJ-40 ist **deploymentbereit**. Keine Bugs, keine offenen ACs. Reine Frontend-Änderung, keine DB-Änderung, keine API-Änderung.

## Deployment

**Deployed:** 2026-04-24
**Production URL:** https://frank-lernt.vercel.app

### Änderungen
- `src/components/public-countdown.tsx` — Neue `targetHour`- und `compact`-Props. Compact-Variante text-only, rechtsbündig, mit „in:"-Prefix
- `src/app/events/[id]/page.tsx` — Countdown zwischen Cover und Titel eingefügt, `compact`-Variante
- `src/components/event-card.tsx` — Countdown auch auf der Meine-Events-Liste eingebaut
- `src/app/e/[slug]/page.tsx` — Expliziter `targetHour={0}` zur Erhaltung der PROJ-35-Mitternacht-Semantik

### Verifikation
- `npm run lint` → 0 errors
- `npm run build` → grün
- Visueller Smoke-Test mit Rota-Vincentina-Event (Start 2026-06-14) → Countdown zeigt ~52 Tage
- HK-Event (Vergangenheit) → kein Countdown, wie erwartet
- Vercel Deploy via git push auf main ausgelöst
