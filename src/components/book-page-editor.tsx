"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Check, Eye, Loader2, Plus } from "lucide-react";
import type { AgendaItem } from "@/lib/event-utils";
import {
  BookSectionEditor,
  type SectionDraft,
  sectionToDraft,
  emptyDraft,
  draftToSectionPayload,
} from "@/components/book-section-editor";
import {
  MAX_COMMENT_LENGTH,
  MAX_SECTIONS_PER_PAGE,
  type BookPage,
  type BookPutResponse,
} from "@/lib/book-types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface BookPageEditorProps {
  eventId: string;
  userId: string;
  isOrganizer: boolean;
  agendaItems: AgendaItem[];
  page: BookPage;
  /** Fires after a successful save so the parent can refresh its summary */
  onSaved: (updated: BookPage) => void;
  /** Opens `/events/[id]/book?preview=true` in a new tab */
  onOpenPreview: () => void;
}

function pageSectionsToDrafts(page: BookPage): SectionDraft[] {
  const existing = (page.sections || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(sectionToDraft);
  if (existing.length === 0) {
    // Start with a single empty section so the editor always has something
    // to show; if the user saves without adding anything, the server will
    // accept an empty-sections state thanks to comment defaulting to ''.
    return [emptyDraft(0)];
  }
  return existing;
}

export function BookPageEditor({
  eventId,
  userId,
  isOrganizer,
  agendaItems,
  page,
  onSaved,
  onOpenPreview,
}: BookPageEditorProps) {
  // ---- local editable state ----
  const [sections, setSections] = useState<SectionDraft[]>(() =>
    pageSectionsToDrafts(page)
  );
  const [isVisible, setIsVisible] = useState<boolean>(page.is_visible);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Re-seeded on remount (BookEditor key={agenda_item_id}), no manual effect
  // needed here.

  const saveGenRef = useRef(0);

  // ---- derived flags ----
  const anyCommentTooLong = sections.some(
    (s) => s.comment.length > MAX_COMMENT_LENGTH
  );
  const tooManySections = sections.length > MAX_SECTIONS_PER_PAGE;

  // ---- Save ----
  const performSave = useCallback(
    async (payload: {
      is_visible: boolean;
      drafts: SectionDraft[];
    }) => {
      if (!isOrganizer) return;
      if (payload.drafts.some((s) => s.comment.length > MAX_COMMENT_LENGTH))
        return;

      const generation = ++saveGenRef.current;
      setSaveState("saving");
      setErrorMsg(null);

      try {
        const res = await fetch(
          `/api/events/${eventId}/book/${page.agenda_item_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              is_visible: payload.is_visible,
              sections: draftToSectionPayload(payload.drafts),
            }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Speichern fehlgeschlagen");
        }
        const data = (await res.json()) as BookPutResponse;
        if (generation !== saveGenRef.current) return;
        setSaveState("saved");
        onSaved(data.page);
      } catch (err) {
        if (generation !== saveGenRef.current) return;
        setSaveState("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Speichern fehlgeschlagen"
        );
      }
    },
    [eventId, page.agenda_item_id, isOrganizer, onSaved]
  );

  const debouncedSave = useDebouncedCallback(
    (args: { is_visible: boolean; drafts: SectionDraft[] }) =>
      performSave(args),
    2000
  );

  // Skip auto-save on initial render.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (anyCommentTooLong) return;
    debouncedSave({ is_visible: isVisible, drafts: sections });
  }, [sections, isVisible, anyCommentTooLong, debouncedSave]);

  const manualSave = useCallback(async () => {
    debouncedSave.cancel();
    await performSave({ is_visible: isVisible, drafts: sections });
  }, [debouncedSave, performSave, isVisible, sections]);

  // ---- section array ops ----
  const updateSection = useCallback((idx: number, next: SectionDraft) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? next : s)));
  }, []);

  const addSection = useCallback(() => {
    setSections((prev) => [...prev, emptyDraft(prev.length)]);
  }, []);

  const deleteSection = useCallback((idx: number) => {
    setSections((prev) => {
      if (prev.length <= 1) {
        // Never leave the page with zero sections — reset to one empty draft.
        return [emptyDraft(0)];
      }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const moveSection = useCallback((idx: number, dir: -1 | 1) => {
    setSections((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }, []);

  // ---- collaborator hint ----
  const collaboratorHint = page.updated_by_name
    ? `Zuletzt gespeichert von ${page.updated_by_name}${
        page.updated_at
          ? ` am ${new Date(page.updated_at).toLocaleString("de-DE", {
              dateStyle: "short",
              timeStyle: "short",
            })}`
          : ""
      }`
    : null;

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      {/* Top status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <SaveBadge state={saveState} tooLong={anyCommentTooLong} />
        <div className="flex items-center gap-2">
          {saveState === "error" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={manualSave}
            >
              Jetzt speichern
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              debouncedSave.flush();
              onOpenPreview();
            }}
            aria-label="Vorschau im neuen Tab öffnen"
          >
            <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
            Vorschau
          </Button>
        </div>
      </div>

      {errorMsg && saveState === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {collaboratorHint && (
        <p className="text-xs text-muted-foreground">{collaboratorHint}</p>
      )}

      {/* Visibility toggle (page-level) */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="min-w-0">
          <Label
            htmlFor="book-page-visible"
            className="cursor-pointer text-sm font-semibold text-foreground"
          >
            Diesen Tag zeigen
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ausgeblendete Tage erscheinen in der Leseansicht nur als
            Platzhalter mit Datum und Titel — alle Seiten dieses Tages sind
            dann versteckt.
          </p>
        </div>
        <Switch
          id="book-page-visible"
          checked={isVisible}
          onCheckedChange={setIsVisible}
          disabled={!isOrganizer}
          aria-label="Diesen Tag in der Leseansicht anzeigen"
        />
      </div>

      {/* Sections list */}
      <div id="book-sections-top" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xl font-semibold text-foreground sm:font-display sm:text-2xl sm:font-bold">
            Seiten dieses Tages
          </Label>
          <span className="text-xs text-muted-foreground">
            {sections.length} / {MAX_SECTIONS_PER_PAGE}
          </span>
        </div>

        {tooManySections && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              Maximal {MAX_SECTIONS_PER_PAGE} Seiten pro Tag. Bitte entferne
              eine, bevor du eine weitere hinzufügst.
            </AlertDescription>
          </Alert>
        )}

        {sections.map((sec, idx) => (
          <BookSectionEditor
            key={sec.id || `draft-${idx}`}
            eventId={eventId}
            userId={userId}
            isOrganizer={isOrganizer}
            agendaItems={agendaItems}
            dayAgendaItemId={page.agenda_item_id}
            index={idx}
            section={sec}
            canMoveUp={idx > 0}
            canMoveDown={idx < sections.length - 1}
            onChange={(next) => updateSection(idx, next)}
            onMoveUp={() => moveSection(idx, -1)}
            onMoveDown={() => moveSection(idx, 1)}
            onDelete={() => deleteSection(idx)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSection}
          disabled={!isOrganizer || sections.length >= MAX_SECTIONS_PER_PAGE}
          className="w-full"
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          Seite hinzufügen
        </Button>
      </div>

      <div className="sticky bottom-3 z-30 flex gap-2 rounded-lg border border-border bg-card/95 p-2 shadow-lg backdrop-blur md:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() =>
            document
              .getElementById("book-sections-top")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          ↑ Seiten
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => {
            debouncedSave.flush();
            onOpenPreview();
          }}
        >
          Vorschau
        </Button>
      </div>
    </div>
  );
}

function SaveBadge({
  state,
  tooLong,
}: {
  state: SaveState;
  tooLong: boolean;
}) {
  if (tooLong) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Auto-Save pausiert — Kommentar zu lang
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Speichere…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check className="h-3 w-3" aria-hidden="true" />
        Gespeichert
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Nicht gespeichert
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Bereit</span>;
}
