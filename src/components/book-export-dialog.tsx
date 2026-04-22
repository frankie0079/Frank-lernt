"use client";

// PROJ-37: Export dialog for the Tagebuch PDF. Format + theme picker, client-
// side PDF generation via @react-pdf/renderer, with a pre-flight URL check
// (BUG-1) that gracefully handles broken Supabase Storage URLs.

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { BookPage } from "@/lib/book-types";
import { preflightPdfUrls } from "@/lib/pdf-preflight";
import {
  PDF_FORMAT_SPECS,
  PDF_FORMATS,
  PDF_THEMES,
  PDF_THEME_SPECS,
  sanitizeFilename,
  type PdfFormat,
  type PdfTheme,
} from "@/components/pdf/pdf-theme";

// @react-pdf/renderer is heavy (~1 MB) — load lazy so the book read view
// itself stays slim.
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

interface EventInfo {
  name: string;
  description?: string | null;
  cover_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface MemberInfo {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface BookExportDialogProps {
  eventId: string;
  event: EventInfo;
  pages: BookPage[];
  /** Only organizers get the export option */
  enabled: boolean;
}

/** BUG-9: Detect iOS Safari — needs a post-generation "open in new tab" hint */
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iP(hone|ad|od)/.test(ua) &&
    /Safari/.test(ua) &&
    !/CriOS|FxiOS|EdgiOS/.test(ua)
  );
}

