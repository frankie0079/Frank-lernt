import { notFound } from "next/navigation";
import { ArchiveBookView } from "@/components/archive-book-view";
import { getCommunityArchiveBook } from "@/lib/archive-data";

export const dynamic = "force-dynamic";

export default async function CommunityArchiveBookPage({
  params,
}: {
  params: Promise<{ token: string; slug: string }>;
}) {
  const { token, slug } = await params;
  const book = await getCommunityArchiveBook(token, slug);

  if (!book) notFound();

  return (
    <ArchiveBookView
      event={book.event}
      pages={book.pages}
      backHref={`/archiv/${token}`}
      backLabel="Alle Wandervögel-Events"
    />
  );
}
