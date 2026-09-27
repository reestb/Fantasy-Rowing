import FantasyDashboard from "@/components/fantasy-dashboard";
import { getAthletes } from "@/lib/athletes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const athletes = await getAthletes();
  return <FantasyDashboard initialAthletes={athletes} />;
}