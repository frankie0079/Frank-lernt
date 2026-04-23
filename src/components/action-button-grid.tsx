"use client";

import { Button } from "@/components/ui/button";
import { Camera, Video, ImagePlus, NotebookPen, Route } from "lucide-react";

interface ActionButtonGridProps {
  onCamera: () => void;
  onVideo: () => void;
  onNote: () => void;
  onUpload: () => void;
  onTourTracker: () => void;
  disabled?: boolean;
}

const buttonClass =
  "flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/10 text-foreground hover:bg-primary/20 hover:border-primary/60 active:scale-[0.97] transition-all sm:h-36";

const tourButtonClass =
  "col-span-2 flex h-24 flex-row items-center justify-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/10 text-foreground hover:bg-primary/20 hover:border-primary/60 active:scale-[0.97] transition-all sm:h-28";

/**
 * 2x2 grid of large, touch-optimized action buttons for the Wanderer Screen,
 * plus a full-width Tour-Tracker button on a third row.
 */
export function ActionButtonGrid({
  onCamera,
  onVideo,
  onNote,
  onUpload,
  onTourTracker,
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
        onClick={onUpload}
        disabled={disabled}
        aria-label="Bild aus Galerie hochladen"
      >
        <ImagePlus className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
        <span className="text-xl font-semibold">Upload</span>
      </Button>

      <Button
        variant="outline"
        className={buttonClass}
        onClick={onNote}
        disabled={disabled}
        aria-label="Notiz schreiben oder aufnehmen"
      >
        <NotebookPen className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
        <span className="text-xl font-semibold">Notiz</span>
      </Button>

      <Button
        variant="outline"
        className={tourButtonClass}
        onClick={onTourTracker}
        disabled={disabled}
        aria-label="Tour-Tracker starten"
      >
        <Route className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
        <span className="text-xl font-semibold">Tour-Tracker</span>
      </Button>
    </div>
  );
}
