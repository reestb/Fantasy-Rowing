import AdminDesk from "@/components/admin-desk";
import AdminGate from "@/components/admin-gate";
import { getManagedAthletes } from "@/lib/admin-data";
import { ADMIN_ACCESS_COOKIE, isValidAdminAccessToken } from "@/lib/admin-access";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  if (!isValidAdminAccessToken(cookieStore.get(ADMIN_ACCESS_COOKIE)?.value)) return <AdminGate />;

  const athletes = await getManagedAthletes();
  return <AdminDesk initialAthletes={athletes} />;
}