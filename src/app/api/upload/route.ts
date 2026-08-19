import { NextRequest, NextResponse } from "next/server";
import { guardVendorWrite } from "@/lib/entitlement-guard";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// POST /api/upload — accepts an image file and stores it on Cloudinary (primary)
// or ImgBB (fallback), returning the hosted URL. Keeps provider keys server-side.
export async function POST(req: NextRequest) {
  // Uploads exist to feed products and shop branding, both of which are gated,
  // so a locked account has nothing legitimate to upload — and keeping the
  // door open would let lapsed accounts use our image hosting indefinitely.
  const guard = await guardVendorWrite("upload.write");
  if (!guard.ok) return guard.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, WebP or GIF image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
  }

  // 1) Cloudinary (unsigned upload preset)
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (cloud && preset) {
    try {
      const cd = new FormData();
      cd.append("file", file);
      cd.append("upload_preset", preset);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: cd });
      const data = await res.json();
      if (res.ok && data.secure_url) {
        return NextResponse.json({ ok: true, url: data.secure_url as string, provider: "cloudinary" });
      }
      console.warn("[upload] cloudinary failed:", data?.error?.message ?? res.status);
    } catch (err) {
      console.warn("[upload] cloudinary error:", err);
    }
  }

  // 2) ImgBB fallback
  const imgbbKey = process.env.IMGBB_API_KEY;
  if (imgbbKey) {
    try {
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      const body = new URLSearchParams({ image: base64 });
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method: "POST", body });
      const data = await res.json();
      if (res.ok && data?.data?.url) {
        return NextResponse.json({ ok: true, url: data.data.url as string, provider: "imgbb" });
      }
      console.warn("[upload] imgbb failed:", data?.error?.message ?? res.status);
    } catch (err) {
      console.warn("[upload] imgbb error:", err);
    }
  }

  return NextResponse.json(
    { error: "Image uploads are not configured. Paste an image URL instead." },
    { status: 503 }
  );
}
