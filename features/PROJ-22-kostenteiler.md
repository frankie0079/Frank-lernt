# PROJ-22: Kostenteiler

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-5 (PWA) — Nur in der PWA verfügbar (nicht auf der Landing Page)

## Konzept

Ein einfacher Kostenteiler für die Tour, nur in der PWA. Ein Administrator erfasst alle Ausgaben der Teilnehmer. Zu jedem Zeitpunkt ist klar, wer noch was an wen zahlen muss.

**Berechnung:** Alle Ausgaben werden summiert, durch die Teilnehmerzahl geteilt. Wer mehr als seinen Anteil bezahlt hat, bekommt von den anderen Geld. Wer weniger bezahlt hat, muss nachzahlen. Optimierte Verrechnung (minimale Anzahl an Transaktionen).

## User Stories
- Als Administrator möchte ich eine Ausgabe erfassen (wer hat bezahlt, Betrag, Beschreibung), damit alle Kosten transparent sind.
- Als Wanderer möchte ich jederzeit sehen, wer wie viel bezahlt hat und wer wem noch was schuldet, damit die Finanzen klar sind.
- Als Administrator möchte ich Ausgaben nachträglich bearbeiten oder löschen können, falls ich mich vertippt habe.
- Als Wanderer möchte ich am Ende der Tour eine Übersicht sehen: wer zahlt wem wie viel, damit wir schnell abrechnen können.

## User Flow
```
1. Administrator wird pro Tour festgelegt
2. Administrator erfasst Ausgabe:
   - Wer hat bezahlt? (Dropdown: Teilnehmer wählen)
   - Betrag (€)
   - Beschreibung (z.B. "Mittagessen", "Taxi", "Hotel")
   - Datum (automatisch heute, änderbar)
3. Übersicht zeigt:
   - Alle Ausgaben chronologisch
   - Pro Person: Gesamt bezahlt, fairer Anteil, Differenz
   - Wer schuldet wem wie viel (optimierte Verrechnung)
```

## Acceptance Criteria
- [ ] Administrator-Rolle pro Tour festlegbar (ein Teilnehmer)
- [ ] Teilnehmer der Tour werden einmalig erfasst (Name)
- [ ] Ausgabe erfassen: Zahler (Dropdown), Betrag (€), Beschreibung, Datum
- [ ] Ausgaben sind editier- und löschbar (nur durch Administrator)
- [ ] Übersicht aller Ausgaben chronologisch
- [ ] Pro Person angezeigt: Gesamt bezahlt, fairer Anteil, Saldo (+/-)
- [ ] Abrechnung: Wer zahlt wem wie viel (minimale Transaktionen)
- [ ] Beträge in Euro (€), zwei Dezimalstellen
- [ ] Nur in der PWA verfügbar (nicht auf der Landing Page)
- [ ] Offline-fähig: Ausgaben können ohne Internet erfasst werden, Sync bei Verbindung

## Edge Cases
- Was wenn nur 1 Teilnehmer? → Kostenteiler nicht sinnvoll, trotzdem als Ausgabenübersicht nutzbar
- Was wenn eine Ausgabe nicht für alle ist (z.B. nur für 3 von 5)? → Für MVP: Alle Ausgaben werden gleichmässig auf alle Teilnehmer aufgeteilt
- Was wenn der Betrag 0 ist? → Nicht speichern, Fehlermeldung
- Was wenn der Administrator wechseln soll? → Administrator-Rolle kann übertragen werden
- Was wenn jemand eine Tour vorzeitig verlässt? → Für MVP nicht vorgesehen, manuelle Korrektur

## Technical Requirements
- Supabase für Ausgaben-Daten (tours_expenses Tabelle)
- Offline-Queue via IndexedDB (wie andere PWA-Features)
- Optimierter Ausgleichs-Algorithmus (minimale Transaktionen)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
