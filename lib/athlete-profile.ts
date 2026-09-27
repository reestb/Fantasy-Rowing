import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Athlete } from "@/lib/athletes";

export type AthleteProfileData = Athlete & {
  age: number | null;
  height: string;
  weight: string;
  bio: string;
  eventCategory: string;
  results: { regatta: string; event: string; position: number; time: string; points: number; date: string }[];
  ergHistory: { score: string; date: string }[];
  upcomingRaces: { name: string; date: string; location: string }[];
};

export async function getAthleteProfile(id: string): Promise<AthleteProfileData> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const [athleteResult, racesResult] = await Promise.all([
      supabase.from("athletes")
        .select("id, full_name, year_group, age, event_category, boat_class, height_cm, weight_kg, erg_score, national_ranking, photo_url, bio, fantasy_value, season_points, schools(name, school_colour), results(event, position, time, raced_at, fantasy_points, regattas(name)), erg_history(score, recorded_at)")
        .eq("id", id).eq("is_active", true).maybeSingle(),
      supabase.from("regattas").select("name, starts_at, location")
        .gt("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(4),
    ]);
    if (athleteResult.error) throw new Error(athleteResult.error.message);
    if (athleteResult.data) {
      const row = athleteResult.data as unknown as {
        id: string; full_name: string; year_group: number | null; age: number | null; event_category: string | null;
        boat_class: string | null; height_cm: number | null; weight_kg: number | null; erg_score: string | null;
        national_ranking: number | null; bio: string | null; fantasy_value: number; season_points: number;
        schools: { name: string; school_colour: string } | null;
        results: { event: string; position: number; time: string | null; raced_at: string; fantasy_points: number; regattas: { name: string } | null }[];
        erg_history: { score: string; recorded_at: string }[];
      };
      const name = row.full_name;
      return {
        id: row.id, name, school: row.schools?.name ?? "Independent",
        initials: name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
        year: row.year_group ? `Year ${row.year_group}` : "Year —", boat: row.boat_class ?? "Unassigned",
        erg: row.erg_score ?? "—", rank: row.national_ranking ?? 999, points: row.season_points ?? 0,
        price: row.fantasy_value ?? 5, trend: "—", color: row.schools?.school_colour ?? "#c6d6dd",
        age: row.age, height: row.height_cm ? `${row.height_cm} cm` : "—",
        weight: row.weight_kg ? `${row.weight_kg} kg` : "—", bio: row.bio ?? "",
        eventCategory: row.event_category ?? "Not recorded",
        results: row.results.map((result) => ({
          regatta: result.regattas?.name ?? "School event", event: result.event,
          position: result.position, time: result.time ?? "—", points: result.fantasy_points,
          date: new Date(result.raced_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        })).sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
        ergHistory: row.erg_history.map((item) => ({ score: item.score, date: item.recorded_at }))
          .sort((left, right) => right.date.localeCompare(left.date)),
        upcomingRaces: (racesResult.data ?? []).map((race) => ({
          name: race.name, date: new Date(race.starts_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          location: race.location ?? "Location to follow",
        })),
      };
    }
  }

  notFound();
}