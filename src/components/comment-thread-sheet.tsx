"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Send, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export interface Comment {
  id: string;
  content_item_id: string;
  author_id: string;
  text: string;
  created_at: string;
  author_name?: string | null;
  author_avatar_url?: string | null;
}

interface CommentThreadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  contentItemId: string;
  /** ID of the current member, or null if not logged in */
  currentMemberId: string | null;
  /** Whether the current member can moderate (organizer / admin) */
  canModerate: boolean;
  /** Notify parent when total count changes (for badge update) */
  onCountChange?: (count: number) => void;
}

const PAGE_SIZE = 20;
const MAX_LENGTH = 500;
const UNDO_DELAY_MS = 5000;
const SWIPE_DELETE_THRESHOLD = 80; // px

interface CommentRowProps {
  comment: Comment;
  canDelete: boolean;
  swipeEnabled: boolean;
  onDelete: () => void;
}

function CommentRow({
  comment: c,
  canDelete,
  swipeEnabled,
  onDelete,
}: CommentRowProps) {
  const initial = c.author_name ? c.author_name.charAt(0).toUpperCase() : "?";
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef<number | null>(null);

  const swipeable = canDelete && swipeEnabled;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!swipeable) return;
    startXRef.current = e.clientX;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!swipeable || startXRef.current == null) return;
    const dx = e.clientX - startXRef.current;
    if (dx < 0) setDragX(Math.max(dx, -SWIPE_DELETE_THRESHOLD * 1.5));
  };
  const onPointerUp = () => {
    if (!swipeable) return;
    if (dragX <= -SWIPE_DELETE_THRESHOLD) {
      setDragX(0);
      startXRef.current = null;
      onDelete();
      return;
    }
    setDragX(0);
    startXRef.current = null;
  };

  return (
    <li
      className="relative overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {swipeable && dragX < 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-destructive">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
      <div
        className="flex gap-2 transition-transform"
        style={{ transform: `translateX(${dragX}px)` }}
      >
        <Avatar className="h-7 w-7 shrink-0">
          {c.author_avatar_url && (
            <AvatarImage
              src={c.author_avatar_url}
              alt={c.author_name || "Avatar"}
            />
          )}
          <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">
              {c.author_name || "Unbekannt"}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(c.created_at), {
                addSuffix: true,
                locale: de,
              })}
            </span>
          </div>
          <p
            className="text-sm text-foreground"
            style={{ wordBreak: "break-all" }}
          >
            {c.text}
          </p>
        </div>
        {canDelete && !swipeEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Kommentar loeschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}

