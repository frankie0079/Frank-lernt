import { z } from "zod";

// --- Event Schema ---

export const eventSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name ist erforderlich")
      .max(100, "Maximal 100 Zeichen"),
    description: z
      .string()
      .max(500, "Maximal 500 Zeichen")
      .optional()
      .or(z.literal("")),
    start_date: z.string().min(1, "Startdatum ist erforderlich"),
    end_date: z.string().min(1, "Enddatum ist erforderlich"),
  })
  .refine(
    (data) => {
      if (!data.start_date || !data.end_date) return true;
      return data.end_date >= data.start_date;
    },
    {
      message: "Enddatum muss nach Startdatum liegen",
      path: ["end_date"],
    }
  );

export type EventFormValues = z.infer<typeof eventSchema>;

// --- Agenda Item Schema ---

export const agendaItemSchema = z.object({
  date: z.string().min(1, "Datum ist erforderlich"),
  title: z
    .string()
    .min(1, "Titel ist erforderlich")
    .max(80, "Maximal 80 Zeichen"),
  description: z
    .string()
    .max(300, "Maximal 300 Zeichen")
    .optional()
    .or(z.literal("")),
  sort_order: z.number().int().min(0).optional(),
});

export type AgendaItemFormValues = z.infer<typeof agendaItemSchema>;

export const agendaListSchema = z
  .array(agendaItemSchema)
  .max(30, "Maximal 30 Tages-Abschnitte");

// --- Full Event Create Payload ---

export const eventCreateSchema = eventSchema.and(
  z.object({
    cover_url: z
      .string()
      .url()
      .refine(
        (url) => {
          // Accept any supabase.co storage URL (covers + media buckets)
          return url.includes("supabase.co");
        },
        { message: "Cover-URL muss vom Supabase Storage stammen" }
      )
      .nullable()
      .optional(),
    agenda_items: agendaListSchema.optional(),
  })
);

export type EventCreatePayload = z.infer<typeof eventCreateSchema>;

// --- Cover Photo Constants ---

export const COVER_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const COVER_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const COVER_MAX_DIMENSION = 1920; // px
export const COVER_MAX_COMPRESSED_SIZE_KB = 500; // KB
