"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import {
  Camera,
  Video,
  Type,
  Mic,
  Trash2,
  Play,
  ImageOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ReactionBar, type ReactionState } from "@/components/reaction-bar";
import { CommentBadge } from "@/components/comment-badge";
import { CommentThreadSheet } from "@/components/comment-thread-sheet";

export interface ContentItem {
  id: string;
  event_id: string;
  agenda_item_id: string | null;
  author_id: string;
  type: "photo" | "video" | "text" | "audio";
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  exif_date: string | null;
  created_at: string;
  author_name?: string | null;
  author_avatar_url?: string | null;
  reactions?: ReactionState;
  comment_count?: number;
  /** True if viewer is event organizer OR daily-admin of this item's agenda */
  viewer_can_moderate_comments?: boolean;
}

const typeConfig = {
  photo: { label: "Foto", icon: Camera, color: "bg-teal-100 text-teal-700" },
  video: { label: "Video", icon: Video, color: "bg-blue-100 text-blue-700" },
  text: { label: "Text", icon: Type, color: "bg-amber-100 text-amber-700" },
  audio: {
    label: "Sprachmemo",
    icon: Mic,
    color: "bg-purple-100 text-purple-700",
  },
};

interface ContentCardProps {
  item: ContentItem;
  currentUserId: string;
  isOrganizer: boolean;
  onTap: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
  reactionsReadOnly?: boolean;
}

export function ContentCard({
  item,
  currentUserId,
  isOrganizer,
  onTap,
  onDelete,
  reactionsReadOnly = false,
}: ContentCardProps) {
  const [imgError, setImgError] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(item.comment_count ?? 0);
  // Sync comment_count from props when item changes (e.g. tab switch re-fetch)
  useEffect(() => {
    setCommentCount(item.comment_count ?? 0);
  }, [item.comment_count]);
  const config = typeConfig[item.type];
  const TypeIcon = config.icon;
  const canDelete = item.author_id === currentUserId || isOrganizer;

  const relativeTime = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
    locale: de,
  });

  const authorInitial = item.author_name
    ? item.author_name.charAt(0).toUpperCase()
    : "?";

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onTap(item)}
      role="button"
      tabIndex={0}
      aria-label={`${config.label} von ${item.author_name || "Unbekannt"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap(item);
        }
      }}
    >
      {/* Media Preview */}
      <div className="relative">
        {item.type === "photo" && (
          <div className="aspect-[4/3] w-full bg-muted">
            {!imgError && (item.thumbnail_url || item.media_url) ? (
              <img
                src={item.thumbnail_url || item.media_url!}
                alt={item.caption || "Foto"}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageOff
                  className="h-8 w-8 text-teal-400"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        )}

        {item.type === "video" && (
          <div className="aspect-[4/3] w-full bg-muted">
            {!imgError && (item.thumbnail_url || item.media_url) ? (
              <div className="relative h-full w-full">
                <img
                  src={item.thumbnail_url || item.media_url!}
                  alt={item.caption || "Video-Standbild"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={() => setImgError(true)}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50">
                    <Play
                      className="h-6 w-6 text-white ml-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Video
                  className="h-8 w-8 text-blue-400"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        )}

        {item.type === "audio" && (
          <div className="flex w-full flex-col gap-2 bg-gradient-to-br from-purple-50 to-purple-100 p-4">
            <div className="flex items-start gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-200">
                <Mic className="h-4 w-4 text-purple-700" aria-hidden="true" />
              </div>
              {item.caption ? (
                <p className="line-clamp-4 text-sm italic text-purple-900">
                  {item.caption}
                </p>
              ) : (
                <p className="text-sm italic text-purple-700/70">
                  Sprachmemo ohne Transkription
                </p>
              )}
            </div>
            {item.media_url && (
              <audio
                src={item.media_url}
                controls
                preload="none"
                className="h-8 w-full"
                onClick={(e) => e.stopPropagation()}
                aria-label="Sprachmemo abspielen"
              />
            )}
          </div>
        )}

        {item.type === "text" && (
          <div className="min-h-[120px] bg-gradient-to-br from-amber-50 to-amber-100 p-4">
            <p className="line-clamp-4 text-sm text-foreground">
              {item.caption}
            </p>
          </div>
        )}
      </div>

      {/* Caption (for non-text/non-audio types) */}
      {item.type !== "text" && item.type !== "audio" && item.caption && (
        <div className="px-3 pt-2">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {item.caption}
          </p>
        </div>
      )}

      {/* Author Row */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-6 w-6 shrink-0">
            {item.author_avatar_url && (
              <AvatarImage
                src={item.author_avatar_url}
                alt={item.author_name || "Avatar"}
              />
            )}
            <AvatarFallback className="text-[10px]">
              {authorInitial}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-xs font-medium text-foreground">
            {item.author_name || "Unbekannt"}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Badge
            variant="secondary"
            className={`gap-0.5 px-1.5 py-0 text-[10px] ${config.color}`}
          >
            <TypeIcon className="h-2.5 w-2.5" aria-hidden="true" />
            {config.label}
          </Badge>

          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              aria-label="Beitrag loeschen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Reactions + Comments */}
      <div className="flex items-center justify-between gap-1 pr-2">
        <ReactionBar
          eventId={item.event_id}
          contentItemId={item.id}
          initialState={item.reactions}
          readOnly={reactionsReadOnly}
          className="flex-1"
        />
        <CommentBadge
          count={commentCount}
          onClick={() => setCommentsOpen(true)}
        />
      </div>

      <CommentThreadSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        eventId={item.event_id}
        contentItemId={item.id}
        currentMemberId={currentUserId || null}
        canModerate={
          isOrganizer || item.viewer_can_moderate_comments === true
        }
        onCountChange={setCommentCount}
      />
    </Card>
  );
}

/** Skeleton placeholder for loading state */
export function ContentCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] w-full animate-pulse bg-muted" />
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
      </div>
    </Card>
  );
}
