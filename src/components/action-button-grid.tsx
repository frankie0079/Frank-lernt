"use client";

import { Button } from "@/components/ui/button";
import { Camera, Video, ImagePlus, MessageSquare } from "lucide-react";

interface ActionButtonGridProps {
  onCamera: () => void;
  onVideo: () => void;
  onUpload: () => void;
  onComment: () => void;
  disabled?: boolean;
}

/**
 * 2x2 grid of large, touch-optimized action buttons for the Wanderer Screen.
 */
export function ActionButtonGrid({
  onCamera,
  onVideo,
  onUpload,
  onComment,
  disabled = false,
}: ActionButtonGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Camera - take photo directly */}
      <Button
        variant="outline"
        className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 text-foreground hover:bg-primary/5 hover:border-primary/50 active:scale-[0.97] transition-all sm:h-32"
        onClick={onCamera}
        disabled={disabled}
        aria-label="Foto aufnehmen"
      >
        <Camera className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
        <span className="text-sm font-medium">Kamera</span>
      </Button>

      {/* Video - record video (PROJ-29) */}
      <Button
        variant="outline"
        className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 text-foreground hover:bg-primary/5 hover:border-primary/50 active:scale-[0.97] transition-all sm:h-32"
        onClick={onVideo}
        disabled={disabled}
        aria-label="Video aufnehmen"
      >
        <Video className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
        <span className="text-sm font-medium">Video</span>
      </Button>

      {/* Upload from gallery */}
      <Button
        variant="outline"
        className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 text-foreground hover:bg-primary/5 hover:border-primary/50 active:scale-[0.97] transition-all sm:h-32"
        onClick={onUpload}
        disabled={disabled}
        aria-label="Bild aus Galerie hochladen"
      >
        <ImagePlus className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
        <span className="text-sm font-medium">Upload</span>
      </Button>

      {/* Text comment */}
      <Button
        variant="outline"
        className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 text-foreground hover:bg-primary/5 hover:border-primary/50 active:scale-[0.97] transition-all sm:h-32"
        onClick={onComment}
        disabled={disabled}
        aria-label="Text-Kommentar schreiben"
      >
        <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
        <span className="text-sm font-medium">Kommentar</span>
      </Button>
    </div>
  );
}
