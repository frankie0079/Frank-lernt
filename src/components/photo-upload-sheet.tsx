"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, ImageIcon, Loader2, X, Upload } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Photo } from "@/lib/types";
import { compressAndUploadPhoto } from "@/lib/photo-upload";

interface PhotoUploadSheetProps {
  tourId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (photos: Photo[]) => void;
}

interface PendingFile {
  file: File;
  preview: string;
}

export function PhotoUploadSheet({
  tourId,
  isOpen,
  onOpenChange,
  onUploaded,
}: PhotoUploadSheetProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [caption, setCaption] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    // Revoke preview URLs
    pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setPendingFiles([]);
    setCaption("");
    setAuthorName("");
    setError(null);
    setUploadProgress(0);
  }

  function handleOpenChange(open: boolean) {
    if (!open) resetForm();
    onOpenChange(open);
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    setError(null);

    const newPending: PendingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError(`"${file.name}" ist kein Bild.`);
        continue;
      }

      // Validate file size (20MB max)
      if (file.size > 20 * 1024 * 1024) {
        setError(`"${file.name}" ist zu gross (max. 20 MB).`);
        continue;
      }

      newPending.push({
        file,
        preview: URL.createObjectURL(file),
      });
    }

    setPendingFiles((prev) => [...prev, ...newPending]);
  }

  function removePending(index: number) {
    setPendingFiles((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const uploadedPhotos: Photo[] = [];
    const total = pendingFiles.length;

    try {
      for (let i = 0; i < total; i++) {
        const pending = pendingFiles[i];
        const photo = await compressAndUploadPhoto({
          file: pending.file,
          tourId,
          caption: caption.trim() || null,
          authorName: authorName.trim() || "Anonym",
        });
        uploadedPhotos.push(photo);
        setUploadProgress(Math.round(((i + 1) / total) * 100));
      }

      onUploaded(uploadedPhotos);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Hochladen.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Fotos hochladen</SheetTitle>
          <SheetDescription>
            Nimm ein Foto auf oder wähle aus deiner Mediathek.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-4 px-1">
          {/* Camera + File picker buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2 h-12"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading}
            >
              <Camera className="h-5 w-5" />
              Kamera
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 h-12"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <ImageIcon className="h-5 w-5" />
              Mediathek
            </Button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {/* Preview grid */}
          {pendingFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {pendingFiles.map((pending, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={pending.preview}
                    alt={`Vorschau ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="33vw"
                  />
                  <button
                    onClick={() => removePending(index)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors"
                    aria-label={`Foto ${index + 1} entfernen`}
                    disabled={isUploading}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Caption + Author */}
          {pendingFiles.length > 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="photo-caption">Bildunterschrift (optional)</Label>
                <Input
                  id="photo-caption"
                  placeholder="Was zeigt das Bild?"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={500}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="photo-author">Dein Name (optional)</Label>
                <Input
                  id="photo-author"
                  placeholder="Anonym"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  maxLength={100}
                  disabled={isUploading}
                />
              </div>
            </>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Hochladen...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Actions */}
          {pendingFiles.length > 0 && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-1 gap-1.5"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {pendingFiles.length} Foto{pendingFiles.length > 1 ? "s" : ""} hochladen
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isUploading}
              >
                Abbrechen
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
