"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LinkIcon, AlertCircle } from "lucide-react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const redirect = searchParams.get("redirect");
  const hasInviteRedirect = redirect?.startsWith("/invite/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <LinkIcon className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl font-bold">EventDocs</CardTitle>
          <CardDescription>
            {hasInviteRedirect
              ? "Du wurdest zu einem Event eingeladen! Melde dich zuerst mit deinem persoenlichen Link an."
              : "Du brauchst einen persoenlichen Einladungslink vom Organisator."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error === "invalid_link" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Dieser Link ist ungueltig. Bitte frag den Organisator nach einem
                neuen Link.
              </AlertDescription>
            </Alert>
          )}

          {error === "rate_limited" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Zu viele Anfragen. Bitte warte einen Moment.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">So funktioniert&apos;s:</p>
            <ol className="space-y-1 text-left">
              <li>1. Der Organisator erstellt deinen Account</li>
              <li>2. Du bekommst einen Link per WhatsApp</li>
              <li>3. Link klicken — fertig!</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background" />
      }
    >
      <LoginContent />
    </Suspense>
  );
}
