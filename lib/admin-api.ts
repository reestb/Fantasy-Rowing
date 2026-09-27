import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { ADMIN_ACCESS_COOKIE, isValidAdminAccessToken } from "@/lib/admin-access";

export function getAdminDatabase(request: NextRequest) {
  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  if (!isValidAdminAccessToken(accessToken)) return { error: "Enter the admin access code first.", status: 401 as const };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    return {
      error: "Admin database access is not configured. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to .env.local and restart the app.",
      status: 503 as const,
    };
  }

  return { database: createClient(url, serviceKey, { auth: { persistSession: false } }) };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}