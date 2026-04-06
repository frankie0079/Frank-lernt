# PROJ-31: Likes & Emoji-Reactions

## Status: Planned
**Created:** 2026-03-08
**Last Updated:** 2026-04-06

## Dependencies
- Requires: PROJ-28 (Content-Pool) — Reactions gehören zu Content-Items im Content-Pool

## User Stories
- Als Nutzer möchte ich auf Beiträge mit Emojis reagieren, damit ich schnell Feedback geben kann ohne einen Kommentar zu schreiben.
- Als Content-Ersteller möchte ich sehen, welche Reaktionen mein Beitrag bekommen hat, damit ich weiss wie er ankommt.
- Als Nutzer möchte ich meine Reaktion wieder entfernen können, falls ich falsch getippt habe.

## Acceptance Criteria
- [ ] 5 feste Emojis: ❤️ 🔥 😂 👏 😮 (in dieser Reihenfolge)
- [ ] Reaction-Bar erscheint am unteren Rand jeder Karteikarte im Content-Pool
- [ ] Tap auf Emoji → Reaktion hinzufügen (eigene Reaktion wird in DB gespeichert)
- [ ] Tap auf bereits aktives Emoji → Reaktion entfernen (Toggle-Verhalten)
- [ ] Eigene aktive Reaktion: Emoji-Button mit farbigem Hintergrund (Teal) und Skalierung (1.2x)
- [ ] Zähler neben jedem Emoji: bei 0 ausgeblendet, bei ≥ 1 sichtbar
- [ ] Zähler zeigt Gesamtanzahl aller Nutzer-Reaktionen pro Emoji
- [ ] Reaktionen aktualisieren sich live bei allen Teilnehmern (Supabase Realtime auf `reactions` Tabelle)
- [ ] Pro Nutzer + Emoji + Beitrag: maximal 1 Reaktion (UNIQUE Constraint in DB)
- [ ] Optimistic UI: Zähler aktualisiert sich sofort lokal, Rollback bei Fehler
- [ ] Reaktionen sind auch für nicht eingeloggte Besucher auf öffentlicher Event-Seite sichtbar (aber nicht klickbar)

## Edge Cases
- Zähler > 99 → "99+" anzeigen (kein Overflow in der UI)
- Gleichzeitiges Reagieren zweier Nutzer auf denselben Beitrag → Beide erhalten korrekten Realtime-Update (kein Lost-Update durch Optimistic UI + Reconcile: lokaler State wird mit Server-Stand zusammengeführt)
- Offline → Optimistic Update sofort, Sync-Retry via Background Sync; bei dauerhafter Offline-Phase wird State beim nächsten Load korrigiert
- Nutzer tippt sehr schnell (Doppeltippen) → Debounce (200ms) verhindert doppelte DB-Writes
- Beitrag wird gelöscht während Nutzer reagiert → Reaktions-Request schlägt fehl (404), Toast "Beitrag nicht mehr vorhanden", Karte verschwindet
- Nicht eingeloggter Nutzer tippt auf Emoji → Toast "Bitte melde dich an, um zu reagieren" + Link zur Login-Seite
- Supabase Realtime unterbrochen → Zähler werden bei Reconnect einmalig neu geladen

## Technical Requirements
- Supabase Tabelle: `reactions` (id UUID PK, content_item_id UUID FK content_items CASCADE, user_id UUID FK auth.users, emoji TEXT CHECK (emoji IN ('❤️','🔥','😂','👏','😮')), created_at TIMESTAMPTZ)
- UNIQUE Constraint auf `reactions(content_item_id, user_id, emoji)`
- RLS auf `reactions`: SELECT public, INSERT für authentifizierte Nutzer (nur eigene), DELETE für eigene Reaktion (auth.uid() = user_id)
- API: `POST /api/events/[id]/content/[itemId]/reactions` (emoji im Body) → Zod-validiert
- API: `DELETE /api/events/[id]/content/[itemId]/reactions?emoji=[emoji]`
- Supabase Realtime: `supabase.channel('reactions').on('postgres_changes', ...)` auf `reactions` INSERT/DELETE
- Zähler-Aggregation: Server-seitig via `SELECT emoji, COUNT(*) FROM reactions WHERE content_item_id = $1 GROUP BY emoji`
- Client-State: `Map<emoji, {count: number, userReacted: boolean}>` pro Content-Item
- Debounce: 200ms auf Tap-Event, kein gleichzeitiger API-Call für dasselbe Emoji

