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
          className="flex h-8 w-10 items-center justify-center rounded-sm border border-border p-0.5"
        >
          <div className={`h-full w-full ${boxClass}`} />
        </div>
      );
    case "two":
      return (
        <div
          aria-hidden="true"
          className="flex h-8 w-10 gap-0.5 rounded-sm border border-border p-0.5"
        >
          <div className={`h-full flex-1 ${boxClass}`} />
          <div className={`h-full flex-1 ${boxClass}`} />
        </div>
      );
    case "three":
      return (
        <div
          aria-hidden="true"
          className="flex h-8 w-10 gap-0.5 rounded-sm border border-border p-0.5"
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
          className="grid h-8 w-10 grid-cols-2 grid-rows-2 gap-0.5 rounded-sm border border-border p-0.5"
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
          className="flex h-8 w-10 flex-col gap-0.5 rounded-sm border border-border p-0.5"
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
          className="grid h-8 w-10 grid-cols-3 grid-rows-3 gap-[1px] rounded-sm border border-border p-0.5"
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
          className="flex h-8 w-10 gap-0.5 rounded-sm border border-border p-0.5"
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
    <div className="space-y-2">
      <Label className="font-display text-2xl font-bold text-foreground">
        Layout
      </Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as BookLayout)}
        disabled={disabled}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {BOOK_LAYOUTS.map((layout) => {
          const id = `book-layout-${layout}`;
          const selected = value === layout;
          return (
            <Label
              key={layout}
              htmlFor={id}
              className={`group flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
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
                <div className="text-sm font-medium text-foreground">
                  {BOOK_LAYOUT_LABELS[layout]}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
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
