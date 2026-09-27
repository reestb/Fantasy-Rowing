import { NextRequest, NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/admin-api";

export async function POST(request: NextRequest) {
  const auth = getAdminDatabase(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const input = await request.json() as {
    name?: string; logo_url?: string; head_coach?: string; school_colour?: string;
  };
  if (!input.name?.trim()) return NextResponse.json({ error: "School name is required." }, { status: 400 });
  const { data, error } = await auth.database.from("schools").insert({
    name: input.name.trim(),
    logo_url: input.logo_url || null,
    head_coach: input.head_coach || null,
    school_colour: input.school_colour || "#1f4b70",
  }).select("id, name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}