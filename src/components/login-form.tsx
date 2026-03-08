"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, AlertCircle, Loader2, WifiOff } from "lucide-react";

type LoginState = "idle" | "loading" | "sent" | "error" | "expired" | "offline";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/events";

  // Check for error in URL (e.g., expired magic link)
  const urlError = searchParams.get("error");
  const urlErrorDescription = searchParams.get("error_description");

  const isExpiredLink =
    urlError === "access_denied" ||
    urlErrorDescription?.includes("expired") ||
    urlErrorDescription?.includes("abgelaufen");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!navigator.onLine) {
      setState("offline");
      return;
    }

    setState("loading");
    setErrorMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        },
      });

      if (error) {
        setState("error");
        setErrorMessage(error.message);
        return;
      }

      setState("sent");
    } catch {
      setState("error");
      setErrorMessage("Ein unerwarteter Fehler ist aufgetreten.");
    }
  };

  const handleResend = () => {
    setState("idle");
    setErrorMessage("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Bei EventDocs anmelden
          </CardTitle>
          <CardDescription>
            Wir senden dir einen Magic Link per Email — kein Passwort noetig.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Expired Magic Link Warning */}
          {(isExpiredLink || state === "expired") && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Dieser Link ist abgelaufen. Fordere einen neuen Link an.
              </AlertDescription>
            </Alert>
          )}

          {/* Offline Warning */}
          {state === "offline" && (
            <Alert variant="destructive" className="mb-4">
              <WifiOff className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Keine Internetverbindung — Magic Link benoetigt Internet.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {state === "error" && errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {state === "sent" ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle
                  className="h-6 w-6 text-green-600"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Magic Link wurde gesendet!
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pruefe dein Postfach fuer{" "}
                  <span className="font-medium">{email}</span> und klicke den
                  Link.
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={handleResend}
              >
                Neuen Link anfordern
              </Button>
            </div>
          ) : (
            /* Email Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  Email-Adresse
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="deine@email.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  disabled={state === "loading"}
                  aria-label="Email-Adresse eingeben"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={state === "loading" || !email.trim()}
              >
                {state === "loading" ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Link wird gesendet...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                    Magic Link senden
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
