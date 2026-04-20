"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_COMMENT_LENGTH } from "@/lib/book-types";

interface BookCommentTextareaProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function BookCommentTextarea({
  value,
  onChange,
  disabled,
}: BookCommentTextareaProps) {
  const length = value.length;
  const tooLong = length > MAX_COMMENT_LENGTH;
  const nearLimit = length > MAX_COMMENT_LENGTH * 0.9;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label
          htmlFor="book-page-comment"
          className="font-[family-name:var(--font-caveat)] text-2xl font-bold text-foreground"
        >
          Tageskommentar
        </Label>
        <span
          className={`text-xs tabular-nums ${
            tooLong
              ? "font-medium text-destructive"
              : nearLimit
                ? "text-amber-600"
                : "text-muted-foreground"
          }`}
          aria-live="polite"
        >
          {length} / {MAX_COMMENT_LENGTH}
        </span>
      </div>
      <Textarea
        id="book-page-comment"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={6}
        placeholder="Was war an diesem Tag besonders? (optional)"
        className={tooLong ? "border-destructive focus-visible:ring-destructive" : ""}
        aria-invalid={tooLong}
        aria-describedby={tooLong ? "book-comment-error" : undefined}
      />
      {tooLong && (
        <p
          id="book-comment-error"
          className="text-xs text-destructive"
          role="alert"
        >
          Kommentar zu lang — Auto-Save pausiert. Bitte kürzen.
        </p>
      )}
    </div>
  );
}
