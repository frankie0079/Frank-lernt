import type { Tables } from "./database.types";

export type Tour = Tables<"tours"> & {
  status: "planned" | "active" | "archived";
};

export type DiaryEntry = Tables<"diary_entries">;

export type Photo = Tables<"photos">;
