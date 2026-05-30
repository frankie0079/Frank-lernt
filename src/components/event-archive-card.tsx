"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type ArchiveVisibility = "draft" | "community" | "private";

interface ArchiveSettings {
  event_id: string;
  event_name: string;
  slug: string;
  archive_visibility: ArchiveVisibility;
  archive_published_at: string | null;
  archive_token: string;
  community_token: string | null;
}

interface Props {
  eventId: string;
}

function origin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function EventArchiveCard({ eventId }: Props) {
  const [settings, setSettings] = useState<ArchiveSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/archive`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Archiv konnte nicht geladen werden.");
      setSettings(data.archive);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archiv konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const communityUrl = useMemo(() => {
    if (!settings?.community_token) return null;
    return `${origin()}/archiv/${settings.community_token}`;
  }, [settings]);

  const communityEventUrl = useMemo(() => {
    if (!settings?.community_token) return null;
    return `${origin()}/archiv/${settings.community_token}/${settings.slug}`;
  }, [settings]);

  const privateUrl = useMemo(() => {
    if (!settings) return null;
    return `${origin()}/archiv/privat/${settings.archive_token}`;
  }, [settings]);

  const activeUrl =
    settings?.archive_visibility === "community"
      ? communityEventUrl
      : settings?.archive_visibility === "private"
        ? privateUrl
        : null;

  async function save(next: Partial<Pick<ArchiveSettings, "archive_visibility">> & { published?: boolean }) {
    if (!settings) return;
    setSaving(true);
    try {
      const visibility = next.archive_visibility ?? settings.archive_visibility;
      const published =
        next.published ??
        (visibility === "draft" ? false : !!settings.archive_published_at);
      const res = await fetch(`/api/events/${eventId}/archive`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          archive_visibility: visibility,
          archive_published: published,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Archiv konnte nicht gespeichert werden.");
      setSettings(data.archive);
      toast.success("Archiv-Einstellungen gespeichert.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archiv konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(value: string | null) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success("Link kopiert.");
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <Archive className="h-5 w-5" aria-hidden="true" />
            Archiv
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Steuert, ob dieses Event im Wandervögel-Archiv oder nur privat sichtbar ist.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          Aktualisieren
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Archiv wird geladen...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : settings ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sichtbarkeit</Label>
              <Select
                value={settings.archive_visibility}
                onValueChange={(value) =>
                  void save({ archive_visibility: value as ArchiveVisibility })
                }
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Entwurf</SelectItem>
                  <SelectItem value="community">Wandervögel-Archiv</SelectItem>
                  <SelectItem value="private">Privat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label>Veröffentlicht</Label>
                  <p className="text-xs text-muted-foreground">
                    {settings.archive_published_at
                      ? "Archivlink ist aktiv."
                      : "Archiv ist noch nicht sichtbar."}
                  </p>
                </div>
                <Switch
                  checked={!!settings.archive_published_at}
                  disabled={saving || settings.archive_visibility === "draft"}
                  onCheckedChange={(checked) => void save({ published: checked })}
                />
              </div>
            </div>
          </div>

          {communityUrl ? (
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">Gemeinsamer Archivlink</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {communityUrl}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copy(communityUrl)}>
                  <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
                  Kopieren
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={communityUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" aria-hidden="true" />
                    Öffnen
                  </a>
                </Button>
              </div>
            </div>
          ) : null}

          {activeUrl ? (
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">Link zu diesem Event</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {activeUrl}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copy(activeUrl)}>
                  <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
                  Kopieren
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={activeUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" aria-hidden="true" />
                    Öffnen
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
