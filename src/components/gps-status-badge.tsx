"use client";

import { Badge } from "@/components/ui/badge";
import { MapPin, MapPinOff, Loader2 } from "lucide-react";
import type { GpsStatus } from "@/hooks/use-geolocation";

interface GpsStatusBadgeProps {
  status: GpsStatus;
  onRetry?: () => void;
}

const statusConfig: Record<
  GpsStatus,
  { label: string; className: string; icon: typeof MapPin }
> = {
  loading: {
    label: "GPS...",
    className: "bg-muted text-muted-foreground",
    icon: Loader2,
  },
  active: {
    label: "GPS aktiv",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: MapPin,
  },
  denied: {
    label: "GPS blockiert",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    icon: MapPinOff,
  },
  unavailable: {
    label: "Kein GPS",
    className: "bg-muted text-muted-foreground",
    icon: MapPinOff,
  },
};

export function GpsStatusBadge({ status, onRetry }: GpsStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`gap-1 ${config.className} cursor-default`}
      onClick={status === "denied" || status === "unavailable" ? onRetry : undefined}
      role={onRetry ? "button" : undefined}
      aria-label={`GPS-Status: ${config.label}`}
    >
      <Icon
        className={`h-3 w-3 ${status === "loading" ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <span className="text-xs">{config.label}</span>
    </Badge>
  );
}
