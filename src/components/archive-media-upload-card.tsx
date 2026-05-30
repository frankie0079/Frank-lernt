"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  processAndUploadImage,
  generateVideoThumbnail,
  uploadVideoToStorage,
  VIDEO_MAX_FILE_SIZE_BYTES,
} from "@/lib/content-upload";
import { checkDuplicate, computeSHA256 } from "@/lib/file-hash";
import type { AgendaItem } from "@/lib/event-utils";

interface Props {
  eventId: string;
}

export function ArchiveMediaUploadCard({ eventId }: Props) {
  const { member } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [agendaItemId, setAgendaItemId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadAgenda() {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      const items = (data?.agenda_items ?? []) as AgendaItem[];
      setAgendaItems(items);
      setAgendaItemId((current) => current || items[0]?.id || "");
    }
    void loadAgenda();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const uploadOne = useCallback(
    async (file: File, index: number, total: number) => {
      if (!member || !agendaItemId) return;

      const fileHash = await computeSHA256(file);
      if (fileHash) {
        const existing = await checkDuplicate(eventId, fileHash);
        if (existing) {
          toast.info(`${file.name} wurde bereits hochgeladen.`);
          return;
        }
      }

      const base = Math.round((index / total) * 100);
      const span = Math.max(1, Math.round(100 / total));

      if (file.type.startsWith("image/")) {
        const result = await processAndUploadImage(
          file,
          eventId,
          member.id,
          (p) => setProgress(Math.min(100, base + Math.round((p / 100) * span)))
        );

        const res = await fetch(`/api/events/${eventId}/content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "photo",
            agenda_item_id: agendaItemId,
            media_url: result.mediaUrl,
            thumbnail_url: result.thumbnailUrl,
            caption: "Nachgereicht fürs Archiv",
            latitude: result.exif.latitude,
            longitude: result.exif.longitude,
            exif_date: result.exif.exifDate,
            file_hash: fileHash,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || `${file.name} konnte nicht gespeichert werden.`);
        }
        return;
      }

      if (file.type.startsWith("video/")) {
        if (file.size > VIDEO_MAX_FILE_SIZE_BYTES) {
          throw new Error(`${file.name} ist größer als 15 MB.`);
        }
        const thumb = await generateVideoThumbnail(file);
        const uploaded = await uploadVideoToStorage(
          eventId,
          member.id,
          file,
          thumb,
          file.type || "video/mp4",
          (p) => setProgress(Math.min(100, base + Math.round((p / 100) * span)))
        );
        const res = await fetch(`/api/events/${eventId}/content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "video",
            agenda_item_id: agendaItemId,
            media_url: uploaded.mediaUrl,
            thumbnail_url: uploaded.thumbnailUrl,
            caption: "Nachgereicht fürs Archiv",
            file_hash: fileHash,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || `${file.name} konnte nicht gespeichert werden.`);
        }
        return;
      }

      throw new Error(`${file.name} ist kein unterstütztes Foto oder Video.`);
    },
    [agendaItemId, eventId, member]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const selected = Array.from(files ?? []);
      if (!selected.length || !member || !agendaItemId) return;

      setUploading(true);
      setProgress(0);
      try {
        for (let i = 0; i < selected.length; i++) {
          await uploadOne(selected[i], i, selected.length);
        }
        setProgress(100);
        toast.success("Archivmedien nachgereicht.");
        if (inputRef.current) inputRef.current.value = "";
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
      } finally {
        setUploading(false);
      }
    },
    [agendaItemId, member, uploadOne]
  );

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
          <ImagePlus className="h-5 w-5" aria-hidden="true" />
          Archivmedien nachreichen
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nur für Organisatoren: fehlende Fotos oder kurze Videos nach dem Event
          ergänzen. Die Dateien landen im gewählten Eventtag und können danach
          ins Tagebuch übernommen werden.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label>Eventtag</Label>
          <Select
            value={agendaItemId}
            onValueChange={setAgendaItemId}
            disabled={uploading || agendaItems.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tag auswählen" />
            </SelectTrigger>
            <SelectContent>
              {agendaItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {new Date(item.date + "T00:00:00").toLocaleDateString("de-DE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  - {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !agendaItemId}
          className="gap-2"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Dateien wählen
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      {uploading ? (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">
            Upload läuft... {progress} %
          </p>
        </div>
      ) : null}
    </Card>
  );
}
