import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ACCESS_COOKIE, createAdminAccessToken, matchesAdminAccessCode } from "@/lib/admin-access";

export async function POST(request: NextRequest) {
  const body = await request.json() as { code?: unknown };
  if (!matchesAdminAccessCode(body.code)) {
    return NextResponse.json({ error: "That access code is not correct." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_ACCESS_COOKIE, createAdminAccessToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}