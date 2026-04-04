"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { de } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CoverPhotoUploader } from "@/components/cover-photo-uploader";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

// Combined form schema: event basics + agenda items
const formSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name ist erforderlich")
      .max(100, "Maximal 100 Zeichen"),
    description: z.string().max(500, "Maximal 500 Zeichen").optional(),
    start_date: z.date({ error: "Startdatum ist erforderlich" }),
    end_date: z.date({ error: "Enddatum ist erforderlich" }),
    agenda_items: z
      .array(
        z.object({
          date: z.date({ error: "Datum ist erforderlich" }),
          title: z
            .string()
            .min(1, "Titel ist erforderlich")
            .max(80, "Maximal 80 Zeichen"),
          description: z.string().max(300, "Maximal 300 Zeichen").optional(),
        })
      )
      .max(30, "Maximal 30 Tages-Abschnitte")
      .optional(),
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

type FormValues = z.infer<typeof formSchema>;

export function EventCreateForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      agenda_items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "agenda_items",
  });

  const watchName = form.watch("name");
  const watchStartDate = form.watch("start_date");
  const watchEndDate = form.watch("end_date");

  // Validate step 1 fields before moving to step 2
  const handleNextStep = useCallback(async () => {
    const valid = await form.trigger(["name", "start_date", "end_date", "description"]);
    if (valid) {
      setStep(2);
    }
  }, [form]);

  const handleAddAgendaItem = useCallback(() => {
    if (fields.length >= 30) return;

    // Default date: start_date + number of existing items
    const baseDate = watchStartDate || new Date();
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + fields.length);

    append({
      date: newDate,
      title: "",
      description: "",
    });
  }, [fields.length, watchStartDate, append]);

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      setSubmitError(null);

      try {
        const payload = {
          name: values.name,
          description: values.description || null,
          start_date: format(values.start_date, "yyyy-MM-dd"),
          end_date: format(values.end_date, "yyyy-MM-dd"),
          cover_url: coverUrl,
          agenda_items: values.agenda_items?.map((item, index) => ({
            date: format(item.date, "yyyy-MM-dd"),
            title: item.title,
            description: item.description || null,
            sort_order: index,
          })),
        };

        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Event konnte nicht erstellt werden.");
        }

        const data = await res.json();
        router.push(`/events/${data.event.id}`);
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [coverUrl, router]
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
              step === 1
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            1
          </span>
          <span className={step === 1 ? "font-medium text-foreground" : ""}>
            Basis-Infos
          </span>
          <Separator className="w-8" />
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
              step === 2
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            2
          </span>
          <span className={step === 2 ? "font-medium text-foreground" : ""}>
            Agenda
          </span>
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event-Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. Wanderung Alpen 2026"
                      maxLength={100}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length || 0}/100 Zeichen
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Worum geht es bei diesem Event?"
                      maxLength={500}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length || 0}/500 Zeichen (optional)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Startdatum *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
                            {field.value
                              ? format(field.value, "dd.MM.yyyy", { locale: de })
                              : "Datum waehlen"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={de}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Enddatum *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
                            {field.value
                              ? format(field.value, "dd.MM.yyyy", { locale: de })
                              : "Datum waehlen"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            watchStartDate ? date < watchStartDate : false
                          }
                          locale={de}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <CoverPhotoUploader
              eventName={watchName}
              currentCoverUrl={coverUrl}
              onCoverChange={setCoverUrl}
            />

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={handleNextStep}>
                Weiter zur Agenda
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Agenda */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-4">
              {fields.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Noch keine Tages-Abschnitte. Du kannst das Event auch ohne
                    Agenda erstellen.
                  </p>
                </div>
              )}

              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Abschnitt {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                      aria-label={`Abschnitt ${index + 1} entfernen`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name={`agenda_items.${index}.date`}
                      render={({ field: dateField }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs">Datum *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !dateField.value &&
                                      "text-muted-foreground"
                                  )}
                                >
                                  <CalendarDays className="mr-1 h-3 w-3" aria-hidden="true" />
                                  {dateField.value
                                    ? format(dateField.value, "dd.MM.yyyy", {
                                        locale: de,
                                      })
                                    : "Datum"}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={dateField.value}
                                onSelect={dateField.onChange}
                                disabled={(date) => {
                                  if (watchStartDate && date < watchStartDate)
                                    return true;
                                  if (watchEndDate && date > watchEndDate)
                                    return true;
                                  return false;
                                }}
                                locale={de}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`agenda_items.${index}.title`}
                      render={({ field: titleField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Titel *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="z.B. Anreisetag"
                              maxLength={80}
                              {...titleField}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`agenda_items.${index}.description`}
                    render={({ field: descField }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Beschreibung (optional)"
                            maxLength={300}
                            rows={2}
                            className="text-sm"
                            {...descField}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>

            {fields.length < 30 && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleAddAgendaItem}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Tages-Abschnitt hinzufuegen
              </Button>
            )}

            {fields.length >= 30 && (
              <p className="text-sm text-muted-foreground text-center">
                Maximal 30 Tages-Abschnitte erreicht.
              </p>
            )}

            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Zurueck
              </Button>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Event erstellen
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </Form>
  );
}
