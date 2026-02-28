# PROJ-5: PWA — GPS-Tracking, Quick-Capture, Offline-Modus

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-1 (Landing Page) — Basis-App muss stehen

## Konzept

Die PWA ist das zentrale Werkzeug für **alle Wanderer unterwegs**. Sie ermöglicht:
- **Quick-Capture:** Direkt in der App fotografieren (Foto + GPS + Zeitstempel in einem Schritt)
- **Mediathek-Import:** Fotos aus dem iPhone-Fotoalbum in eine Tour hochladen
- **GPS-Tracking:** Kontinuierliche Aufzeichnung der gelaufenen Route
- **Offline-Modus:** Alles funktioniert auch ohne Empfang, Sync bei nächster Verbindung

**Foto-Upload nur über die PWA** — die Landing Page ist ausschliesslich zum Anschauen.

## User Stories
- Als Wanderer möchte ich die App auf meinem iPhone installieren (Add to Home Screen), damit sie sich wie eine native App anfühlt.
- Als Wanderer möchte ich mit einem Tap ein Foto aufnehmen (Quick-Capture) mit automatischem GPS + Zeitstempel.
- Als Wanderer möchte ich Fotos aus meiner Mediathek in die Galerie einer Tour hochladen (Tour wählen → "Fotos hochladen" → Mediathek → Fertig).
- Als Wanderer möchte ich meinen GPS-Standort kontinuierlich tracken lassen, damit die gelaufene Route aufgezeichnet wird.
- Als Wanderer möchte ich die App auch ohne Internetverbindung nutzen (Offline-Modus).
- Als Wanderer möchte ich, dass offline erstellte Inhalte automatisch synchronisiert werden sobald Verbindung besteht.
- Als Follower möchte ich die App ebenfalls installieren, damit ich die Tour bequem verfolge.

## Acceptance Criteria
- [ ] App ist als PWA installierbar (Web App Manifest, HTTPS)
- [ ] "Add to Home Screen" funktioniert auf iPhone Safari
- [ ] Vollbild-Modus ohne Browser-UI nach Installation
- [ ] Quick-Capture: PWA-Kamera öffnet sich direkt, Foto + GPS + Timestamp in einem Schritt
- [ ] Mediathek-Import: Tour wählen → "Fotos hochladen" → iPhone-Fotoalbum öffnet sich → Fotos wählen → Upload
- [ ] GPS-Tracking läuft im Hintergrund und speichert Position alle 30 Sekunden
- [ ] Offline-Modus: App startet und zeigt zuletzt geladene Inhalte
- [ ] Offline erstellte Einträge/Fotos werden in einer Queue gespeichert
- [ ] Automatische Synchronisierung wenn Verbindung wiederhergestellt wird
- [ ] GPS-Zugriff wird beim ersten Start angefragt (Permission)
- [ ] Kamera-Zugriff wird beim ersten Start angefragt (Permission)
- [ ] App-Icon erscheint auf dem Home Screen

## Edge Cases
- Was wenn GPS-Zugriff verweigert wird? → App funktioniert trotzdem, GPS-Features deaktiviert mit Hinweis
- Was wenn Kamera-Zugriff verweigert wird? → Nur Mediathek-Import als Fallback
- Was wenn der Offline-Speicher voll ist? → Warnung anzeigen, älteste Cache-Einträge löschen
- Was wenn die Synchronisierung fehlschlägt? → Retry-Mechanismus, manuelle Sync-Option
- Was wenn der Akku schwach ist? → Tracking-Intervall automatisch reduzieren

## Technical Requirements
- next-pwa oder Workbox für Service Worker
- IndexedDB für Offline-Queue
- Geolocation API für GPS
- MediaDevices API für PWA-Kamera
- HTML File Input mit `accept="image/*"` für Mediathek-Import
- Background Sync API für automatische Synchronisierung

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
