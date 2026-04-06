"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const REACTION_EMOJIS = ["❤️", "🔥", "😂", "👏", "😮"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface ReactionState {
  /** Count per emoji */
  counts: Record<ReactionEmoji, number>;
  /** Emojis the current user has reacted with */
  userReactions: ReactionEmoji[];
}

export function emptyReactionState(): ReactionState {
  return {
    counts: { "❤️": 0, "🔥": 0, "😂": 0, "👏": 0, "😮": 0 },
    userReactions: [],
  };
}

interface ReactionBarProps {
  eventId: string;
  contentItemId: string;
  initialState?: ReactionState;
  /** If true, read-only (public event page / not logged in) */
  readOnly?: boolean;
  /** Stop event propagation when tapped (so parent card click handler doesn't fire) */
  stopPropagation?: boolean;
  className?: string;
}

const DEBOUNCE_MS = 200;

function formatCount(n: number): string {
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
}

export function ReactionBar({
  eventId,
  contentItemId,
  initialState,
  readOnly = false,
  stopPropagation = true,
  className,
}: ReactionBarProps) {
  const [state, setState] = useState<ReactionState>(
    () => initialState ?? emptyReactionState()
  );
  const lastTapRef = useRef<Record<string, number>>({});
  // Prevent concurrent calls per emoji
  const pendingRef = useRef<Set<ReactionEmoji>>(new Set());

  // Sync when initialState changes (e.g., after refetch)
  useEffect(() => {
    if (initialState) setState(initialState);
  }, [initialState]);

  const handleTap = useCallback(
    async (emoji: ReactionEmoji, e: React.MouseEvent) => {
      if (stopPropagation) e.stopPropagation();
      if (readOnly) {
        toast.info("Bitte melde dich an, um zu reagieren.");
        return;
      }

      // Debounce: 200ms
      const now = Date.now();
      const last = lastTapRef.current[emoji] ?? 0;
      if (now - last < DEBOUNCE_MS) return;
      lastTapRef.current[emoji] = now;

      // Concurrent guard
      if (pendingRef.current.has(emoji)) return;
      pendingRef.current.add(emoji);

      const wasActive = state.userReactions.includes(emoji);
      const prevState = state;

      // Optimistic update
      setState((prev) => {
        const counts = { ...prev.counts };
        const userReactions = wasActive
          ? prev.userReactions.filter((e) => e !== emoji)
          : [...prev.userReactions, emoji];
        counts[emoji] = Math.max(0, counts[emoji] + (wasActive ? -1 : 1));
        return { counts, userReactions };
      });

      try {
        const url = `/api/events/${eventId}/content/${contentItemId}/reactions`;
        const res = wasActive
          ? await fetch(`${url}?emoji=${encodeURIComponent(emoji)}`, {
              method: "DELETE",
            })
          : await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ emoji }),
            });

        if (!res.ok) {
          if (res.status === 404) {
            toast.error("Beitrag nicht mehr vorhanden.");
          } else {
            throw new Error("Reaktion fehlgeschlagen");
          }
          // Rollback
          setState(prevState);
        }
      } catch {
        toast.error("Reaktion konnte nicht gespeichert werden.");
        setState(prevState);
      } finally {
        pendingRef.current.delete(emoji);
      }
    },
    [eventId, contentItemId, state, readOnly, stopPropagation]
  );

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-3 pb-2.5 pt-0.5",
        className
      )}
      role="group"
      aria-label="Reaktionen"
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      {REACTION_EMOJIS.map((emoji) => {
        const count = state.counts[emoji] ?? 0;
        const active = state.userReactions.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => handleTap(emoji, e)}
            disabled={readOnly}
            aria-label={`Reagieren mit ${emoji}${count > 0 ? `, ${count} Reaktionen` : ""}`}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-transform duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
              active
                ? "scale-110 bg-teal-100 text-teal-900"
                : "bg-transparent hover:bg-muted",
              readOnly && "cursor-default hover:bg-transparent"
            )}
          >
            <span aria-hidden="true" className="leading-none">
              {emoji}
            </span>
            {count > 0 && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  active ? "font-semibold text-teal-900" : "text-muted-foreground"
                )}
              >
                {formatCount(count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
