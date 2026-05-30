import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { BookPage, BookPageItem, BookSection } from "@/lib/book-types";

export type ArchiveVisibility = "draft" | "community" | "private";

export interface ArchiveEvent {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  cover_url: string | null;
  cover_position: string | null;
  cover_scale: number | null;
  slug: string;
  archive_visibility: ArchiveVisibility;
  archive_published_at: string | null;
  archive_token: string;
  member_count?: number;
}

export interface ArchiveBook {
  event: ArchiveEvent;
  pages: BookPage[];
}

export async function getCommunityArchiveToken(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("archive_access_tokens")
    .select("token")
    .eq("scope", "community")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[archive] community token lookup failed", error);
    return null;
  }
  return data?.token ?? null;
}

export async function isValidCommunityArchiveToken(token: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("archive_access_tokens")
    .select("id")
    .eq("scope", "community")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[archive] token validation failed", error);
    return false;
  }
  return !!data;
}

export async function getCommunityArchiveEvents(
  token: string
): Promise<ArchiveEvent[] | null> {
  if (!(await isValidCommunityArchiveToken(token))) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, name, description, start_date, end_date, cover_url, cover_position, cover_scale, slug, archive_visibility, archive_published_at, archive_token"
    )
    .eq("archive_visibility", "community")
    .not("archive_published_at", "is", null)
    .order("start_date", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[archive] event list failed", error);
    return [];
  }

  const events = (data ?? []) as ArchiveEvent[];
  if (events.length === 0) return [];

  const { data: memberships } = await supabase
    .from("event_members")
    .select("event_id")
    .in(
      "event_id",
      events.map((event) => event.id)
    );

  const counts: Record<string, number> = {};
  for (const row of memberships ?? []) {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  }

  return events.map((event) => ({
    ...event,
    member_count: counts[event.id] ?? 0,
  }));
}

export async function getCommunityArchiveBook(
  token: string,
  slug: string
): Promise<ArchiveBook | null> {
  if (!(await isValidCommunityArchiveToken(token))) return null;

  const supabase = getSupabaseAdmin();
  const { data: event, error } = await supabase
    .from("events")
    .select(
      "id, name, description, start_date, end_date, cover_url, cover_position, cover_scale, slug, archive_visibility, archive_published_at, archive_token"
    )
    .eq("slug", slug)
    .eq("archive_visibility", "community")
    .not("archive_published_at", "is", null)
    .maybeSingle();

  if (error || !event) return null;

  return {
    event: event as ArchiveEvent,
    pages: await getArchiveBookPages(event.id),
  };
}

export async function getPrivateArchiveBook(
  token: string
): Promise<ArchiveBook | null> {
  const supabase = getSupabaseAdmin();
  const { data: event, error } = await supabase
    .from("events")
    .select(
      "id, name, description, start_date, end_date, cover_url, cover_position, cover_scale, slug, archive_visibility, archive_published_at, archive_token"
    )
    .eq("archive_token", token)
    .eq("archive_visibility", "private")
    .not("archive_published_at", "is", null)
    .maybeSingle();

  if (error || !event) return null;

  return {
    event: event as ArchiveEvent,
    pages: await getArchiveBookPages(event.id),
  };
}

