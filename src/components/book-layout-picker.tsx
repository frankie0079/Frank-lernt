"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  BOOK_LAYOUTS,
  BOOK_LAYOUT_DESCRIPTIONS,
  BOOK_LAYOUT_LABELS,
  type BookLayout,
} from "@/lib/book-types";

interface BookLayoutPickerProps {
  value: BookLayout;
  onChange: (layout: BookLayout) => void;
  disabled?: boolean;
}

/**
 * Tiny schematic preview of each layout — rendered inline next to the label
 * so the organizer can pick visually instead of by label alone.
 */
function LayoutPreview({ layout }: { layout: BookLayout }) {
  const boxClass =
    "rounded-[2px] bg-muted-foreground/40 transition-colors group-data-[state=checked]:bg-primary";

  switch (layout) {
    case "single":
      return (
        <div
          aria-hidden="true"
          className="flex h-7 w-8 shrink-0 items-center justify-center rounded-sm border border-border p-0.5 sm:h-8 sm:w-10"
        >
          <div className={`h-full w-full ${boxClass}`} />
        </div>
      );
    case "two":
      return (
        <div
          aria-hidden="true"
          className="flex h-7 w-8 shrink-0 gap-0.5 rounded-sm border border-border p-0.5 sm:h-8 sm:w-10"
        >
          <div className={`h-full flex-1 ${boxClass}`} />
          <div className={`h-full flex-1 ${boxClass}`} />
        </div>
      );
    case "three":
      return (
        <div
          aria-hidden="true"
          className="flex h-7 w-8 shrink-0 gap-0.5 rounded-sm border border-border p-0.5 sm:h-8 sm:w-10"
        >
          <div className={`h-full flex-1 ${boxClass}`} />
          <div className={`h-full flex-1 ${boxClass}`} />
          <div className={`h-full flex-1 ${boxClass}`} />
        </div>
      );
    case "four":
      return (
        <div
          aria-hidden="true"
          className="grid h-7 w-8 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 rounded-sm border border-border p-0.5 sm:h-8 sm:w-10"
        >
          <div className={boxClass} />
          <div className={boxClass} />
          <div className={boxClass} />
          <div className={boxClass} />
        </div>
      );
    case "five-hero":
      return (
        <div
          aria-hidden="true"
          className="flex h-7 w-8 shrink-0 flex-col gap-0.5 rounded-sm border border-border p-0.5 sm:h-8 sm:w-10"
        >
          <div className={`h-3 w-full ${boxClass}`} />
          <div className="grid flex-1 grid-cols-2 gap-0.5">
            <div className={boxClass} />
            <div className={boxClass} />
            <div className={boxClass} />
            <div className={boxClass} />
          </div>
        </div>
      );
    case "grid-3":
      return (
        <div
          aria-hidden="true"
          className="grid h-7 w-8 shrink-0 grid-cols-3 grid-rows-3 gap-[1px] rounded-sm border border-border p-0.5 sm:h-8 sm:w-10"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={boxClass} />
          ))}
        </div>
      );
    case "text-left":
      return (
        <div
          aria-hidden="true"
          className="flex h-7 w-8 shrink-0 gap-0.5 rounded-sm border border-border p-0.5 sm:h-8 sm:w-10"
        >
          <div className="flex h-full flex-1 flex-col justify-center gap-0.5">
            <div className={`h-[2px] w-full ${boxClass}`} />
            <div className={`h-[2px] w-4/5 ${boxClass}`} />
            <div className={`h-[2px] w-3/5 ${boxClass}`} />
          </div>
          <div className={`h-full flex-1 ${boxClass}`} />
        </div>
      );
  }
}

export function BookLayoutPicker({
  value,
  onChange,
  disabled,
}: BookLayoutPickerProps) {
  return (
    <div className="min-w-0 space-y-2">
      <Label className="text-base font-semibold text-foreground sm:font-display sm:text-2xl sm:font-bold">
        Layout
      </Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as BookLayout)}
        disabled={disabled}
        className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2"
      >
        {BOOK_LAYOUTS.map((layout) => {
          const id = `book-layout-${layout}`;
          const selected = value === layout;
          return (
            <Label
              key={layout}
              htmlFor={id}
              className={`group flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors sm:gap-3 sm:p-3 ${
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <RadioGroupItem
                value={layout}
                id={id}
                className="shrink-0"
                data-state={selected ? "checked" : "unchecked"}
              />
              <LayoutPreview layout={layout} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-tight text-foreground sm:font-medium">
                  {BOOK_LAYOUT_LABELS[layout]}
                </div>
                <div className="mt-0.5 whitespace-normal text-[11px] leading-tight text-muted-foreground sm:text-xs">
                  {BOOK_LAYOUT_DESCRIPTIONS[layout]}
                </div>
              </div>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
