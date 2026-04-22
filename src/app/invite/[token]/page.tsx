"use client";

import { useEffect, useRef, useReducer, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  LinkIcon,
  WifiOff,
} from "lucide-react";

type InviteStatus =
  | "idle"
  | "name_required"
  | "joining"
  | "success"
  | "already_member"
  | "expired"
  | "invalid"
  | "full"
  | "error"
  | "offline";

interface InvitePageState {
  status: InviteStatus;
  eventName: string | null;
  eventId: string | null;
  errorMessage: string | null;
}

type Action =
  | { type: "JOIN_START" }
  | { type: "NAME_REQUIRED" }
  | { type: "JOIN_SUCCESS"; eventName: string | null; eventId: string }
  | { type: "ALREADY_MEMBER"; eventName: string | null; eventId: string }
  | { type: "EXPIRED" }
  | { type: "INVALID" }
  | { type: "FULL" }
  | { type: "ERROR"; message: string }
  | { type: "OFFLINE" }
  | { type: "RESET" };

function reducer(state: InvitePageState, action: Action): InvitePageState {
  switch (action.type) {
    case "JOIN_START":
      return { ...state, status: "joining" };
    case "NAME_REQUIRED":
      return { ...state, status: "name_required" };
    case "JOIN_SUCCESS":
      return { ...state, status: "success", eventName: action.eventName, eventId: action.eventId };
    case "ALREADY_MEMBER":
      return { ...state, status: "already_member", eventName: action.eventName, eventId: action.eventId };
    case "EXPIRED":
      return { ...state, status: "expired" };
    case "INVALID":
      return { ...state, status: "invalid" };
    case "FULL":
      return { ...state, status: "full" };
    case "ERROR":
      return { ...state, status: "error", errorMessage: action.message };
    case "OFFLINE":
      return { ...state, status: "offline" };
    case "RESET":
      return { ...state, status: "idle" };
    default:
      return state;
  }
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { member, loading: authLoading, refreshMember } = useAuth();
  const token = params.token as string;

  const [state, dispatch] = useReducer(reducer, {
    status: "idle",
    eventName: null,
    eventId: null,
    errorMessage: null,
  });

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const hasAttempted = useRef(false);

  const attemptJoin = async (payload: { name?: string } = {}) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      dispatch({ type: "OFFLINE" });
      return;
    }
    dispatch({ type: "JOIN_START" });
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: payload.name ? { "Content-Type": "application/json" } : undefined,
        body: payload.name ? JSON.stringify({ name: payload.name }) : undefined,
      });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        // If we just created a new member, refresh the auth context so the
        // rest of the app picks up the new cookie.
        if (payload.name) {
          try {
            await refreshMember();
          } catch {
            /* non-fatal */
          }
        }
        if (data?.already_member) {
          dispatch({
            type: "ALREADY_MEMBER",
            eventName: data?.event_name ?? null,
            eventId: data.event_id,
          });
          toast.info("Du bist bereits Mitglied dieses Events.");
          setTimeout(() => router.push(`/events/${data.event_id}`), 1500);
        } else {
          dispatch({
            type: "JOIN_SUCCESS",
            eventName: data?.event_name ?? null,
            eventId: data.event_id,
          });
          toast.success("Willkommen! Du bist dem Event beigetreten.");
          setTimeout(() => router.push(`/events/${data.event_id}`), 1500);
        }
        return;
      }

      if (res.status === 400 && data?.code === "name_required") {
        dispatch({ type: "NAME_REQUIRED" });
        return;
      }
      if (res.status === 404) {
        dispatch({ type: "INVALID" });
        return;
      }
      if (res.status === 410) {
        dispatch({ type: "EXPIRED" });
        return;
      }
      if (res.status === 422 && data?.error?.includes("50")) {
        dispatch({ type: "FULL" });
        return;
      }
      dispatch({
        type: "ERROR",
        message: data?.error || "Ein Fehler ist aufgetreten.",
      });
    } catch {
      dispatch({
        type: "ERROR",
        message: "Verbindungsfehler. Bitte pruefe deine Internetverbindung.",
      });
    }
  };

  // First-contact flow: when auth-loading finishes, fire one join attempt.
  // For returning members (cookie) the API joins them directly. For new
  // users the API returns 400 / name_required and we flip to the name form.
  useEffect(() => {
    if (authLoading) return;
    if (hasAttempted.current) return;
    hasAttempted.current = true;
    attemptJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (state.status === "offline") {
        hasAttempted.current = false;
        dispatch({ type: "RESET" });
        window.location.reload();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [state.status]);

  const handleSubmitName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await attemptJoin({ name: trimmed });
    } finally {
      setSubmitting(false);
    }
  };

  const { status, eventName } = state;
  const isLoading = authLoading || status === "idle";
  // If the user is already logged in, `member` will be set and we just wait
  // for the direct-join attempt — no name form needed.
  const showNameForm = status === "name_required" && !member;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            {isLoading || status === "joining" ? (
              <Loader2 className="h-7 w-7 text-primary animate-spin" aria-hidden="true" />
            ) : status === "success" || status === "already_member" ? (
              <CheckCircle className="h-7 w-7 text-primary" aria-hidden="true" />
            ) : status === "expired" ? (
              <Clock className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            ) : status === "offline" ? (
              <WifiOff className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            ) : status === "invalid" || status === "full" || status === "error" ? (
              <XCircle className="h-7 w-7 text-destructive" aria-hidden="true" />
            ) : (
              <LinkIcon className="h-7 w-7 text-primary" aria-hidden="true" />
            )}
          </div>

          {(isLoading || status === "joining") && (
            <>
              <CardTitle className="text-xl">Einladung wird verarbeitet…</CardTitle>
              <CardDescription>Bitte warte einen Moment.</CardDescription>
            </>
          )}
          {showNameForm && (
            <>
              <CardTitle className="text-xl">Willkommen!</CardTitle>
              <CardDescription>
                Du wurdest zu einem Event eingeladen. Wie sollen dich die
                anderen Teilnehmer sehen?
              </CardDescription>
            </>
          )}
          {status === "success" && (
            <>
              <CardTitle className="text-xl">Willkommen!</CardTitle>
              <CardDescription>
                Du bist {eventName ? `"${eventName}"` : "dem Event"} beigetreten.
                Du wirst gleich weitergeleitet…
              </CardDescription>
            </>
          )}
          {status === "already_member" && (
            <>
              <CardTitle className="text-xl">Bereits Mitglied</CardTitle>
              <CardDescription>
                Du bist bereits Mitglied {eventName ? `von "${eventName}"` : "dieses Events"}.
                Du wirst gleich weitergeleitet…
              </CardDescription>
            </>
          )}
          {status === "expired" && (
            <>
              <CardTitle className="text-xl">Einladung abgelaufen</CardTitle>
              <CardDescription>
                Diese Einladung ist nicht mehr gültig. Bitte den Organisator um
                einen neuen Link.
              </CardDescription>
            </>
          )}
          {status === "invalid" && (
            <>
              <CardTitle className="text-xl">Ungültiger Link</CardTitle>
              <CardDescription>
                Dieser Einladungslink ist ungültig. Prüfe den Link oder frag
                den Organisator nach einem neuen.
              </CardDescription>
            </>
          )}
          {status === "full" && (
            <>
              <CardTitle className="text-xl">Event ist voll</CardTitle>
              <CardDescription>
                Maximale Teilnehmerzahl (50) erreicht. Kontaktiere den
                Organisator.
              </CardDescription>
            </>
          )}
          {status === "offline" && (
            <>
              <CardTitle className="text-xl">Keine Internetverbindung</CardTitle>
              <CardDescription>
                Bitte verbinde dich mit dem Internet und versuche es erneut.
              </CardDescription>
            </>
          )}
          {status === "error" && (
            <>
              <CardTitle className="text-xl">Fehler</CardTitle>
              <CardDescription>
                {state.errorMessage || "Ein unerwarteter Fehler ist aufgetreten."}
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {showNameForm && (
            <form onSubmit={handleSubmitName} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Dein Name</Label>
                <Input
                  id="invite-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Max Mustermann"
                  maxLength={50}
                  autoFocus
                  required
                  disabled={submitting}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !name.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Trete bei…
                  </>
                ) : (
                  "Dem Event beitreten"
                )}
              </Button>
            </form>
          )}

          {(isLoading || status === "joining") && (
            <div className="flex justify-center py-4">
              <Skeleton className="h-2 w-48 rounded-full" />
            </div>
          )}

          {(status === "success" || status === "already_member") && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            </div>
          )}

          {(status === "expired" || status === "invalid" || status === "full" || status === "error") && (
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => router.push("/events")}
                className="w-full"
              >
                Zu meinen Events
              </Button>
            </div>
          )}

          {status === "offline" && (
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => window.location.reload()} className="w-full">
                Erneut versuchen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
