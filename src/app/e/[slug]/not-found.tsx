// PROJ-35: 404 page for /e/[slug]

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function EventNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="max-w-md p-8 text-center">
        <Compass
          className="mx-auto h-12 w-12 text-muted-foreground"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-2xl font-bold">Event nicht gefunden</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vielleicht wurde die URL falsch kopiert oder das Event wurde
          entfernt.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Zur Startseite</Link>
        </Button>
      </Card>
    </main>
  );
}
