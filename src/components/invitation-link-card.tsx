"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareButton } from "@/components/share-button";
import {
  Copy,
  Check,
  RefreshCw,
  Link as LinkIcon,
  AlertCircle,
} from "lucide-react";
import type { Invitation } from "@/lib/event-utils";

interface InvitationLinkCardProps {
  eventId: string;
  eventName: string;
  invitation: Invitation | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => Promise<void>;
}

function getExpiryInfo(expiresAt: string): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  expired: boolean;
} {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { label: "Abgelaufen", variant: "destructive", expired: true };
  }

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return {
      label: "Laeuft heute ab",
      variant: "destructive",
      expired: false,
    };
  }

  if (diffDays <= 2) {
    return {
      label: `Noch ${diffDays} Tag gueltig`,
      variant: "secondary",
      expired: false,
    };
  }

  return {
    label: `Noch ${diffDays} Tage gueltig`,
    variant: "default",
    expired: false,
  };
}

export function InvitationLinkCard({
  eventId,
  eventName,
  invitation,
  loading,
  error,
  onGenerate,
}: InvitationLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [generating, setGenerating] = useState(false);

  const inviteUrl = invitation
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${invitation.token}`
    : null;

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) return;
    setCopyFailed(false);
    // BUG-3 fix: provide user feedback when Clipboard API is unavailable
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 4000);
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 4000);
    }
  }, [inviteUrl]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await onGenerate();
    } finally {
      setGenerating(false);
    }
  }, [onGenerate]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <LinkIcon className="h-5 w-5" aria-hidden="true" />
            Einladungslink
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  const expiryInfo = invitation
    ? getExpiryInfo(invitation.expires_at)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LinkIcon className="h-5 w-5" aria-hidden="true" />
          Einladungslink
        </CardTitle>
        <CardDescription>
          Teile diesen Link, damit Teilnehmer dem Event beitreten koennen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {invitation && inviteUrl ? (
          <>
            {/* Link display */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 rounded-md border bg-muted/50 px-3 py-2">
                <p
                  className="truncate text-sm font-mono text-muted-foreground"
                  title={inviteUrl}
                >
                  {inviteUrl}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label="Link kopieren"
                title="Link kopieren"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Expiry badge + actions */}
            <div className="flex flex-wrap items-center gap-2">
              {expiryInfo && (
                <Badge variant={expiryInfo.variant}>{expiryInfo.label}</Badge>
              )}
            </div>

            {/* BUG-3 fix: clipboard fallback message */}
            {copyFailed && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                Kopieren nicht moeglich. Bitte den Link oben manuell auswaehlen.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <ShareButton
                title={`Einladung: ${eventName}`}
                text={`Du bist eingeladen zum Event "${eventName}". Klicke auf den Link, um beizutreten:`}
                url={inviteUrl}
                variant="button"
              />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={generating}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${generating ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    Neuen Link generieren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Neuen Link generieren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Der bisherige Einladungslink wird sofort ungueltig. Bereits
                      beigetretene Teilnehmer sind nicht betroffen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGenerate}>
                      Neuen Link generieren
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          /* No invitation yet */
          <div className="text-center py-4">
            <p className="mb-4 text-sm text-muted-foreground">
              Es gibt noch keinen Einladungslink fuer dieses Event.
            </p>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <RefreshCw
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <LinkIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Einladungslink erstellen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
