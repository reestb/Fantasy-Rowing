import { createClient } from "@supabase/supabase-js";

export type Athlete = {
  id: string;
  name: string;
  school: string;
  initials: string;
  year: string;
  boat: string;
  erg: string;
  rank: number;
  points: number;
  price: number;
  trend: string;
  color: string;
};

export async function getAthletes(): Promise<Athlete[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return [];

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("athletes")
      .select("id, full_name, year_group, boat_class, erg_score, national_ranking, season_points, fantasy_value, schools(name, school_colour)")
      .eq("is_active", true)
      .order("national_ranking", { ascending: true })
      .limit(100);

    if (error || !data?.length) return [];

    return data.map((row, index) => {
      const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
      const name = row.full_name as string;
      return {
        id: row.id as string,
        name,
        school: (school as { name?: string } | null)?.name ?? "Independent",
        initials: name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
        year: `Year ${row.year_group ?? "?"}`,
        boat: (row.boat_class as string) ?? "Unassigned",
        erg: (row.erg_score as string) ?? "—",
        rank: (row.national_ranking as number) ?? index + 1,
        points: (row.season_points as number) ?? 0,
        price: (row.fantasy_value as number) ?? 5,
        trend: "—",
        color: (school as { school_colour?: string } | null)?.school_colour ?? "#c6d6dd",
      };
    });
  } catch {
    return [];
  }
}