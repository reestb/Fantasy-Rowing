import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase sign-in is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to load your saved crew." }, { status: 401 });
  const { data, error } = await supabase.from("fantasy_teams")
    .select("id, name, total_points, best_finish, team_value, team_athletes(athlete_id, is_captain, removed_at)")
    .eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ team: data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase sign-in is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before syncing your crew." }, { status: 401 });
  const input = await request.json() as { athlete_ids?: unknown; captain_id?: unknown; team_name?: unknown };
  if (!Array.isArray(input.athlete_ids) || input.athlete_ids.length !== 8 || !input.athlete_ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "A crew must contain exactly eight rowers." }, { status: 400 });
  }
  if (typeof input.captain_id !== "string" || !input.athlete_ids.includes(input.captain_id)) {
    return NextResponse.json({ error: "Choose one of your rowers as captain." }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("save_fantasy_team", {
    p_team_name: typeof input.team_name === "string" ? input.team_name.slice(0, 40) : "My Crew",
    p_athlete_ids: input.athlete_ids,
    p_captain_id: input.captain_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ team_id: data });
}