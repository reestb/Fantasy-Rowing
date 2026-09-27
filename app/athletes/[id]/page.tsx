import AthleteProfile from "@/components/athlete-profile";
import { getAthleteProfile } from "@/lib/athlete-profile";

export const dynamic = "force-dynamic";

export default async function AthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await getAthleteProfile(id);
  return <AthleteProfile athlete={athlete} />;
}