export function CommentThreadSheet({
  open,
  onOpenChange,
  eventId,
  contentItemId,
  currentMemberId,
  canModerate,
  onCountChange,
}: CommentThreadSheetProps) {
  const isMobile = useIsMobile();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pending deletes (id → timeoutId) — used for 5s undo window
  const pendingDeletesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const commentsRef = useRef<Comment[]>([]);
  useEffect(() => {
    commentsRef.current = comments;
    onCountChange?.(comments.length);
  }, [comments, onCountChange]);

  const fetchComments = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const url = new URL(
          `/api/events/${eventId}/content/${contentItemId}/comments`,
          window.location.origin
        );
        url.searchParams.set("limit", String(PAGE_SIZE));
        if (cursor) url.searchParams.set("cursor", cursor);
        const res = await fetch(url.toString());
        if (!res.ok) {
          toast.error("Kommentare konnten nicht geladen werden.");
          return;
        }
        const data = await res.json();
        const fetched: Comment[] = data.comments || [];
        setHasMore(fetched.length === PAGE_SIZE);
        if (cursor) {
          setComments((prev) => [...fetched, ...prev]);
        } else {
          setComments(fetched);
        }
      } catch {
        toast.error("Verbindungsfehler beim Laden.");
      } finally {
        setLoading(false);
      }
    },
    [eventId, contentItemId]
  );

  // Initial load when sheet opens
  useEffect(() => {
    if (!open) return;
    fetchComments();
  }, [open, fetchComments]);

  // Realtime subscription — also listens for content_item DELETE so the
  // sheet auto-closes when the underlying post disappears (BUG-6).
  useEffect(() => {
    if (!open) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const channel = supabase
      .channel(`comments-${contentItemId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "content_items",
          filter: `id=eq.${contentItemId}`,
        },
        () => {
          toast.info("Beitrag wurde geloescht.");
          onOpenChange(false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `content_item_id=eq.${contentItemId}`,
        },
        async (payload) => {
          const row = payload.new as Comment;
          // Skip if already present (own optimistic insert)
          if (commentsRef.current.some((c) => c.id === row.id)) return;
          // Fetch enriched (with author info)
          try {
            const res = await fetch(
              `/api/events/${eventId}/content/${contentItemId}/comments?id=${row.id}`
            );
            if (!res.ok) return;
            const data = await res.json();
            const enriched: Comment | undefined = data.comments?.[0];
            if (enriched) {
              setComments((prev) =>
                prev.some((c) => c.id === enriched.id) ? prev : [...prev, enriched]
              );
            }
          } catch {
            // ignore
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "comments",
          filter: `content_item_id=eq.${contentItemId}`,
        },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setComments((prev) => prev.filter((c) => c.id !== oldRow.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, eventId, contentItemId, onOpenChange]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    if (!currentMemberId) {
      toast.info("Bitte melde dich an, um zu kommentieren.");
      return;
    }
    if (trimmed.length > MAX_LENGTH) return;

    setSubmitting(true);

    // Optimistic temp ID
    const tempId = `temp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      content_item_id: contentItemId,
      author_id: currentMemberId,
      text: trimmed,
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setText("");

    try {
      const res = await fetch(
        `/api/events/${eventId}/content/${contentItemId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        if (res.status === 429) {
          toast.error("Zu viele Kommentare. Bitte warte einen Moment.");
        } else {
          toast.error(errBody?.error || "Kommentar konnte nicht gesendet werden.");
        }
        // Rollback
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setText(trimmed);
        return;
      }
      const data = await res.json();
      const real: Comment | undefined = data.comment;
      if (real) {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? real : c))
        );
      }
    } catch {
      toast.error("Verbindungsfehler.");
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setText(trimmed);
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, currentMemberId, eventId, contentItemId]);

  const handleDelete = useCallback(
    (comment: Comment) => {
      // Optimistic remove
      setComments((prev) => prev.filter((c) => c.id !== comment.id));

      // Schedule actual delete after undo window
      const timeout = setTimeout(async () => {
        pendingDeletesRef.current.delete(comment.id);
        try {
          await fetch(
            `/api/events/${eventId}/content/${contentItemId}/comments/${comment.id}`,
            { method: "DELETE" }
          );
        } catch {
          toast.error("Kommentar konnte nicht geloescht werden.");
          setComments((prev) =>
            prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]
          );
        }
      }, UNDO_DELAY_MS);
      pendingDeletesRef.current.set(comment.id, timeout);

      // Show toast with undo
      toast("Kommentar geloescht", {
        action: {
          label: "Rueckgaengig",
          onClick: () => {
            const t = pendingDeletesRef.current.get(comment.id);
            if (t) {
              clearTimeout(t);
              pendingDeletesRef.current.delete(comment.id);
              setComments((prev) =>
                prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]
              );
            }
          },
        },
        duration: UNDO_DELAY_MS,
      });
    },
    [eventId, contentItemId]
  );

  const charCount = text.length;
  const overLimit = charCount > MAX_LENGTH;
  const canSubmit =
    !!currentMemberId &&
    text.trim().length > 0 &&
    !overLimit &&
    !submitting;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col",
          isMobile ? "h-[80vh]" : "w-full sm:max-w-md"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SheetHeader>
          <SheetTitle>
            Kommentare {comments.length > 0 && `(${comments.length})`}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {hasMore && (
            <div className="flex justify-center pb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const oldest = comments[0]?.created_at;
                  if (oldest) fetchComments(oldest);
                }}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : null}
                Aeltere Kommentare laden
              </Button>
            </div>
          )}

          {loading && comments.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch kein Kommentar — sei der Erste!
            </p>
          ) : (
            <ul className="space-y-3 px-1">
              {comments.map((c) => {
                const isOwn = c.author_id === currentMemberId;
                const canDelete = isOwn || canModerate;
                return (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    canDelete={canDelete}
                    swipeEnabled={isMobile}
                    onDelete={() => handleDelete(c)}
                  />
                );
              })}
            </ul>
          )}
        </div>

        {currentMemberId && (
          <div className="border-t pt-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Kommentar schreiben..."
                  rows={2}
                  maxLength={MAX_LENGTH}
                  disabled={submitting}
                  className="resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                />
                <div className="mt-1 flex justify-end">
                  <span
                    className={cn(
                      "text-[10px] tabular-nums",
                      overLimit ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {charCount}/{MAX_LENGTH}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                aria-label="Kommentar senden"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
