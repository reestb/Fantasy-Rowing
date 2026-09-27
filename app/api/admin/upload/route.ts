import { NextRequest, NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/admin-api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = getAdminDatabase(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });

  const bucket = "athlete-photos";
  const { data: buckets } = await auth.database.storage.listBuckets();
  if (!buckets?.some((existing) => existing.name === bucket)) {
    const { error: createError } = await auth.database.storage.createBucket(bucket, { public: true, fileSizeLimit: "5MB", allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });
    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await auth.database.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data } = auth.database.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}