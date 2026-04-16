"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, Check, Loader2, AlertCircle } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error" | "offline-pending";

interface CurationToolbarProps {
  selectedCount: number;
  totalCount: number;
  saveState: SaveState;
  status: "draft" | "published" | "empty";
  onTogglePublish: (publish: boolean) => void;
  onOpenPreview: () => void;
  disabled?: boolean;
}

export function CurationToolbar({
  selectedCount,
  totalCount,
  saveState,
  status,
  onTogglePublish,
  onOpenPreview,
  disabled,
}: CurationToolbarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isPublished = status === "published";
  const canPublish = selectedCount > 0 && !disabled;

  const handleSwitch = (checked: boolean) => {
    if (checked) {
      if (!canPublish) return;
      setConfirmOpen(true);
    } else {
      onTogglePublish(false);
    }
  };

  return (
    <div className="sticky top-[env(safe-area-inset-top)] z-30 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} von {totalCount} ausgewählt
          </span>
          <SaveIndicator state={saveState} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenPreview}
            disabled={selectedCount === 0}
            aria-label="Vorschau öffnen"
            className="h-10"
          >
            <Eye className="h-4 w-4 sm:mr-1" aria-hidden="true" />
            <span className="hidden sm:inline">Vorschau</span>
          </Button>

          <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
            <Switch
              id="publish-toggle"
              checked={isPublished}
              onCheckedChange={handleSwitch}
              disabled={!isPublished && !canPublish}
              aria-label="Bericht veröffentlichen"
            />
            <Label
              htmlFor="publish-toggle"
              className="cursor-pointer text-xs font-medium"
            >
              {isPublished ? "Veröffentlicht" : "Entwurf"}
            </Label>
            {isPublished && (
              <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                Live
              </Badge>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bericht veröffentlichen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Bericht wird auf der öffentlichen Event-Seite sichtbar. Du
              kannst ihn später wieder auf Entwurf zurücksetzen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                onTogglePublish(true);
              }}
            >
              Veröffentlichen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") {
    return (
      <span className="text-xs text-muted-foreground">Bereit</span>
    );
  }
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Speichere…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check className="h-3 w-3" aria-hidden="true" />
        Gespeichert
      </span>
    );
  }
  if (state === "offline-pending") {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Offline — Änderungen lokal gespeichert
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="h-3 w-3" aria-hidden="true" />
      Fehler beim Speichern
    </span>
  );
}
