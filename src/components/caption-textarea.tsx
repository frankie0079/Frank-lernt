"use client";

import { Textarea } from "@/components/ui/textarea";
import { CONTENT_MAX_CAPTION_LENGTH } from "@/lib/validations/content";

interface CaptionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Textarea with character counter for content captions.
 * Shows counter in red when over the limit.
 */
export function CaptionTextarea({
  value,
  onChange,
  placeholder = "Kommentar hinzufuegen (optional)...",
  required = false,
  disabled = false,
}: CaptionTextareaProps) {
  const isOverLimit = value.length > CONTENT_MAX_CAPTION_LENGTH;
  const charCount = value.length;

  return (
    <div className="space-y-1">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={disabled}
        required={required}
        className="resize-none"
        aria-label={required ? "Kommentar (Pflichtfeld)" : "Kommentar (optional)"}
        aria-describedby="caption-counter"
      />
      <p
        id="caption-counter"
        className={`text-xs text-right ${
          isOverLimit
            ? "text-destructive font-medium"
            : "text-muted-foreground"
        }`}
      >
        {charCount}/{CONTENT_MAX_CAPTION_LENGTH}
      </p>
    </div>
  );
}
