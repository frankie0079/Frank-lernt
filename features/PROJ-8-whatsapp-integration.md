# PROJ-8: WhatsApp-Integration

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Links zur Plattform
- Related: PROJ-3 (Reisetagebuch) — Tagebucheinträge teilen
- Related: PROJ-7 (Tages-Statistiken) — Statistiken teilen

## User Stories
- Als Wanderer möchte ich mit einem Tap einen WhatsApp-Link für den aktuellen Tageseintrag teilen, damit Follower direkt zum richtigen Inhalt kommen.
- Als Wanderer möchte ich eine vorgefertigte Nachricht mit Tages-Zusammenfassung per WhatsApp teilen, damit ich nicht selbst schreiben muss.
- Als Besucher möchte ich jeden Inhalt (Foto, Eintrag, Karte) einfach per WhatsApp teilen können, damit ich Highlights weiterschicken kann.
- Als Wanderer möchte ich einen direkten Link zur Live-Karte teilen, damit Follower sofort sehen wo wir sind.

## Acceptance Criteria
- [ ] "Teilen"-Button bei jedem Tageseintrag, Foto und auf der Karte
- [ ] WhatsApp-Link öffnet direkt die WhatsApp-App mit vorgefertigtem Text + URL
- [ ] Vorgefertigte Nachricht enthält: Etappenname, Tages-Highlight, Link zur Plattform
- [ ] Link zur Live-Karte ist teilbar
- [ ] Share-Funktion funktioniert auf iPhone (öffnet WhatsApp App)
- [ ] Fallback: URL wird in Zwischenablage kopiert wenn WhatsApp nicht installiert ist

## Edge Cases
- Was wenn WhatsApp nicht installiert ist? → URL in Zwischenablage kopieren mit Bestätigung
- Was wenn der Link sehr lang ist? → URL-Shortener oder sprechende URLs
- Was wenn der geteilte Link abläuft? → Links sind permanent (keine Expiry)

## Technical Requirements
- WhatsApp URL-Schema: `https://wa.me/?text=...`
- Web Share API als primäre Option (auf modernen iPhones unterstützt)
- Clipboard API als Fallback
- Open Graph Meta-Tags für schöne Link-Vorschau in WhatsApp

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