---

## Tech Design (Solution Architect)

### Übersicht

Reactions sind ein rein ergänzendes Feature auf bestehenden Content-Karten. Die gesamte Logik liegt in einer einzigen neuen Komponente (`ReactionBar`). Diese wird unten in die bestehende `ContentCard` eingebettet — keine anderen Komponenten werden umgebaut.

---

### Component Structure

```
ContentCard (bestehend — src/components/content-card.tsx)
+-- [bestehend] Foto/Video/Text/Audio
+-- [bestehend] Autor, Zeitstempel, Caption
+-- ReactionBar (NEU — src/components/reaction-bar.tsx)
    +-- ReactionButton × 5 (❤️ 🔥 😂 👏 😮)
    |   +-- Emoji
    |   +-- Zähler (ausgeblendet wenn 0, "99+" wenn > 99)
    |   +-- Aktiv-Zustand: Teal-Hintergrund + 1.2x Skalierung
    +-- [auf öffentlicher Event-Seite] read-only, nicht klickbar
```

---

### Datenmodell

**Neue Tabelle: `reactions`**

| Feld | Inhalt |
|---|---|
| id | Eindeutige ID (UUID) |
| content_item_id | Welcher Beitrag — CASCADE-Delete wenn Beitrag gelöscht |
| member_id | Wer hat reagiert (FK → members) |
| emoji | Welches Emoji (CHECK: nur ❤️ 🔥 😂 👏 😮 erlaubt) |
| created_at | Wann |

**UNIQUE Constraint** auf `(content_item_id, member_id, emoji)` — pro Person, Beitrag und Emoji maximal 1 Eintrag. Verhindert doppelte Reaktionen auf DB-Ebene.

**RLS:**
- SELECT: öffentlich (auch für nicht eingeloggte Besucher der öffentlichen Event-Seite)
- INSERT: nur für eingeloggte Mitglieder (eigene Reaktion)
- DELETE: nur eigene Reaktion (`member_id = current_member`)

---

### Ablauf (Tap-Logik)

**Tap auf inaktives Emoji:**
1. Zähler erhöht sich sofort lokal (Optimistic UI)
2. API POST speichert im Hintergrund
3. Bei Fehler → Rollback + Toast

**Tap auf aktives Emoji (Toggle):**
1. Zähler sinkt sofort lokal
2. API DELETE entfernt im Hintergrund
3. Bei Fehler → Rollback + Toast

**Debounce:** 200ms Sperre nach jedem Tap — verhindert Doppeltippen und doppelte API-Calls.

---

### Realtime

Supabase Realtime lauscht auf INSERT/DELETE in `reactions`. Wenn ein anderer Teilnehmer reagiert, aktualisieren sich alle Zähler live — kein Reload nötig. Bei Reconnect werden Zähler einmalig neu geladen.

---

### Neue API-Endpunkte

| Route | Methode | Zweck |
|---|---|---|
| `/api/events/[id]/content/[itemId]/reactions` | POST | Reaktion hinzufügen (emoji im Body, Zod-validiert) |
| `/api/events/[id]/content/[itemId]/reactions` | DELETE | Reaktion entfernen (?emoji=❤️ im Query) |

Reaktions-Aggregation (Zähler pro Emoji) wird beim Laden der Content-Items mitgeliefert — kein separater Request.

---

### Tech-Entscheidungen

**Optimistic UI:** Reaktionen müssen instant wirken. Wir updaten lokal sofort und korrigieren nur bei Server-Fehler. Standard-Pattern für alle Social-Features.

**Realtime auf DB-Ebene:** Supabase Realtime auf `reactions`-Tabelle — dasselbe Muster das bereits für den Content-Pool genutzt wird (PROJ-28). Kein Polling, keine Custom WebSockets.

**Keine neuen Pakete:** `Button`, `Badge` aus shadcn/ui bereits installiert. Realtime-Client bereits vorhanden.

---

### Abhängigkeiten

Keine neuen npm-Pakete nötig.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
