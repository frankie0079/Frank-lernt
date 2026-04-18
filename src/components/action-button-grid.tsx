"use client";

import { Button } from "@/components/ui/button";
import { Camera, Video, ImagePlus, MessageSquare, Mic } from "lucide-react";

interface ActionButtonGridProps {
  onCamera: () => void;
  onVideo: () => void;
  onAudio: () => void;
  onUpload: () => void;
  onComment: () => void;
  disabled?: boolean;
}

const buttonClass =
  "flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/10 text-foreground hover:bg-primary/20 hover:border-primary/60 active:scale-[0.97] transition-all sm:h-36";

/**
 * 2x3 grid of large, touch-optimized action buttons for the Wanderer Screen.
 */
export function ActionButtonGrid({
  onCamera,
  onVideo,
  onAudio,
  onUpload,
  onComment,
  disabled = false,
}: ActionButtonGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        variant="outline"
        className={buttonClass}
        onClick={onCamera}
        disabled={disabled}
        aria-label="Foto aufnehmen"
      >
        <Camera className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
        <span className="text-xl font-semibold">Kamera</span>
      </Button>

      <Button
        variant="outline"
        className={buttonClass}
        onClick={onVideo}
        disabled={disabled}
        aria-label="Video aufnehmen"
      >
        <Video className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
        <span className="text-xl font-semibold">Video</span>
      </Button>

      <Button
        variant="outline"
        className={buttonClass}
        onClick={onAudio}
        disabled={disabled}
        aria-label="Sprachmemo aufnehmen"
      >
        <Mic className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
        <span className="text-xl font-semibold">Sprachmemo</span>
      </Button>

      <Button
        variant="outline"
        className={buttonClass}
        onClick={onUpload}
        disabled={disabled}
        aria-label="Bild aus Galerie hochladen"
      >
        <ImagePlus className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
        <span className="text-xl font-semibold">Upload</span>
      </Button>

      <Button
        variant="outline"
        className={`${buttonClass} col-span-2`}
        onClick={onComment}
        disabled={disabled}
        aria-label="Text-Kommentar schreiben"
      >
        <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
        <span className="text-xl font-semibold">Kommentar</span>
      </Button>
    </div>
  );
}
