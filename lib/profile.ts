export type ManagerProfile = {
  display_name: string;
  supported_school_id: string | null;
  supported_school_name: string | null;
  team_id: string | null;
  team_name: string | null;
  total_points: number;
  overall_rank: number | null;
  best_finish: number | null;
  team_value: number | null;
};

export type SchoolOption = { id: string; name: string };