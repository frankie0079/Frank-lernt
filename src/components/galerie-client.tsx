"use client";

import { useState } from "react";
import { Plus, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Photo } from "@/lib/types";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoUploadSheet } from "@/components/photo-upload-sheet";

interface GalerieClientProps {
  tourId: string;
  tourName: string;
  initialPhotos: Photo[];
}

export function GalerieClient({ tourId, tourName, initialPhotos }: GalerieClientProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  function handlePhotosUploaded(newPhotos: Photo[]) {
    setPhotos((prev) => [...newPhotos, ...prev]);
    setIsUploadOpen(false);
  }

  return (
    <>
      {photos.length === 0 ? (
        <EmptyState onUpload={() => setIsUploadOpen(true)} />
      ) : (
        <PhotoGrid
          photos={photos}
          onPhotoClick={(index) => setLightboxIndex(index)}
        />
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          tourName={tourName}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* FAB for upload */}
      {photos.length > 0 && (
        <button
          onClick={() => setIsUploadOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Fotos hochladen"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Upload sheet */}
      <PhotoUploadSheet
        tourId={tourId}
        isOpen={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onUploaded={handlePhotosUploaded}
      />
    </>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Camera className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Noch keine Fotos
      </h2>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Halte deine Erlebnisse fest und teile deine schönsten Momente!
      </p>
      <Button onClick={onUpload} className="gap-2">
        <Plus className="h-4 w-4" />
        Fotos hochladen
      </Button>
    </div>
  );
}
