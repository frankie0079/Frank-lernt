import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";

const supabaseUrlPrefix = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseUrl = z.string().url().refine(
  (url) => url.startsWith(supabaseUrlPrefix),
  "URL muss von Supabase stammen"
);

const photoMetadataSchema = z.object({
  storage_path: z.string().min(1),
  full_url: supabaseUrl,
  thumbnail_url: supabaseUrl.nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
  author_name: z.string().max(100).default("Anonym"),
  gps_lat: z.number().min(-90).max(90).nullable().optional(),
  gps_lng: z.number().min(-180).max(180).nullable().optional(),
  taken_at: z.string().datetime().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("tour_id", id)
    .order("taken_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiges JSON" },
      { status: 400 }
    );
  }

  const parsed = photoMetadataSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("photos")
    .insert({ ...parsed.data, tour_id: id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
