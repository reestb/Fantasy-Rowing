import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_ACCESS_COOKIE = "fantasy-rowing-admin";
const accessCode = process.env.ADMIN_ACCESS_CODE || "12481248";

export function matchesAdminAccessCode(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const expected = Buffer.from(accessCode);
  const supplied = Buffer.from(value);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function createAdminAccessToken(): string {
  return createHmac("sha256", accessCode).update("fantasy-rowing-admin-session").digest("hex");
}

export function isValidAdminAccessToken(value: string | undefined): boolean {
  if (!value) return false;
  const expected = Buffer.from(createAdminAccessToken());
  const supplied = Buffer.from(value);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}