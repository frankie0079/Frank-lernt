import { notFound } from "next/navigation";
import { ArchiveBookView } from "@/components/archive-book-view";
import { getPrivateArchiveBook } from "@/lib/archive-data";

export const dynamic = "force-dynamic";

export default async function PrivateArchiveBookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const book = await getPrivateArchiveBook(token);

  if (!book) notFound();

  return <ArchiveBookView event={book.event} pages={book.pages} />;
}
