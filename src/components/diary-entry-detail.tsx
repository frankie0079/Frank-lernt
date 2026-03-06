"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, User, MapPin, Camera, Mic } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShareButton } from "@/components/share-button";
import type { DiaryEntryWithMedia } from "@/lib/types";

interface DiaryEntryDetailProps {
  entry: DiaryEntryWithMedia;
  tourId: string;
  tourName: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString + "T00:00:00").toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DiaryEntryDetail({ entry, tourId, tourName }: DiaryEntryDetailProps) {
  const leadPhoto = entry.photos[0];
  const remainingPhotos = entry.photos.slice(1);
  const hasGps = entry.gps_lat !== null && entry.gps_lng !== null;
  const entryUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="space-y-6 py-4">
      {/* Back to list */}
      <Link
        href={`/touren/${tourId}/tagebuch`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Alle Einträge
      </Link>

      {/* Hero Photo */}
      {leadPhoto && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
          <Image
            src={leadPhoto.full_url}
            alt={leadPhoto.caption || entry.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <h1 className="font-[family-name:var(--font-caveat)] text-2xl sm:text-3xl font-bold text-white leading-tight">
              {entry.title}
            </h1>
          </div>
        </div>
      )}

      {/* Title (if no hero photo) */}
      {!leadPhoto && (
        <h1 className="font-[family-name:var(--font-caveat)] text-2xl sm:text-3xl font-bold text-foreground">
          {entry.title}
        </h1>
      )}

      {/* Metadata + Share */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(entry.entry_date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {entry.author_name}
          </span>
          {hasGps && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              GPS
            </span>
          )}
          {entry.photos.length > 0 && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Camera className="h-3 w-3" />
              {entry.photos.length}
            </Badge>
          )}
          {entry.audio_notes.length > 0 && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Mic className="h-3 w-3" />
              {entry.audio_notes.length}
            </Badge>
          )}
        </div>
        <ShareButton
          title={`${entry.title} — ${tourName}`}
          text={`Tagebucheintrag von ${entry.author_name}`}
          url={entryUrl}
          variant="button"
        />
      </div>

      {/* Content */}
      {entry.content && (
        <div className="prose prose-sm max-w-none">
          <p className="text-foreground whitespace-pre-line leading-relaxed break-words">
            {entry.content}
          </p>
        </div>
      )}

      {/* Photo Strip */}
      {remainingPhotos.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Fotos</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {remainingPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative shrink-0 w-40 h-40 rounded-lg overflow-hidden snap-start"
              >
                <Image
                  src={photo.thumbnail_url || photo.full_url}
                  alt={photo.caption || "Foto"}
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audio Notes (placeholder for Phase 2) */}
      {entry.audio_notes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Sprach-Notizen</h2>
          {entry.audio_notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <Mic className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{note.author_name}</p>
                  {note.duration_seconds && (
                    <p className="text-xs text-muted-foreground">
                      {Math.floor(note.duration_seconds / 60)}:{String(note.duration_seconds % 60).padStart(2, "0")}
                    </p>
                  )}
                </div>
                <audio controls preload="none" className="h-8 max-w-[200px]">
                  <source src={note.audio_url} type="audio/webm" />
                </audio>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mini Map (placeholder — will use Leaflet in Phase 6) */}
      {hasGps && (
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Aufgenommen bei</p>
              <p className="text-xs text-muted-foreground">
                {entry.gps_lat!.toFixed(4)}, {entry.gps_lng!.toFixed(4)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
