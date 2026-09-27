import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your private leagues." }, { status: 401 });
  const { data, error } = await supabase.rpc("get_my_private_leagues");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ leagues: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to create or join a private league." }, { status: 401 });

  const input = await request.json() as { action?: unknown; name?: unknown; invite_code?: unknown };
  if (input.action === "create") {
    if (typeof input.name !== "string") return NextResponse.json({ error: "Enter a league name." }, { status: 400 });
    const { data, error } = await supabase.rpc("create_private_league", { p_name: input.name });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ league: data }, { status: 201 });
  }
  if (input.action === "join") {
    if (typeof input.invite_code !== "string") return NextResponse.json({ error: "Enter an invite code." }, { status: 400 });
    const { data, error } = await supabase.rpc("join_private_league", { p_invite_code: input.invite_code });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ league: data }, { status: 200 });
  }
  return NextResponse.json({ error: "Choose create or join." }, { status: 400 });
}