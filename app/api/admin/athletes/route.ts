import { NextRequest, NextResponse } from "next/server";
import { getAdminDatabase, isUuid } from "@/lib/admin-api";

type AthleteInput = {
  id?: string;
  full_name?: string;
  school_name?: string;
  year_group?: number | null;
  age?: number | null;
  event_category?: string | null;
  boat_class?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  erg_score?: string | null;
  national_ranking?: number | null;
  photo_url?: string | null;
  bio?: string | null;
  fantasy_value?: number;
  season_points?: number;
};

export async function POST(request: NextRequest) {
  const auth = getAdminDatabase(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const input = await request.json() as AthleteInput;
  if (!input.full_name?.trim()) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  if (typeof input.fantasy_value !== "number" || input.fantasy_value < 0 || input.fantasy_value > 100) {
    return NextResponse.json({ error: "Fantasy value must be between 0 and 100." }, { status: 400 });
  }

  let schoolId: string | null = null;
  let schoolBoatId: string | null = null;
  if (input.school_name?.trim()) {
    const { data: school, error: schoolError } = await auth.database
      .from("schools").upsert({ name: input.school_name.trim() }, { onConflict: "name" }).select("id").single();
    if (schoolError) return NextResponse.json({ error: schoolError.message }, { status: 400 });
    schoolId = school.id as string;
    if (input.boat_class?.trim()) {
      const { data: boat, error: boatError } = await auth.database.from("school_boats").upsert({
        school_id: schoolId,
        name: input.boat_class.trim(),
        event_category: input.event_category ?? null,
      }, { onConflict: "school_id,name" }).select("id").single();
      if (boatError) return NextResponse.json({ error: boatError.message }, { status: 400 });
      schoolBoatId = boat.id as string;
    }
  }

  const record = { ...input, full_name: input.full_name.trim(), school_id: schoolId, school_boat_id: schoolBoatId };
  delete record.id;
  delete record.school_name;
  const { data, error } = await auth.database.from("athletes").insert(record).select("id, full_name, school_id, school_boat_id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = getAdminDatabase(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const input = await request.json() as AthleteInput;
  if (!isUuid(input.id) || !input.full_name?.trim()) return NextResponse.json({ error: "A valid athlete and full name are required." }, { status: 400 });
  if (typeof input.fantasy_value !== "number" || input.fantasy_value < 0 || input.fantasy_value > 100) {
    return NextResponse.json({ error: "Fantasy value must be between 0 and 100." }, { status: 400 });
  }

  let schoolId: string | null = null;
  let schoolBoatId: string | null = null;
  if (input.school_name?.trim()) {
    const { data: school, error: schoolError } = await auth.database
      .from("schools").upsert({ name: input.school_name.trim() }, { onConflict: "name" }).select("id").single();
    if (schoolError) return NextResponse.json({ error: schoolError.message }, { status: 400 });
    schoolId = school.id as string;
    if (input.boat_class?.trim()) {
      const { data: boat, error: boatError } = await auth.database.from("school_boats").upsert({
        school_id: schoolId,
        name: input.boat_class.trim(),
        event_category: input.event_category ?? null,
      }, { onConflict: "school_id,name" }).select("id").single();
      if (boatError) return NextResponse.json({ error: boatError.message }, { status: 400 });
      schoolBoatId = boat.id as string;
    }
  }

  const record = { ...input, full_name: input.full_name.trim(), school_id: schoolId, school_boat_id: schoolBoatId };
  delete record.id;
  delete record.school_name;
  const { error } = await auth.database.from("athletes").update(record).eq("id", input.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: input.id, full_name: input.full_name.trim(), school_id: schoolId, school_boat_id: schoolBoatId });
}

export async function DELETE(request: NextRequest) {
  const auth = getAdminDatabase(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = request.nextUrl.searchParams.get("id");
  if (!isUuid(id)) return NextResponse.json({ error: "A valid athlete id is required." }, { status: 400 });
  const { error } = await auth.database.from("athletes").update({ is_active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}