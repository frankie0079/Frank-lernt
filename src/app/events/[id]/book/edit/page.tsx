"use client";

import { use } from "react";
import { BookEditor } from "@/components/book-editor";

interface BookEditPageProps {
  params: Promise<{ id: string }>;
}

export default function BookEditPage({ params }: BookEditPageProps) {
  const { id: eventId } = use(params);

  return (
    <div className="min-h-screen bg-background">
      <BookEditor eventId={eventId} />
    </div>
  );
}
