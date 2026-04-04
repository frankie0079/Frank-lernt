"use client";

import { useEffect, useRef, useReducer } from "react";
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
  const { member, loading: authLoading } = useAuth();
  const token = params.token as string;

  const [state, dispatch] = useReducer(reducer, {
    status: "idle",
    eventName: null,
    eventId: null,
    errorMessage: null,
  });

  const hasAttempted = useRef(false);

  // Derive not_logged_in state
  const isNotLoggedIn = !authLoading && !member;
  const isLoading = authLoading || state.status === "idle";

  useEffect(() => {
    if (authLoading) return;

    if (!member) {
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    if (hasAttempted.current) return;
    hasAttempted.current = true;

    // Check online status
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      dispatch({ type: "OFFLINE" });
      return;
    }

    dispatch({ type: "JOIN_START" });

    fetch(`/api/invite/${token}`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);

        if (res.ok) {
          if (data?.already_member) {
            dispatch({ type: "ALREADY_MEMBER", eventName: data?.event_name ?? null, eventId: data.event_id });
            toast.info("Du bist bereits Mitglied dieses Events.");
            setTimeout(() => router.push(`/events/${data.event_id}`), 2000);
          } else {
            dispatch({ type: "JOIN_SUCCESS", eventName: data?.event_name ?? null, eventId: data.event_id });
            toast.success("Du bist dem Event beigetreten!");
            setTimeout(() => router.push(`/events/${data.event_id}`), 2000);
          }
          return;
        }

        if (res.status === 401) {
          router.push(`/login?redirect=/invite/${token}`);
          return;
        }
        if (res.status === 404) { dispatch({ type: "INVALID" }); return; }
        if (res.status === 410) { dispatch({ type: "EXPIRED" }); return; }
        if (res.status === 409) {
          dispatch({ type: "ALREADY_MEMBER", eventName: data?.event_name ?? null, eventId: data?.event_id ?? "" });
          if (data?.event_id) setTimeout(() => router.push(`/events/${data.event_id}`), 2000);
          return;
        }
        if (res.status === 422 && data?.error?.includes("50")) { dispatch({ type: "FULL" }); return; }

        dispatch({ type: "ERROR", message: data?.error || "Ein Fehler ist aufgetreten." });
      })
      .catch(() => {
        dispatch({ type: "ERROR", message: "Verbindungsfehler. Bitte pruefe deine Internetverbindung." });
      });
  }, [authLoading, member, token, router]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (state.status === "offline") {
        hasAttempted.current = false;
        dispatch({ type: "RESET" });
        // Trigger re-attempt by reloading
        window.location.reload();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [state.status]);

  const { status, eventName } = state;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            {isLoading || status === "joining" ? (
              <Loader2
                className="h-7 w-7 text-primary animate-spin"
                aria-hidden="true"
              />
            ) : status === "success" || status === "already_member" ? (
              <CheckCircle
                className="h-7 w-7 text-primary"
                aria-hidden="true"
              />
            ) : status === "expired" ? (
              <Clock
                className="h-7 w-7 text-muted-foreground"
                aria-hidden="true"
              />
            ) : status === "offline" ? (
              <WifiOff
                className="h-7 w-7 text-muted-foreground"
                aria-hidden="true"
              />
            ) : status === "invalid" || status === "full" || status === "error" ? (
              <XCircle
                className="h-7 w-7 text-destructive"
                aria-hidden="true"
              />
            ) : (
              <LinkIcon
                className="h-7 w-7 text-primary"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Title based on state */}
          {(isLoading || status === "joining") && (
            <>
              <CardTitle className="text-xl">Einladung wird verarbeitet...</CardTitle>
              <CardDescription>Bitte warte einen Moment.</CardDescription>
            </>
          )}
          {status === "success" && (
            <>
              <CardTitle className="text-xl">Willkommen!</CardTitle>
              <CardDescription>
                Du bist {eventName ? `"${eventName}"` : "dem Event"} beigetreten.
                Du wirst gleich weitergeleitet...
              </CardDescription>
            </>
          )}
          {status === "already_member" && (
            <>
              <CardTitle className="text-xl">Bereits Mitglied</CardTitle>
              <CardDescription>
                Du bist bereits Mitglied {eventName ? `von "${eventName}"` : "dieses Events"}.
                Du wirst gleich weitergeleitet...
              </CardDescription>
            </>
          )}
          {status === "expired" && (
            <>
              <CardTitle className="text-xl">Einladung abgelaufen</CardTitle>
              <CardDescription>
                Diese Einladung ist nicht mehr gueltig. Bitte den Organisator um
                einen neuen Link.
              </CardDescription>
            </>
          )}
          {status === "invalid" && (
            <>
              <CardTitle className="text-xl">Ungueltiger Link</CardTitle>
              <CardDescription>
                Dieser Einladungslink ist ungueltig. Pruefe den Link oder frag
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
          {isNotLoggedIn && status === "idle" && (
            <>
              <CardTitle className="text-xl">Anmeldung erforderlich</CardTitle>
              <CardDescription>
                Du wirst zur Anmeldeseite weitergeleitet...
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {/* Loading spinner */}
          {(isLoading || status === "joining" || isNotLoggedIn) && (
            <div className="flex justify-center py-4">
              <Skeleton className="h-2 w-48 rounded-full" />
            </div>
          )}

          {/* Success: progress indicator */}
          {(status === "success" || status === "already_member") && (
            <div className="flex justify-center py-4">
              <Loader2
                className="h-5 w-5 animate-spin text-primary"
                aria-hidden="true"
              />
            </div>
          )}

          {/* Error actions */}
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

          {/* Offline: retry */}
          {status === "offline" && (
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Erneut versuchen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
