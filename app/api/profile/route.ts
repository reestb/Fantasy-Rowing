import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to load your profile." }, { status: 401 });

  const { error: ensureError } = await supabase.rpc("ensure_manager_profile");
  if (ensureError) return NextResponse.json({ error: ensureError.message }, { status: 400 });

  const [profileResult, schoolsResult] = await Promise.all([
    supabase.rpc("get_manager_dashboard"),
    supabase.from("schools").select("id, name").order("name"),
  ]);
  if (profileResult.error) return NextResponse.json({ error: profileResult.error.message }, { status: 400 });
  if (schoolsResult.error) return NextResponse.json({ error: schoolsResult.error.message }, { status: 400 });
  return NextResponse.json({ profile: profileResult.data, schools: schoolsResult.data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });

  const input = await request.json() as { display_name?: unknown; supported_school_id?: unknown };
  if (typeof input.display_name !== "string" || input.display_name.trim().length < 2 || input.display_name.trim().length > 40) {
    return NextResponse.json({ error: "Display name must be between 2 and 40 characters." }, { status: 400 });
  }
  const schoolId = input.supported_school_id === null || input.supported_school_id === "" ? null : input.supported_school_id;
  if (schoolId !== null && (typeof schoolId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(schoolId))) {
    return NextResponse.json({ error: "Choose a valid school." }, { status: 400 });
  }

  const { error } = await supabase.from("users").update({
    display_name: input.display_name.trim(),
    supported_school_id: schoolId,
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}