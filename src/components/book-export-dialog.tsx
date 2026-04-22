"use client";

// PROJ-37: Export dialog for the Tagebuch PDF. Format + theme picker, client-
// side PDF generation via @react-pdf/renderer.

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Download, FileText, Loader2 } from "lucide-react";
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

  // Fetch members lazily on first open (for back page)
  useEffect(() => {
    if (!open || membersLoaded) return;
    fetch(`/api/events/${eventId}/members`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.members) {
          setMembers(
            data.members.map((m: { member_id: string; member_name: string | null; member_avatar_url: string | null }) => ({
              id: m.member_id,
              name: m.member_name || "Unbekannt",
              avatar_url: m.member_avatar_url,
            }))
          );
        }
        setMembersLoaded(true);
      })
      .catch(() => setMembersLoaded(true));
  }, [open, membersLoaded, eventId]);

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
            (s, sec) => s + sec.items.filter((i) => i.type === "photo" || i.type === "video").length,
            0
          ),
        0
      ),
    [publishablePages]
  );

  const estimatedMb = Math.max(1, Math.round(photoCount * 0.4));
  const largeWarning = estimatedMb > 40;

  const filename = sanitizeFilename(event.name);
  const formatSpec = PDF_FORMAT_SPECS[format];
  const themeSpec = PDF_THEME_SPECS[theme];

  const canRender = publishablePages.length > 0 && PdfComponent !== null;

  if (!enabled) return null;

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
            {largeWarning && (
              <p className="mt-1 text-amber-700 dark:text-amber-500">
                ⚠ Diese Datei könnte sehr groß werden. Die Generierung dauert
                länger und kann auf dem iPhone Speicher verbrauchen.
              </p>
            )}
            <p className="mt-1 text-[10px]">
              Format: {formatSpec.label} ({Math.round(formatSpec.width / 2.83)} ×{" "}
              {Math.round(formatSpec.height / 2.83)} mm) · Thema:{" "}
              {themeSpec.label}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="sm:mr-auto"
          >
            Abbrechen
          </Button>

          {canRender && PdfComponent ? (
            <PDFDownloadLink
              document={
                <PdfComponent
                  eventName={event.name}
                  description={event.description ?? null}
                  coverUrl={event.cover_url ?? null}
                  startDate={event.start_date ?? null}
                  endDate={event.end_date ?? null}
                  members={members}
                  pages={publishablePages}
                  format={format}
                  theme={theme}
                  includeAboutPage={includeAboutPage}
                  includeToc={includeToc}
                />
              }
              fileName={filename}
              style={{ textDecoration: "none" }}
            >
              {({ loading, error }) => (
                <Button
                  disabled={loading}
                  onClick={() => {
                    if (!loading && !error) {
                      toast.success("PDF wird heruntergeladen…");
                    } else if (error) {
                      toast.error(
                        "PDF-Generierung fehlgeschlagen — bitte Seite neu laden."
                      );
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
              )}
            </PDFDownloadLink>
          ) : (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird vorbereitet…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
