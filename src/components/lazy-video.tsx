"use client";

// PROJ-35 BUG-4 fix: HTML <video> does not support the `loading="lazy"`
// attribute. To avoid 30 parallel metadata range-requests against Supabase
// Storage when a long event has many day-reports, this wrapper defers setting
// the video `src` until the element scrolls into the viewport (100px margin).

import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  poster?: string;
  className?: string;
  ariaLabel?: string;
}

export function LazyVideo({ src, poster, className, ariaLabel }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Initial state: older browsers without IntersectionObserver just load eagerly.
  const [visible, setVisible] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    if (visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={containerRef} className={className}>
      {visible ? (
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          poster={poster}
          className="aspect-video w-full"
          aria-label={ariaLabel}
        />
      ) : (
        <div
          className="flex aspect-video w-full items-center justify-center bg-black"
          aria-label={ariaLabel}
          role="img"
          style={
            poster
              ? {
                  backgroundImage: `url(${poster})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
