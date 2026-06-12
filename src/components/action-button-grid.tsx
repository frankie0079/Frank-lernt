"use client";

import { Button } from "@/components/ui/button";
import { ImagePlus, NotebookPen } from "lucide-react";

interface ActionButtonGridProps {
  onNote: () => void;
  onUpload: () => void;
  disabled?: boolean;
}

const buttonClass =
  "flex h-32 w-full min-w-0 max-w-full flex-col items-center justify-center gap-2 overflow-hidden whitespace-normal rounded-xl border-2 border-primary/30 bg-primary/10 text-foreground transition-all hover:border-primary/60 hover:bg-primary/20 active:scale-[0.97] sm:h-36";

/**
 * Upload-first action grid for the Wanderer Screen.
 */
export function ActionButtonGrid({
  onNote,
  onUpload,
  disabled = false,
}: ActionButtonGridProps) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-3 overflow-hidden">
      <Button
        variant="outline"
        className="col-span-2 flex h-32 w-full min-w-0 max-w-full flex-col items-center justify-center gap-2 overflow-hidden whitespace-normal rounded-xl border-2 border-primary/30 bg-primary/10 text-foreground transition-all hover:border-primary/60 hover:bg-primary/20 active:scale-[0.97] sm:h-36"
        onClick={onUpload}
        disabled={disabled}
        aria-label="Fotos und Videos hochladen"
      >
        <ImagePlus className="h-11 w-11 sm:h-12 sm:w-12" aria-hidden="true" />
        <span className="block max-w-full truncate text-xl font-semibold leading-tight">
          Medien hochladen
        </span>
        <span className="block w-full min-w-0 max-w-full whitespace-normal break-words px-2 text-center font-sans text-xs font-normal leading-tight text-muted-foreground [overflow-wrap:anywhere]">
          Erst mit der Handy-Kamera aufnehmen, dann hier auswählen.
        </span>
      </Button>

      <Button
        variant="outline"
        className={buttonClass}
        onClick={onNote}
        disabled={disabled}
        aria-label="Notiz schreiben oder aufnehmen"
      >
        <NotebookPen className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
        <span className="block max-w-full truncate text-xl font-semibold leading-tight">
          Notiz
        </span>
      </Button>
    </div>
  );
}
