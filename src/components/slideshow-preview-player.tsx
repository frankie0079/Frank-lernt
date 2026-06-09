"use client";

// PROJ-34: Native <video> player for blob or remote slideshow URLs.

interface Props {
  src: string;
  format: "portrait" | "landscape";
  className?: string;
  poster?: string | null;
}

export function SlideshowPreviewPlayer({ src, format, className = "", poster }: Props) {
  const aspect = format === "portrait" ? "aspect-[9/16]" : "aspect-video";
  return (
    <video
      src={src}
      controls
      playsInline
      poster={poster ?? undefined}
      className={`w-full max-w-sm rounded-lg bg-black ${aspect} ${className}`}
    />
  );
}
