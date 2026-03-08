"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  userId: string;
  currentName: string | null;
  onSaveComplete: (name: string | null) => void;
}

export function DisplayNameForm({
  userId,
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
      const supabase = createSupabaseBrowserClient();
      const displayName =
        values.display_name?.trim() || null;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId);

      if (updateError) {
        throw new Error(updateError.message);
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
                  Wird anderen Teilnehmern angezeigt. Leer lassen fuer
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
