# PROJ-43: Die Wandervögel Event-Archiv

## Status

In Progress

## Ziel

Die Wandervögel erhalten ein langfristiges Event-Archiv. Die mobile App bleibt
Generator, Uploader und Kuratierwerkzeug während des Events. Das Archiv ist die
dauerhafte Web-Ausgabe nach dem Event.

## Produktentscheidungen

- Die Slideshow ist nur Tageskommunikation für Familie/Freunde und wird nicht
  dauerhaft archiviert.
- Archiv-relevant ist die Auswahl, die im Tagebuch/Archiv pro Tag landet.
- Keine doppelte Selektion am Eventende.
- Die finale Seitengestaltung kann später in einem Desktop-Archivstudio
  entstehen. Canvas/Layout-Studio ist vorbereitet, aber nicht Teil dieser
  ersten Version.
- Nach dem Event darf nur der Organisator Medien ins Archiv nachreichen.
- Es gibt ein gemeinsames Wandervögel-Archiv für Community-Events.
- Private Events haben einen separaten privaten Link und erscheinen nicht im
  Community-Archiv.

## Sichtbarkeit

- `draft`: nicht im Archiv sichtbar.
- `community`: sichtbar über den gemeinsamen Wandervögel-Archivlink.
- `private`: sichtbar nur über den privaten Event-Archivlink.

Beispiele:

- Hong Kong April 2026 = privates Event.
- Rota = Community-/Wandervögel-Event.

## Acceptance Criteria

- Organizer können pro Event die Archiv-Sichtbarkeit setzen.
- Organizer sehen den Community-Archivlink und den privaten Link.
- Community-Archivlink zeigt alle veröffentlichten Community-Events als
  Event-Kacheln.
- Klick auf eine Community-Kachel öffnet das Archiv-Tagebuch des Events.
- Private Events sind nicht in der Community-Übersicht sichtbar.
- Privater Link öffnet direkt das private Archiv-Tagebuch.
- Archiv-Tagebuch nutzt die bestehenden Tagebuchdaten, aber ohne mobile
  Editor-Navigation.
- Normale Archivbesucher benötigen keinen Event-spezifischen Member-Zugang.
- Build, TypeScript und Lint laufen ohne Fehler.
- Keine kaputten Umlaute/Mojibake und keine horizontale Scrollbar auf Mobile.

## Nicht in dieser Version

- Canvas/Layout-Studio.
- Umzug der Originaldateien in externen Object Storage.
- ZIP-Download des gesamten Events.
- Automatisches Leeren von Supabase Storage.

Diese Punkte werden separat geplant, nachdem das Archiv-Grundmodell steht.