async function getArchiveBookPages(eventId: string): Promise<BookPage[]> {
  const supabase = getSupabaseAdmin();

  const { data: pageRows, error: pageError } = await supabase
    .from("book_pages")
    .select("id, event_id, agenda_item_id, is_visible, sort_order, updated_at, updated_by")
    .eq("event_id", eventId)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  if (pageError || !pageRows?.length) return [];

  const pageIds = pageRows.map((page) => page.id);
  const agendaIds = pageRows.map((page) => page.agenda_item_id);
  const updatedByIds = pageRows
    .map((page) => page.updated_by)
    .filter((id): id is string => !!id);

  const [{ data: agendas }, { data: updatedByMembers }, { data: sectionRows }] =
    await Promise.all([
      supabase
        .from("agenda_items")
        .select("id, title, date")
        .in("id", agendaIds),
      updatedByIds.length
        ? supabase.from("members").select("id, name").in("id", updatedByIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("book_sections")
        .select("id, page_id, layout, comment, sort_order")
        .in("page_id", pageIds)
        .order("sort_order", { ascending: true }),
    ]);

  const sections = sectionRows ?? [];
  const sectionIds = sections.map((section) => section.id);
  const { data: sectionItems } = sectionIds.length
    ? await supabase
        .from("book_section_items")
        .select("id, section_id, content_item_id, sort_order")
        .in("section_id", sectionIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const itemRows = sectionItems ?? [];
  const contentIds = itemRows.map((item) => item.content_item_id);
  const { data: contentRows } = contentIds.length
    ? await supabase
        .from("content_items")
        .select("id, type, media_url, thumbnail_url, caption, author_id")
        .in("id", contentIds)
    : { data: [] };

  const authorIds = (contentRows ?? [])
    .map((content) => content.author_id)
    .filter((id): id is string => !!id);
  const { data: authorRows } = authorIds.length
    ? await supabase
        .from("members")
        .select("id, name, avatar_url")
        .in("id", authorIds)
    : { data: [] };

  const agendaById = new Map((agendas ?? []).map((agenda) => [agenda.id, agenda]));
  const updaterById = new Map(
    (updatedByMembers ?? []).map((member) => [member.id, member.name])
  );
  const authorById = new Map(
    (authorRows ?? []).map((author) => [author.id, author])
  );
  const contentById = new Map(
    (contentRows ?? []).map((content) => [content.id, content])
  );
  const itemsBySectionId = new Map<string, BookPageItem[]>();

  for (const row of itemRows) {
    const content = contentById.get(row.content_item_id);
    const author = content?.author_id ? authorById.get(content.author_id) : null;
    const mapped: BookPageItem = {
      id: row.id,
      content_item_id: row.content_item_id,
      sort_order: row.sort_order,
      type: (content?.type as BookPageItem["type"]) ?? null,
      media_url: content?.media_url ?? null,
      thumbnail_url: content?.thumbnail_url ?? null,
      caption: content?.caption ?? null,
      author_id: content?.author_id ?? null,
      author_name: author?.name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
    };
    const list = itemsBySectionId.get(row.section_id) ?? [];
    list.push(mapped);
    itemsBySectionId.set(row.section_id, list);
  }

  const sectionsByPageId = new Map<string, BookSection[]>();
  for (const row of sections) {
    const mapped: BookSection = {
      id: row.id,
      page_id: row.page_id,
      layout: row.layout as BookSection["layout"],
      comment: row.comment ?? "",
      sort_order: row.sort_order,
      items: itemsBySectionId.get(row.id) ?? [],
    };
    const list = sectionsByPageId.get(row.page_id) ?? [];
    list.push(mapped);
    sectionsByPageId.set(row.page_id, list);
  }

  return pageRows
    .map((page): BookPage | null => {
      const agenda = agendaById.get(page.agenda_item_id);
      if (!agenda) return null;
      return {
        id: page.id,
        event_id: page.event_id,
        agenda_item_id: page.agenda_item_id,
        is_visible: page.is_visible,
        sort_order: page.sort_order,
        updated_at: page.updated_at,
        updated_by: page.updated_by,
        updated_by_name: page.updated_by ? updaterById.get(page.updated_by) ?? null : null,
        agenda_title: agenda.title,
        agenda_date: agenda.date,
        sections: sectionsByPageId.get(page.id) ?? [],
      };
    })
    .filter((page): page is BookPage => !!page)
    .sort((a, b) =>
      a.agenda_date === b.agenda_date
        ? a.sort_order - b.sort_order
        : a.agenda_date.localeCompare(b.agenda_date)
    );
}
