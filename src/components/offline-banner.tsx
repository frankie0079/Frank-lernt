"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff } from "lucide-react";

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;
  return (
    <Alert
      variant="destructive"
      className="mb-3"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      <AlertDescription>
        Keine Verbindung — Änderungen werden nicht gespeichert
      </AlertDescription>
    </Alert>
  );
}
