import {
  SLIDESHOW_MAX_DURATION_MS,
  SLIDESHOW_MIN_SCENE_MS,
  SLIDESHOW_MAX_SCENE_MS,
  SLIDESHOW_MAX_MEDIA_ITEMS,
  type StoryboardInput,
} from "./storyboard-types";

export function buildStoryboardSystemPrompt(): string {
  return [
    "Du bist Cutter fuer eine private Event-Dokumentations-Plattform.",
    "Erstelle aus den kuratierten Fotos und Videos ein ruhiges Storyboard.",
    "Start- und Schlussseite werden separat im Editor gepflegt.",
    "",
    "Harte Regeln:",
    `- Maximal ${SLIDESHOW_MAX_MEDIA_ITEMS} Foto-/Video-Szenen.`,
    `- Gesamtdauer der Medienszenen maximal ${SLIDESHOW_MAX_DURATION_MS} ms.`,
    `- Jede Szene zwischen ${SLIDESHOW_MIN_SCENE_MS} und ${SLIDESHOW_MAX_SCENE_MS} ms.`,
    "- Jedes kuratierte Foto oder Video muss genau einmal verwendet werden.",
    "- Erzeuge ausschliesslich photo- und video-Szenen.",
    "- Erzeuge keine cover-, text-card-, chapter-title-, Intro- oder Schluss-Szene.",
    "- Verwende genau ein technisches Kapitel mit id \"film\" und title \"Film\".",
    "- overlay_text ist optional und enthaelt nur einen kurzen vorhandenen Kommentar.",
    "- Text- und Audio-Items erzeugen niemals eigene Szenen.",
    "- Erfinde keine Texte, Namen oder Orte.",
    "- Waehle music_track_id passend zur Stimmung.",
    "",
    "Antworte ausschliesslich mit gueltigem JSON nach diesem Schema:",
    JSON.stringify(
      {
        title: "string (1-120)",
        film_style: "postcard",
        mood: "epic|chill|joyful|reflective",
        music_track_id: "string|null",
        chapters: [{ id: "film", title: "Film" }],
        intro: { content_item_id: null, text: "string" },
        outro: { content_item_id: null, text: "string" },
        scenes: [
          {
            type: "photo|video",
            content_item_id: "uuid",
            chapter_id: "film",
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
    "Kein Markdown, keine Erklaerungen, nur das JSON-Objekt.",
  ].join("\n");
}

export function buildStoryboardUserPrompt(input: StoryboardInput, availableTrackIds: string[]): string {
  const { event, agenda_item, items } = input;
  const itemsBlock = items
    .map((it, idx) => {
      const lines = [
        `[item ${idx + 1}] (id=${it.content_item_id})`,
        `  type: ${it.type}`,
        `  author: ${it.author_name ?? "anonym"}`,
      ];
      if (it.caption) lines.push(`  caption: ${it.caption.slice(0, 600)}`);
      for (const comment of it.comments.slice(0, 5)) {
        lines.push(`  comment: ${comment.author ?? "anonym"}: ${comment.text.slice(0, 120)}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return [
    `<event>`,
    `name: ${event.name}`,
    `</event>`,
    `<agenda_item>`,
    `title: ${agenda_item.title}`,
    `date: ${agenda_item.date}`,
    `</agenda_item>`,
    `<available_music_tracks>`,
    availableTrackIds.join(", "),
    `</available_music_tracks>`,
    `<user_content>`,
    itemsBlock,
    `</user_content>`,
    "Erstelle das Storyboard als JSON.",
  ].join("\n");
}
