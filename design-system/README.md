# Design System — EventDocs

Diese Ordnerstruktur enthält die Design-System-Quellen, auf denen der Look der App basiert.
Sie ist **Nachschlagewerk + Archiv** — der Code unter `src/` setzt die Tokens bereits um; diese Dateien dokumentieren, woher die Werte kommen und was sonst noch als Vorlage existiert.

## Aktives System

### [Aloha-Sixty](aloha-sixty/) — seit 2026-04-24

Vintage-Hawaii-Briefmarken-Ästhetik, entstanden in [claude.ai/design](https://claude.ai/design) auf Basis der „Frankie's Aloha-Sixty"-Briefmarke.

**Was wo liegt in Aloha-Sixty:**

| Datei | Inhalt |
|---|---|
| [aloha-sixty/README.md](aloha-sixty/README.md) | Ursprünglicher Handoff-Bundle-README aus Claude Design (Intent + Anweisung) |
| [aloha-sixty/tokens.css](aloha-sixty/tokens.css) | **Quelle der Wahrheit** — Farben, Typografie, Spacing, Radien, Shadows als CSS-Variablen |
| [aloha-sixty/styles.css](aloha-sixty/styles.css) | Vanilla-CSS-Komponenten (Buttons, Badges, Cards, Event-Tiles, Forms, Ticket, Stamp, Ribbon, Waves) — **Referenz**, nicht eingebunden |
| [aloha-sixty/chats/chat1.md](aloha-sixty/chats/chat1.md) | Transkript des Design-Gesprächs mit Claude Design (dokumentiert Intent + Entscheidungen) |

> **Hinweis:** Die HTML-Demo-Seite (`Aloha-Sixty Designsystem.html`) aus dem Original-Bundle ist hier nicht enthalten, weil der Share-Link bei der Re-Fetch bereits abgelaufen war. Du kannst sie jederzeit neu aus [claude.ai/design](https://claude.ai/design) exportieren, falls du die visuelle Übersicht brauchst.

## Wie die Tokens in der App ankommen

Der Handoff-Bundle liegt in diesem Ordner als Archiv. Die tatsächlich verwendeten Werte sind an diese Stellen übertragen:

| Aloha-Quelle | Im Code umgesetzt in |
|---|---|
| `tokens.css` — Farben (`--as-terracotta`, `--as-paper`, …) | [src/app/globals.css](../src/app/globals.css) — als HSL-Werte auf shadcn-Tokens (`--primary`, `--background`, …) |
| `tokens.css` — Fonts (`--as-font-display`, `--as-font-body`) | [src/app/layout.tsx](../src/app/layout.tsx) — Alfa Slab One + Oswald + Work Sans via `next/font/google` |
| `tokens.css` — Font-Family-Mapping | [tailwind.config.ts](../tailwind.config.ts) — `fontFamily.display`, `fontFamily.headline`, `fontFamily.sans` |
| Papier-Textur (`.as-paper-texture`) | [src/app/globals.css](../src/app/globals.css) — `.paper-texture` Utility (optional auf Hero-Containern) |
| — | **TTF-Dateien:** [public/fonts/](../public/fonts/) (AlfaSlabOne, Oswald, WorkSans — für PDF-Rendering via `@react-pdf/renderer`) |
| — | **PDF-Themes:** [src/components/pdf/pdf-theme.ts](../src/components/pdf/pdf-theme.ts) — 3 Aloha-Varianten (Classic/Warm/Dark) |

## Wie ich Änderungen mache

### Farbe tauschen (app-weit)
1. In [src/app/globals.css](../src/app/globals.css) den HSL-Wert des entsprechenden Tokens ändern
2. Ggf. [src/components/pdf/pdf-theme.ts](../src/components/pdf/pdf-theme.ts) analog anpassen (PDF-Themes haben eigene Kopie der Farben als HEX)
3. Dieser Ordner (`design-system/aloha-sixty/tokens.css`) wird **nicht** automatisch mit angepasst — nur updaten wenn du den „Stand der Wahrheit" hier auch aktualisieren möchtest

### Font tauschen
1. Neue TTFs (aus [fontsource](https://cdn.jsdelivr.net/fontsource/fonts/)) in [public/fonts/](../public/fonts/) ablegen
2. In [src/app/layout.tsx](../src/app/layout.tsx) den entsprechenden `next/font`-Import anpassen
3. In [src/components/pdf/cover-page.tsx](../src/components/pdf/cover-page.tsx) die `Font.register`-Aufrufe anpassen
4. Ggf. in [tailwind.config.ts](../tailwind.config.ts) die Fallback-Kette aktualisieren

### Ein neues Design-System ausprobieren
1. Neuen Unterordner `design-system/<name>/` anlegen
2. Tokens + Styles dort ablegen (so wie aloha-sixty)
3. Diese README aktualisieren: neues System als aktiv markieren, altes in eine „Archiv"-Sektion verschieben
4. Migration wie bei Aloha-Sixty: Tokens nach `globals.css`, Fonts nach `public/fonts/` + `layout.tsx`, PDF-Themes nach `pdf-theme.ts`

## Archiv

Bisher keine abgelösten Systeme. Falls wir Aloha-Sixty irgendwann durch ein anderes System ersetzen, zieht Aloha-Sixty nach `archive/aloha-sixty/` um und bleibt dort als Referenz erhalten.
