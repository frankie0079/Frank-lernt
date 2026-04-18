"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileFormValues } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, AlertCircle } from "lucide-react";

interface DisplayNameFormProps {
  memberId: string;
  currentName: string | null;
  onSaveComplete: (name: string | null) => void;
}

export function DisplayNameForm({
  memberId: _memberId,
  currentName,
  onSaveComplete,
}: DisplayNameFormProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: currentName ?? "",
    },
  });

  const watchName = form.watch("display_name") ?? "";
  const charCount = watchName.length;

  const onSubmit = async (values: ProfileFormValues) => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const displayName = values.display_name?.trim() || null;

      // Update own profile via secure API (server validates token)
      const res = await fetch("/api/members/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Speichern fehlgeschlagen");
      }

      setSaved(true);
      onSaveComplete(displayName);

      // Reset saved indicator after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Speichern fehlgeschlagen."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="display_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Anzeigename</FormLabel>
              <FormControl>
                <Input
                  placeholder="Dein Name"
                  maxLength={50}
                  autoComplete="name"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <div className="flex items-center justify-between">
                <FormDescription>
                  Wird anderen Teilnehmern angezeigt. Leer lassen für
                  &quot;Anonym&quot;.
                </FormDescription>
                <span
                  className={`text-xs ${charCount > 45 ? "text-destructive" : "text-muted-foreground"}`}
                  aria-label={`${charCount} von 50 Zeichen`}
                >
                  {charCount}/50
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Speichern...
            </>
          ) : saved ? (
            <>
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              Gespeichert!
            </>
          ) : (
            "Speichern"
          )}
        </Button>
      </form>
    </Form>
  );
}
