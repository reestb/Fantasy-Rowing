import { createClient } from "@supabase/supabase-js";
import type { Athlete } from "@/lib/athletes";

export type ManagedAthlete = Athlete & {
  schoolId: string | null;
  schoolBoatId: string | null;
  age: number | null;
  eventCategory: string;
  height: string;
  weight: string;
  photoUrl: string;
  bio: string;
};

export async function getManagedAthletes(): Promise<ManagedAthlete[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return [];

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("athletes")
      .select("id, full_name, school_id, school_boat_id, year_group, age, event_category, boat_class, erg_score, national_ranking, height_cm, weight_kg, photo_url, bio, season_points, fantasy_value, schools(name, school_colour)")
      .eq("is_active", true)
      .order("national_ranking", { ascending: true })
      .limit(200);
    if (error || !data) return [];

    return data.map((row, index) => {
      const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
      const name = row.full_name as string;
      return {
        id: row.id as string,
        name,
        school: (school as { name?: string } | null)?.name ?? "Independent",
        schoolId: (row.school_id as string | null) ?? null,
        schoolBoatId: (row.school_boat_id as string | null) ?? null,
        initials: name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
        year: row.year_group ? `Year ${row.year_group}` : "Year —",
        boat: (row.boat_class as string) ?? "Unassigned",
        erg: (row.erg_score as string) ?? "—",
        rank: (row.national_ranking as number) ?? index + 1,
        points: (row.season_points as number) ?? 0,
        price: (row.fantasy_value as number) ?? 5,
        trend: "—",
        color: (school as { school_colour?: string } | null)?.school_colour ?? "#c6d6dd",
        age: (row.age as number | null) ?? null,
        eventCategory: (row.event_category as string) ?? "",
        height: row.height_cm == null ? "" : String(row.height_cm),
        weight: row.weight_kg == null ? "" : String(row.weight_kg),
        photoUrl: (row.photo_url as string) ?? "",
        bio: (row.bio as string) ?? "",
      };
    });
  } catch {
    return [];
  }
}