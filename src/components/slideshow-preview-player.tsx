"use client";

// PROJ-34: Native <video> player for blob or remote slideshow URLs.

interface Props {
  src: string;
  format: "portrait" | "landscape";
  className?: string;
}

export function SlideshowPreviewPlayer({ src, format, className = "" }: Props) {
  const aspect = format === "portrait" ? "aspect-[9/16]" : "aspect-video";
  return (
    <video
      src={src}
      controls
      playsInline
      className={`w-full max-w-sm rounded-lg bg-black ${aspect} ${className}`}
    />
  );
}
