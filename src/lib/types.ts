import type { Tables } from "./database.types";

export type Tour = Tables<"tours"> & {
  status: "planned" | "active" | "archived";
};

export type DiaryEntry = Tables<"diary_entries">;

export type Photo = Tables<"photos">;

export type AudioNote = Tables<"audio_notes">;

/** Diary entry with related media for detail views */
export type DiaryEntryWithMedia = DiaryEntry & {
  photos: Photo[];
  audio_notes: AudioNote[];
};
