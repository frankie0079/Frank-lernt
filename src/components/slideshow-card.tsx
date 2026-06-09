"use client";

// PROJ-34: Single published-slideshow card for the event-wide feed.

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Film, Download, Share2 } from "lucide-react";

export interface PublishedSlideshow {
  agenda_item_id: string;
  agenda_title: string;
  agenda_date: string;
  report_id: string;
  slideshow_url: string;
  published_at: string;
  duration_sec: number | null;
  title: string;
  poster_url: string | null;
}

interface Props {
  slideshow: PublishedSlideshow;
}

export function SlideshowCard({ slideshow }: Props) {
  const [sharing, setSharing] = useState(false);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = slideshow.slideshow_url;
    a.download = `${slideshow.title}.webm`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [slideshow]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      // Fetch as blob for File-based share (works with Instagram/WhatsApp on iOS+Android)
      const res = await fetch(slideshow.slideshow_url);
      const blob = await res.blob();
      const file = new File([blob], `${slideshow.title}.webm`, { type: blob.type || "video/webm" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: slideshow.title,
          text: `Tagesfilm: ${slideshow.agenda_title}`,
        });
      } else if (navigator.share) {
        await navigator.share({
          title: slideshow.title,
          url: slideshow.slideshow_url,
        });
      } else {
        toast.error("Teilen wird vom Browser nicht unterstützt.");
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Teilen fehlgeschlagen");
      }
    } finally {
      setSharing(false);
    }
  }, [slideshow]);

  const date = new Date(slideshow.agenda_date + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[9/16] max-h-[480px] bg-black">
        <video
          src={slideshow.slideshow_url}
          controls
          playsInline
          preload="metadata"
          poster={slideshow.poster_url ?? undefined}
          className="h-full w-full object-contain"
        />
      </div>
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">{slideshow.title}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {date}
            {slideshow.duration_sec ? ` · ${slideshow.duration_sec}s` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownload} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Herunterladen
          </Button>
          <Button onClick={handleShare} variant="outline" size="sm" disabled={sharing}>
            <Share2 className="mr-2 h-4 w-4" />
            Teilen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