export function BookExportDialog({
  eventId,
  event,
  pages,
  enabled,
}: BookExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<PdfFormat>("square");
  const [theme, setTheme] = useState<PdfTheme>("classic");
  const [includeAboutPage, setIncludeAboutPage] = useState(false);
  const [includeToc, setIncludeToc] = useState(false);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  // BUG-5: Large-PDF confirmation gate
  const [sizeAcknowledged, setSizeAcknowledged] = useState(false);

  // BUG-1 preflight state — null = not run, "running" = in flight,
  // PreflightResult = done (validated pages + broken count + cover status)
  type PreflightState =
    | { status: "idle" }
    | { status: "running"; done: number; total: number }
    | {
        status: "done";
        pages: BookPage[];
        validated: number;
        broken: number;
        coverBroken: boolean;
      }
    | { status: "error"; message: string };
  const [preflight, setPreflight] = useState<PreflightState>({
    status: "idle",
  });

  // BUG-8 retry key — bump to force PDFDownloadLink remount
  const [retryKey, setRetryKey] = useState(0);

  const [PdfComponent, setPdfComponent] = useState<React.ComponentType<{
    eventName: string;
    description?: string | null;
    coverUrl?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    members: MemberInfo[];
    pages: BookPage[];
    format: PdfFormat;
    theme: PdfTheme;
    includeAboutPage?: boolean;
    includeToc?: boolean;
  }> | null>(null);

  // Lazy-import the PDF component once the dialog opens
  useEffect(() => {
    if (!open || PdfComponent) return;
    import("@/components/pdf/event-book-pdf").then((mod) => {
      setPdfComponent(() => mod.EventBookPdf);
    });
  }, [open, PdfComponent]);

  // Fetch members lazily on first open (for about-box)
  useEffect(() => {
    if (!open || membersLoaded) return;
    fetch(`/api/events/${eventId}/members`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.members) {
          setMembers(
            data.members.map(
              (m: {
                member_id: string;
                member_name: string | null;
                member_avatar_url: string | null;
              }) => ({
                id: m.member_id,
                name: m.member_name || "Unbekannt",
                avatar_url: m.member_avatar_url,
              })
            )
          );
        }
        setMembersLoaded(true);
      })
      .catch(() => setMembersLoaded(true));
  }, [open, membersLoaded, eventId]);

  // Reset state when the dialog closes so re-open always re-validates
  useEffect(() => {
    if (!open) {
      setPreflight({ status: "idle" });
      setSizeAcknowledged(false);
      setRetryKey(0);
    }
  }, [open]);

  // Only visible days with at least one section
  const publishablePages = useMemo(
    () =>
      pages.filter(
        (p) => p.is_visible && (p.sections ?? []).length > 0
      ),
    [pages]
  );

  const photoCount = useMemo(
    () =>
      publishablePages.reduce(
        (sum, p) =>
          sum +
          (p.sections ?? []).reduce(
            (s, sec) =>
              s +
              sec.items.filter(
                (i) => i.type === "photo" || i.type === "video"
              ).length,
            0
          ),
        0
      ),
    [publishablePages]
  );

  // BUG-11: detect grid-3 sections with too many items (tiles become unreadable)
  const gridOverflowSections = useMemo(
    () =>
      publishablePages.reduce((count, p) => {
        return (
          count +
          (p.sections ?? []).filter(
            (sec) => sec.layout === "grid-3" && sec.items.length > 12
          ).length
        );
      }, 0),
    [publishablePages]
  );

  const estimatedMb = Math.max(1, Math.round(photoCount * 0.4));
  const largeWarning = estimatedMb > 40;

  const filename = sanitizeFilename(event.name);
  const formatSpec = PDF_FORMAT_SPECS[format];
  const themeSpec = PDF_THEME_SPECS[theme];

  async function runPreflight() {
    setPreflight({ status: "running", done: 0, total: 0 });
    try {
      const result = await preflightPdfUrls(
        publishablePages,
        event.cover_url ?? null,
        (done, total) =>
          setPreflight({ status: "running", done, total })
      );
      setPreflight({
        status: "done",
        pages: result.pages,
        validated: result.validated,
        broken: result.broken,
        coverBroken: result.coverBroken,
      });
      if (result.broken > 0) {
        toast.warning(
          `${result.broken} Foto(s) nicht erreichbar — werden durch Platzhalter ersetzt.`,
          { duration: 7000 }
        );
      }
    } catch (err) {
      setPreflight({
        status: "error",
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      });
      toast.error("Foto-Prüfung fehlgeschlagen.");
    }
  }

  if (!enabled) return null;

  // Size-gate: if large PDF expected, require explicit checkbox
  const sizeGateBlocks = largeWarning && !sizeAcknowledged;

  // Preflight gating — run on mount of "done-but-no-preflight" state
  const canPreflight =
    publishablePages.length > 0 &&
    PdfComponent !== null &&
    preflight.status === "idle" &&
    !sizeGateBlocks;

  const canRender =
    publishablePages.length > 0 &&
    PdfComponent !== null &&
    preflight.status === "done";

  const pagesForPdf =
    preflight.status === "done" ? preflight.pages : publishablePages;
  const coverUrlForPdf =
    preflight.status === "done" && preflight.coverBroken
      ? null
      : event.cover_url ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={publishablePages.length === 0}
        >
          <FileText className="mr-1 h-4 w-4" aria-hidden="true" />
          Als PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tagebuch als PDF exportieren</DialogTitle>
          <DialogDescription>
            Wähle Format und Farbschema. Das PDF wird direkt im Browser
            generiert und heruntergeladen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Format */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Seitenformat</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as PdfFormat)}
              className="grid grid-cols-3 gap-2"
            >
              {PDF_FORMATS.map((f) => {
                const spec = PDF_FORMAT_SPECS[f];
                const aspect = spec.width / spec.height;
                return (
                  <Label
                    key={f}
                    htmlFor={`format-${f}`}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 p-3 text-center transition ${
                      format === f
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <RadioGroupItem
                      id={`format-${f}`}
                      value={f}
                      className="sr-only"
                    />
                    <div
                      className="border border-muted-foreground/40 bg-muted/40"
                      style={{
                        width: 28 * Math.min(1, aspect),
                        height: 28 / Math.max(1, aspect),
                      }}
                    />
                    <span className="text-xs font-medium">{spec.label}</span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Farbschema</Label>
            <RadioGroup
              value={theme}
              onValueChange={(v) => setTheme(v as PdfTheme)}
              className="grid grid-cols-3 gap-2"
            >
              {PDF_THEMES.map((t) => {
                const spec = PDF_THEME_SPECS[t];
                return (
                  <Label
                    key={t}
                    htmlFor={`theme-${t}`}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 p-3 text-center transition ${
                      theme === t
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <RadioGroupItem
                      id={`theme-${t}`}
                      value={t}
                      className="sr-only"
                    />
                    <div className="flex gap-1">
                      <div
                        className="h-6 w-3 rounded-sm border"
                        style={{ backgroundColor: spec.background }}
                      />
                      <div
                        className="h-6 w-3 rounded-sm"
                        style={{ backgroundColor: spec.accent }}
                      />
                      <div
                        className="h-6 w-3 rounded-sm"
                        style={{ backgroundColor: spec.text }}
                      />
                    </div>
                    <span className="text-xs font-medium">{spec.label}</span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Extra pages (opt-in) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Zusätzliche Seiten</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-about"
                  checked={includeAboutPage}
                  onCheckedChange={(v) => setIncludeAboutPage(v === true)}
                />
                <Label
                  htmlFor="opt-about"
                  className="cursor-pointer text-sm font-normal"
                >
                  Info-Box auf Cover (Beschreibung + Teilnehmer)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-toc"
                  checked={includeToc}
                  onCheckedChange={(v) => setIncludeToc(v === true)}
                />
                <Label
                  htmlFor="opt-toc"
                  className="cursor-pointer text-sm font-normal"
                >
                  Inhaltsverzeichnis
                </Label>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                {publishablePages.length}
              </span>{" "}
              Tage ·{" "}
              <span className="font-medium text-foreground">{photoCount}</span>{" "}
              Fotos/Videos · geschätzte Größe ca.{" "}
              <span className="font-medium text-foreground">
                {estimatedMb} MB
              </span>
            </p>
            {gridOverflowSections > 0 && (
              <p className="mt-1 text-amber-700 dark:text-amber-500">
                ℹ {gridOverflowSections} Raster-Seite(n) mit mehr als 12 Fotos —
                einzelne Bilder werden auf der Druckseite klein. Tipp: Teile
                den Tag im Editor in mehrere Seiten auf.
              </p>
            )}
            {largeWarning && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50 p-2 text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex-1 space-y-2">
                  <p className="font-medium">
                    Diese Datei wird groß (~{estimatedMb} MB)
                  </p>
                  <p className="text-[11px]">
                    Das Generieren dauert länger und kann auf dem iPhone
                    Speicher verbrauchen.
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium">
                    <Checkbox
                      checked={sizeAcknowledged}
                      onCheckedChange={(v) =>
                        setSizeAcknowledged(v === true)
                      }
                    />
                    Ich weiß Bescheid — trotzdem erstellen
                  </label>
                </div>
              </div>
            )}
            <p className="mt-1 text-[10px]">
              Format: {formatSpec.label} ({Math.round(formatSpec.width / 2.83)}{" "}
              × {Math.round(formatSpec.height / 2.83)} mm) · Thema:{" "}
              {themeSpec.label}
            </p>
          </div>

          {/* Preflight status banner */}
          {preflight.status === "running" && (
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              <span>
                Prüfe Fotos {preflight.done} / {preflight.total || "…"}
              </span>
            </div>
          )}
          {preflight.status === "done" && preflight.broken > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                {preflight.broken} Foto(s) nicht erreichbar — werden im PDF
                durch Platzhalter ersetzt.
              </span>
            </div>
          )}
          {preflight.status === "error" && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Foto-Prüfung fehlgeschlagen: {preflight.message}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="sm:mr-auto"
          >
            Abbrechen
          </Button>

          {/* State machine:
                idle    → "Fotos prüfen & PDF erstellen" (starts preflight)
                running → disabled "Prüfe Fotos… X / Y"
                done    → <PDFDownloadLink> with validated pages
                error   → "Erneut versuchen" */}
          {preflight.status === "idle" && (
            <Button
              onClick={runPreflight}
              disabled={!canPreflight}
              title={
                sizeGateBlocks
                  ? "Bitte die Größen-Warnung bestätigen"
                  : undefined
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Fotos prüfen & PDF erstellen
            </Button>
          )}

          {preflight.status === "running" && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Prüfe Fotos…
            </Button>
          )}

          {preflight.status === "error" && (
            <Button onClick={runPreflight} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
          )}

          {canRender && PdfComponent && preflight.status === "done" && (
            <PDFDownloadLink
              key={retryKey}
              document={
                <PdfComponent
                  eventName={event.name}
                  description={event.description ?? null}
                  coverUrl={coverUrlForPdf}
                  startDate={event.start_date ?? null}
                  endDate={event.end_date ?? null}
                  members={members}
                  pages={pagesForPdf}
                  format={format}
                  theme={theme}
                  includeAboutPage={includeAboutPage}
                  includeToc={includeToc}
                />
              }
              fileName={filename}
              style={{ textDecoration: "none" }}
            >
              {({ loading, error }) => {
                if (error) {
                  return (
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        setRetryKey((k) => k + 1);
                        setPreflight({ status: "idle" });
                      }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Erneut versuchen
                    </Button>
                  );
                }
                return (
                  <Button
                    disabled={loading}
                    onClick={() => {
                      if (!loading) {
                        toast.success("PDF wird heruntergeladen…");
                        if (isIosSafari()) {
                          toast.info(
                            "Auf dem iPhone öffnet sich das PDF oft in einem neuen Tab — über das Teilen-Symbol speichern.",
                            { duration: 8000 }
                          );
                        }
                      }
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Wird generiert…
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        PDF herunterladen
                      </>
                    )}
                  </Button>
                );
              }}
            </PDFDownloadLink>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
