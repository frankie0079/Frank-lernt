"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommentBadgeProps {
  count: number;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

function formatCount(n: number): string {
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
}

/**
 * Speech-bubble icon with optional count badge.
 * Shown on each ContentCard. Tap opens the CommentThreadSheet.
 */
export function CommentBadge({ count, onClick, className }: CommentBadgeProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-colors",
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
        className
      )}
      aria-label={
        count > 0 ? `${count} Kommentare anzeigen` : "Kommentare anzeigen"
      }
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {count > 0 && (
        <span className="text-xs tabular-nums">{formatCount(count)}</span>
      )}
    </button>
  );
}
