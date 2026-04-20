"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { BookReadView } from "@/components/book-read-view";
import { Skeleton } from "@/components/ui/skeleton";

interface BookReadPageProps {
  params: Promise<{ id: string }>;
}

function BookReadContent({ eventId }: { eventId: string }) {
  const searchParams = useSearchParams();
  const preview = searchParams.get("preview") === "true";
  return <BookReadView eventId={eventId} preview={preview} />;
}

export default function BookReadPage({ params }: BookReadPageProps) {
  const { id: eventId } = use(params);

  return (
    <div className="min-h-screen bg-background">
      <Suspense
        fallback={
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <BookReadContent eventId={eventId} />
      </Suspense>
    </div>
  );
}
