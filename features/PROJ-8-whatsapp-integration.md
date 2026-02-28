# PROJ-8: WhatsApp-Integration — Tages-Summary für Friends & Family

## Status: Planned
**Created:** 2026-02-28
**Last Updated:** 2026-02-28

## Dependencies
- Requires: PROJ-3 (Reisetagebuch) — Summary wird als Tagebuchseite archiviert
- Requires: PROJ-4 (Fotogalerie) — Fotos als Content-Quelle
- Requires: PROJ-6 (Interaktive Karte) — Kartenausschnitt / Routenanimation
- Requires: PROJ-7 (Tages-Statistiken) — Facts & Figures

## Konzept

WhatsApp ist der **primäre Kanal für Follower** (Friends & Family). Tagsüber sammeln alle Wanderer Content über die PWA. Am Abend wird aus den gesammelten Inhalten eine kreative Tages-Summary erstellt und per WhatsApp gepostet.

**Kein Zwischenposting** — nur eine tägliche Summary.

**Doppelte Verwendung:** Jede Tages-Summary wird automatisch als neue Seite im digitalen Reisetagebuch auf der Landing Page archiviert (siehe PROJ-3).

## Content-Box (Medienbibliothek)

Eine jederzeit erweiterbare Bibliothek mit kreativen Assets für die Summary-Generierung:

**Musik:**
- Landestypische Musik passend zur Tour-Region (z.B. portugiesische Volksmusik / Fado für Rota Vicentina)
- 3-5+ lizenzfreie Tracks
- Bei jeder neuen Tour wird die Musik an das Reiseland angepasst
- Wanderer wählt den Track für die Tages-Summary

**Bilder & Hintergründe:**
- Webbilder der Tour-Region (Rota Vicentina, Fischerpfad, Atlantikküste)
- Hintergründe/Texturen (Landkarten-Optik, Papier, Natur)
- Stimmungsbilder als Zwischenbilder in der Diashow

**Grafische Elemente:**
- Wandervögel-Logo (Logo_Wandervoegel.JPG)
- Rahmen, Trennlinien, Icons (Wanderschuh, Kompass, Höhenmeter)
- Intro/Outro-Templates mit Branding

**Erweiterbar:** Content-Box kann jederzeit ergänzt werden — vor und während der Tour.

## User Flow (Abend-Workflow)

```
1. Wanderer öffnet "Tages-Summary" in der PWA
2. Alle gesammelten Inhalte des Tages werden angezeigt
   (Fotos, Kommentare, Statistiken, Kartenroute — von allen Wanderern)
3. Jeder Inhalt hat einen einfachen Toggle: ✓ auswählen / ✗ abwählen
4. Wanderer wählt einen Musik-Track aus der Content-Box
5. Tap auf "Summary erstellen"
6. Generator baut kreative Summary:
   - Intro mit Logo + Etappenname
   - Karten-Animation der Route
   - Ausgewählte Fotos mit Übergängen
   - Webbilder/Hintergründe aus Content-Box als Zwischenbilder
   - Kommentare als stylische Text-Overlays
   - Facts & Figures als Grafik
   - Outro mit Branding + Rück-Link
   - Gewählter Musik-Track als Hintergrundmusik
7. Vorschau der fertigen Summary
8. Ein Tap → per WhatsApp an Friends & Family senden
9. Summary wird automatisch als neue Seite im Reisetagebuch archiviert
```

## Summary-Formate (automatisch gewählt nach Content-Menge)

- **Video/Diashow (5+ Fotos):** Musik + Intro → Karten-Animation → Foto-Slideshow mit Übergängen + Webbilder als Zwischenbilder → Kommentare → Facts & Figures → Outro mit Rück-Link (30-60 Sek.)
- **Bild-Collage (2-4 Fotos):** Collage der Fotos + Statistiken + Etappenname + Rück-Link
- **Einzelbild-Postkarte (1 Foto):** Foto + Karten-Overlay + Statistiken + Rück-Link

## User Stories
- Als Wanderer möchte ich am Abend alle gesammelten Inhalte des Tages sehen und per Tap auswählen, welche in die Summary kommen.
- Als Wanderer möchte ich einen passenden landestypischen Musik-Track für die Tages-Summary wählen.
- Als Wanderer möchte ich, dass der Generator kreativ eine professionell wirkende Summary baut — mit Musik, Übergängen, Webbildern und Branding.
- Als Wanderer möchte ich die Content-Box jederzeit mit neuen Assets befüllen (Musik, Bilder, Hintergründe).
- Als Wanderer möchte ich die fertige Summary ansehen und mit einem Tap per WhatsApp versenden.
- Als Follower möchte ich jeden Abend eine schöne, kreative Zusammenfassung des Wandertages per WhatsApp erhalten.
- Als Follower möchte ich über einen Rück-Link in der Summary zur Plattform gelangen können.

## Acceptance Criteria
- [ ] Content-Box: Medienbibliothek für Musik, Webbilder, Hintergründe, grafische Elemente
- [ ] Content-Box ist jederzeit erweiterbar (Upload von Musik, Bildern, etc.)
- [ ] Musik-Tracks sind landestypisch (z.B. portugiesische Volksmusik/Fado für Rota Vicentina)
- [ ] Tages-Übersicht zeigt alle gesammelten Inhalte aller Wanderer des Tages
- [ ] Jeder Inhalt hat einen einfachen Auswahl-Toggle
- [ ] Musik-Track-Auswahl aus der Content-Box (min. 3 Optionen)
- [ ] "Summary erstellen"-Button generiert kreative Zusammenfassung
- [ ] Summary nutzt Content-Box-Assets (Webbilder, Hintergründe, Logo, Rahmen)
- [ ] Musik ist als Hintergrund im Video hörbar (Fade-in/out)
- [ ] Format wird automatisch gewählt: Video (5+ Fotos), Collage (2-4), Postkarte (1)
- [ ] Vorschau der fertigen Summary vor dem Versenden
- [ ] Video ist WhatsApp-kompatibel (MP4, max. 16MB, 30-60 Sekunden)
- [ ] Ein Tap sendet die Summary per WhatsApp (Web Share API)
- [ ] Summary enthält Rück-Link zur Plattform
- [ ] Gesendete Summary wird automatisch als neue Seite im Reisetagebuch archiviert

## Edge Cases
- Was wenn kein Content vorhanden ist? → "Heute noch nichts gesammelt" — keine Summary möglich
- Was wenn nichts ausgewählt wird? → "Summary erstellen"-Button bleibt deaktiviert
- Was wenn keine Musik gewählt wird? → Standard-Track als Default
- Was wenn die Content-Box leer ist (keine Webbilder)? → Summary nur mit Tages-Fotos
- Was wenn das Video zu gross wird (> 16MB)? → Qualität/Länge automatisch reduzieren
- Was wenn WhatsApp nicht installiert ist? → Video/Bild in Zwischenablage kopieren
- Was wenn die Generierung fehlschlägt? → Fallback auf einfachere Variante (Collage statt Video)
- Was wenn kein Internet? → Summary lokal vorbereiten, bei Verbindung senden

## Technical Requirements
- Video-Generierung: Server-seitig (Supabase Edge Function + Remotion/FFmpeg) oder Client-seitig (Canvas API + MediaRecorder)
- Audio-Mixing: Musik + optionale Übergangssounds
- Supabase Storage für Content-Box-Assets und archivierte Summaries
- Web Share API für WhatsApp-Versand (mit Video/Bild-Datei)
- Open Graph Meta-Tags für Rück-Link-Vorschau in WhatsApp
- Touch-optimierte Auswahl-UI

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
