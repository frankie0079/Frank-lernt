"use client";

import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { de } from "date-fns/locale";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CoverPhotoUploader } from "@/components/cover-photo-uploader";
import { cn } from "@/lib/utils";
import type { EventData, AgendaItem } from "@/lib/event-utils";
import {
  CalendarDays,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Archive,
  MapPin,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const LocationPickerOverlay = lazy(() =>
  import("@/components/location-picker-overlay").then((m) => ({
    default: m.LocationPickerOverlay,
  }))
);

const editFormSchema = z
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
          id: z.string().optional(), // existing items have an id
          date: z.date({ error: "Datum ist erforderlich" }),
          title: z
            .string()
            .min(1, "Titel ist erforderlich")
            .max(80, "Maximal 80 Zeichen"),
          description: z.string().max(300, "Maximal 300 Zeichen").optional(),
          latitude: z.number().nullable().optional(),
          longitude: z.number().nullable().optional(),
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

type EditFormValues = z.infer<typeof editFormSchema>;

interface EventEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventData;
  agendaItems: AgendaItem[];
  onEventUpdated: () => void;
}

export function EventEditSheet({
  open,
  onOpenChange,
  event,
  agendaItems,
  onEventUpdated,
}: EventEditSheetProps) {
  const router = useRouter();
  const [coverUrl, setCoverUrl] = useState<string | null>(event.cover_url);
  const [coverPosition, setCoverPosition] = useState<string>(event.cover_position || "center");
  const [locationPickerIndex, setLocationPickerIndex] = useState<number | null>(null);
  const [coverScale, setCoverScale] = useState<number>(event.cover_scale || 1);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: event.name,
      description: event.description || "",
      start_date: new Date(event.start_date + "T00:00:00"),
      end_date: new Date(event.end_date + "T00:00:00"),
      agenda_items: agendaItems.map((item) => ({
        id: item.id,
        date: new Date(item.date + "T00:00:00"),
        title: item.title,
        description: item.description || "",
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
      })),
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "agenda_items",
    keyName: "fieldKey",
  });

  const watchStartDate = form.watch("start_date");
  const watchEndDate = form.watch("end_date");
  const watchName = form.watch("name");

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: event.name,
      description: event.description || "",
      start_date: new Date(event.start_date + "T00:00:00"),
      end_date: new Date(event.end_date + "T00:00:00"),
      agenda_items: agendaItems.map((item) => ({
        id: item.id,
        date: new Date(item.date + "T00:00:00"),
        title: item.title,
        description: item.description || "",
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
      })),
    });
    setCoverUrl(event.cover_url);
    setCoverPosition(event.cover_position || "center");
    setCoverScale(event.cover_scale || 1);
    setLocationPickerIndex(null);
    setSaveError(null);
  }, [open, event, agendaItems, form]);

  const handleSave = useCallback(
    async (values: EditFormValues) => {
      setSaving(true);
      setSaveError(null);

      try {
        const payload = {
          name: values.name,
          description: values.description || null,
          start_date: format(values.start_date, "yyyy-MM-dd"),
          end_date: format(values.end_date, "yyyy-MM-dd"),
          cover_url: coverUrl,
          cover_position: coverPosition,
          cover_scale: coverScale,
          agenda_items: values.agenda_items?.map((item, index) => ({
            id: item.id || undefined,
            date: format(item.date, "yyyy-MM-dd"),
            title: item.title,
            description: item.description || null,
            sort_order: index,
            latitude: item.latitude ?? null,
            longitude: item.longitude ?? null,
          })),
        };

        const res = await fetch(`/api/events/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Event konnte nicht aktualisiert werden.");
        }

        onEventUpdated();
        onOpenChange(false);
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        );
      } finally {
        setSaving(false);
      }
    },
    [coverUrl, coverPosition, coverScale, event.id, onEventUpdated, onOpenChange]
  );

  const handleArchive = useCallback(async () => {
    setArchiving(true);
    setSaveError(null);
    try {
      // Archive by setting end_date to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const payload = {
        name: event.name,
        description: event.description || null,
        start_date: event.start_date,
        end_date: format(yesterday, "yyyy-MM-dd"),
        cover_url: event.cover_url,
      };

      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Event konnte nicht archiviert werden.");
      }

      onEventUpdated();
      onOpenChange(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Archivieren fehlgeschlagen."
      );
    } finally {
      setArchiving(false);
    }
  }, [event, onEventUpdated, onOpenChange]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Event konnte nicht gelöscht werden.");
      }

      router.push("/events");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen."
      );
      setDeleting(false);
    }
  }, [event.id, router]);

  const handleAddAgendaItem = useCallback(() => {
    if (fields.length >= 30) return;
    const baseDate = watchStartDate || new Date();
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + fields.length);

    append({
      date: newDate,
      title: "",
      description: "",
    });
  }, [fields.length, watchStartDate, append]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="font-display text-4xl leading-none">
            Event bearbeiten
          </SheetTitle>
          <SheetDescription>
            Ändere die Details deines Events.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] px-6 pb-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSave)}
              className="space-y-4 pt-2"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event-Name *</FormLabel>
                    <FormControl>
                      <Input maxLength={100} autoComplete="off" autoFocus={false} {...field} />
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
                      <Textarea maxLength={500} rows={3} {...field} />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length || 0}/500 Zeichen
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
                                ? format(field.value, "dd.MM.yyyy", {
                                    locale: de,
                                  })
                                : "Datum"}
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
                                ? format(field.value, "dd.MM.yyyy", {
                                    locale: de,
                                  })
                                : "Datum"}
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
                currentPosition={coverPosition}
                currentScale={coverScale}
                onCoverChange={setCoverUrl}
                onPositionChange={setCoverPosition}
                onScaleChange={setCoverScale}
              />

              <Separator />

              <div>
                <h3 className="mb-3 font-display text-3xl font-bold leading-none">
                  Agenda
                </h3>
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                  Änderungen an Titel, Text, Datum, Ort und Reihenfolge bleiben mit Fotos,
                  Kuratierung, Tagebuch und Archiv verbunden. Verwendete Abschnitte können
                  nicht versehentlich gelöscht werden.
                </p>

                <div className="space-y-3">
                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine Tages-Abschnitte.
                    </p>
                  )}

                  {fields.map((field, index) => (
                    <div
                      key={field.fieldKey}
                      className="rounded-lg border border-border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Abschnitt {index + 1}
                          {form.getValues(`agenda_items.${index}.latitude`) != null && (
                            <MapPin className="ml-1 inline h-3 w-3 text-primary" />
                          )}
                        </span>
                        <div className="flex gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => move(index, index - 1)}
                            disabled={index === 0}
                            aria-label={`Abschnitt ${index + 1} nach oben verschieben`}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => move(index, index + 1)}
                            disabled={index === fields.length - 1}
                            aria-label={`Abschnitt ${index + 1} nach unten verschieben`}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => setLocationPickerIndex(index)}
                            aria-label={`Ort für Abschnitt ${index + 1} setzen`}
                          >
                            <MapPin className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => remove(index)}
                            aria-label={`Abschnitt ${index + 1} entfernen`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name={`agenda_items.${index}.date`}
                          render={({ field: dateField }) => (
                            <FormItem className="flex flex-col">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className={cn(
                                        "h-10 w-full justify-start text-left font-normal",
                                        !dateField.value &&
                                          "text-muted-foreground"
                                      )}
                                    >
                                      <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
                                      {dateField.value
                                        ? format(dateField.value, "dd.MM.yy", {
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
                                      if (
                                        watchStartDate &&
                                        date < watchStartDate
                                      )
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
                              <FormControl>
                                <Input
                                  placeholder="Titel"
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
                                {...descField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}

                  {fields.length < 30 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleAddAgendaItem}
                    >
                      <Plus className="mr-2 h-3 w-3" aria-hidden="true" />
                      Abschnitt hinzufuegen
                    </Button>
                  )}
                </div>
              </div>

              {saveError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || deleting}
                  onClick={() => onOpenChange(false)}
                >
                  Abbrechen
                </Button>
                <Button type="submit" disabled={saving || deleting}>
                  {saving && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Speichern
                </Button>
              </div>

              <Separator />

              {/* Danger Zone */}
              <div className="space-y-3 pb-6">
                <h3 className="font-display text-2xl font-bold text-destructive leading-none">
                  Gefahrenzone
                </h3>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={saving || deleting || archiving}
                    >
                      {archiving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      Event archivieren
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Event archivieren?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Das Event wird als abgeschlossen markiert. Du kannst es
                        später wieder aktivieren, indem du das Enddatum änderst.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={handleArchive}>
                        Archivieren
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      disabled={saving || deleting || archiving}
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Event löschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Event unwiderruflich löschen?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Alle Beiträge, Fotos und Kommentare werden
                        unwiderruflich gelöscht. Diese Aktion kann nicht
                        rückgängig gemacht werden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting && (
                          <Loader2
                            className="mr-2 h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        )}
                        Endgueltig löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>

      {locationPickerIndex != null && (
        <Suspense fallback={null}>
          <LocationPickerOverlay
            title={`Ort: ${form.getValues(`agenda_items.${locationPickerIndex}.title`) || `Abschnitt ${locationPickerIndex + 1}`}`}
            initialLat={form.getValues(`agenda_items.${locationPickerIndex}.latitude`)}
            initialLng={form.getValues(`agenda_items.${locationPickerIndex}.longitude`)}
            onConfirm={(lat, lng) => {
              form.setValue(`agenda_items.${locationPickerIndex}.latitude`, lat);
              form.setValue(`agenda_items.${locationPickerIndex}.longitude`, lng);
              setLocationPickerIndex(null);
            }}
            onCancel={() => setLocationPickerIndex(null)}
          />
        </Suspense>
      )}
    </Sheet>
  );
}
