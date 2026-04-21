// PROJ-34: Prompt builder for the storyboard LLM call (Claude Haiku 4.5).
//
// Inputs are wrapped in <user_content> tags so the LLM cannot interpret
// caption/comment text as instructions. We instruct it to quote ONLY from
// the provided material — never invent.

import {
  SLIDESHOW_MAX_DURATION_MS,
  SLIDESHOW_MIN_SCENE_MS,
  SLIDESHOW_MAX_SCENE_MS,
  type StoryboardInput,
} from "./storyboard-types";

export function buildStoryboardSystemPrompt(): string {
  return [
    "Du bist Filmemacher und Cutter für eine private Event-Dokumentations-Plattform.",
    "Deine Aufgabe: Aus den kuratierten Beiträgen eines Tages (Fotos, Videos, Texte, Sprachnotizen,",
    "Kommentare) ein STORYBOARD für einen 60-Sekunden-Film zu erstellen.",
    "Der Renderer setzt automatisch ein festes 6-s-Intro mit dem Event-Cover davor und ein 3,5-s-",
    "Outro (\"Ende\") danach. Dein Storyboard liefert also NUR die Szenen dazwischen.",
    "",
    "Harte Regeln:",
    `- Gesamtdauer aller Szenen: Ziel ca. 50 s, maximal ${SLIDESHOW_MAX_DURATION_MS} ms.`,
    `- Jede Szene zwischen ${SLIDESHOW_MIN_SCENE_MS} und ${SLIDESHOW_MAX_SCENE_MS} ms.`,
    "- Jedes content_item aus <user_content> vom Typ photo oder video MUSS in genau einer Szene",
    "  verwendet werden (als Szenentyp photo oder video mit passender content_item_id).",
    "  Kuratiert = muss in den Film. Niemals Fotos oder Videos weglassen.",
    "- Ziel-Dauer pro Szene: 4-5 s. Bei vielen Items darfst du auf 1,5 s runter, bei wenigen bis 6 s hoch.",
    `- Wichtig: Wenn du mehr Fotos hast, als bei 4 s Szenen ins Budget (${SLIDESHOW_MAX_DURATION_MS} ms) passen, reduziere die Szenendauer proportional — lasse NIEMALS Fotos weg.`,
    "- Du erfindest NICHTS. Alle Zitate, Namen, Orte stammen woertlich aus dem User-Input.",
    "- Erste Szene ist IMMER vom Typ cover (mit chapter_id=intro, content_item_id=null).",
    "  Die cover-Szene ist zusaetzlich zu den Foto/Video-Szenen.",
    "- 1 bis 4 Kapitel mit kurzen, praegnanten Titeln (max. 40 Zeichen).",
    "- overlay_text ist sehr kurz (max. 80 Zeichen): entweder ein Zitat in Anfuehrungszeichen",
    "  mit Autor, oder ein Kapitel- oder Uebergangstitel. Bei Fotos ohne besonderen Kommentar: leer lassen.",
    "- Text- und Audio-Items aus <user_content> darfst du als Zitate in overlay_text anderer Szenen",
    "  verarbeiten; sie brauchen keine eigene Szene.",
    "- Wechsle effects ab, damit es lebendig wirkt (kenburns-* statt static, wenn moeglich).",
    "- Waehle music_track_id passend zur Stimmung (siehe verfuegbare Tracks).",
    "",
    "Antworte AUSSCHLIESSLICH mit gültigem JSON nach diesem Schema:",
    JSON.stringify(
      {
        title: "string (1-120)",
        mood: "epic|chill|joyful|reflective",
        music_track_id: "string|null",
        chapters: [{ id: "string", title: "string" }],
        scenes: [
          {
            type: "cover|photo|video|text-card|chapter-title",
            content_item_id: "uuid|null",
            chapter_id: "string",
            duration_ms: "number",
            overlay_text: "string",
            effect: "kenburns-zoom-in|kenburns-zoom-out|kenburns-pan-left|kenburns-pan-right|static",
            color_grade: "warm|cool|neutral",
          },
        ],
      },
      null,
      2
    ),
    "",
    "KEIN Markdown, KEINE Erklärungen, KEINE Code-Fences. NUR das JSON-Objekt.",
  ].join("\n");
}

export function buildStoryboardUserPrompt(input: StoryboardInput, availableTrackIds: string[]): string {
  const { event, agenda_item, items } = input;

  const itemsBlock = items
    .map((it, idx) => {
      const lines: string[] = [
        `[item ${idx + 1}] (id=${it.content_item_id})`,
        `  type: ${it.type}`,
        `  author: ${it.author_name ?? "anonym"}`,
        `  created: ${it.created_at}`,
      ];
      if (it.caption) lines.push(`  caption: ${it.caption.slice(0, 600)}`);
      if (it.comments.length > 0) {
        lines.push(`  comments:`);
        for (const c of it.comments.slice(0, 5)) {
          lines.push(`    - ${c.author ?? "anonym"}: ${c.text.slice(0, 120)}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return [
    `<event>`,
    `  name: ${event.name}`,
    event.description ? `  description: ${event.description}` : "",
    `</event>`,
    "",
    `<agenda_item>`,
    `  title: ${agenda_item.title}`,
    `  date: ${agenda_item.date}`,
    `</agenda_item>`,
    "",
    `<available_music_tracks>`,
    availableTrackIds.map((id) => `  - ${id}`).join("\n"),
    `</available_music_tracks>`,
    "",
    `<user_content>`,
    itemsBlock,
    `</user_content>`,
    "",
    "Erstelle das Storyboard als JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}
