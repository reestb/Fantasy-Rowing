import { NextRequest, NextResponse } from "next/server";
import { getAdminDatabase, isUuid } from "@/lib/admin-api";

export async function POST(request: NextRequest) {
  const auth = getAdminDatabase(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const input = await request.json() as {
    subject_type?: string; subject_id?: string; regatta?: string; event?: string; position?: number;
    time?: string; course_record?: boolean; crew_of_the_week?: boolean;
  };
  const regattaName = input.regatta?.trim();
  const eventName = input.event?.trim();
  if (!isUuid(input.subject_id) || !["athlete", "boat"].includes(input.subject_type ?? "") || !regattaName || !eventName) {
    return NextResponse.json({ error: "Choose an athlete or registered school boat, race and event." }, { status: 400 });
  }
  if (!Number.isInteger(input.position) || (input.position ?? 0) < 1) {
    return NextResponse.json({ error: "Finish position must be a positive whole number." }, { status: 400 });
  }

  const { data: existingRegatta, error: regattaError } = await auth.database
    .from("regattas").select("id").eq("name", regattaName).maybeSingle();
  if (regattaError) return NextResponse.json({ error: regattaError.message }, { status: 400 });
  let regatta = existingRegatta;
  if (!regatta) {
    const created = await auth.database.from("regattas")
      .insert({ name: regattaName, event_category: "School event", is_admin_event: true })
      .select("id").single();
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });
    regatta = created.data;
  }

  let athleteIds: string[];
  if (input.subject_type === "athlete") {
    const { data: athlete, error } = await auth.database.from("athletes")
      .select("id").eq("id", input.subject_id).eq("is_active", true).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!athlete) return NextResponse.json({ error: "That athlete is not active." }, { status: 404 });
    athleteIds = [athlete.id as string];
  } else {
    const { data: crew, error } = await auth.database.from("athletes")
      .select("id").eq("school_boat_id", input.subject_id).eq("is_active", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!crew?.length) return NextResponse.json({ error: "No active rowers are registered with that boat." }, { status: 400 });
    athleteIds = crew.map((athlete) => athlete.id as string);
  }

  const { data, error } = await auth.database.from("results").insert(athleteIds.map((athleteId) => ({
    athlete_id: athleteId,
    regatta_id: regatta.id,
    event: eventName,
    position: input.position,
    time: input.time?.trim() || null,
    course_record: Boolean(input.course_record),
    crew_of_the_week: Boolean(input.crew_of_the_week),
  }))).select("id, fantasy_points");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const pointsPerAthlete = data?.[0]?.fantasy_points ?? 0;
  return NextResponse.json({
    athlete_count: data?.length ?? 0,
    points_per_athlete: pointsPerAthlete,
    total_fantasy_points: (data ?? []).reduce((sum, result) => sum + result.fantasy_points, 0),
  }, { status: 201 });
}