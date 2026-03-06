"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
  variant?: "icon" | "button";
}

export function ShareButton({
  title,
  text,
  url,
  variant = "icon",
}: ShareButtonProps) {
  const [shared, setShared] = useState(false);

  async function handleShare() {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

    // Try native Web Share API first (mobile)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch (err) {
        // User cancelled or error -- fall through to WhatsApp fallback
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    // Fallback: WhatsApp deep link
    const whatsappText = encodeURIComponent(`${title}\n\n${text}\n\n${shareUrl}`);
    window.open(`https://wa.me/?text=${whatsappText}`, "_blank", "noopener");
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleShare}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label={`${title} teilen`}
        title="Teilen"
      >
        {shared ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      className="gap-1.5"
    >
      {shared ? (
        <Check className="h-4 w-4 text-primary" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      Teilen
    </Button>
  );
}
