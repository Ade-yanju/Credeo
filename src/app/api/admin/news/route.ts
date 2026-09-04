import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { slugify } from "@/lib/news";

const schema = z.object({
  title: z.string().trim().min(3).max(180),
  excerpt: z.string().trim().min(10).max(500),
  content: z.string().trim().min(20).max(100000),
  category: z.string().trim().min(2).max(40).default("NEWS"),
  authorName: z.string().trim().min(2).max(100),
  coverImageUrl: z.string().url().max(1000).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  slug: z.string().trim().max(100).optional(),
});

function authorised() {
  return getAdminSession();
}

export async function GET() {
  if (!authorised()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const posts = await prisma.newsPost.findMany({ orderBy: { updatedAt: "desc" }, include: { createdByAdmin: { select: { name: true } } } });
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const session = authorised();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid post" }, { status: 400 });
  const d = parsed.data;
  const baseSlug = slugify(d.slug || d.title) || `post-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.newsPost.findUnique({ where: { slug }, select: { id: true } })) slug = `${baseSlug}-${suffix++}`;
  const post = await prisma.newsPost.create({ data: { ...d, slug, publishedAt: d.status === "PUBLISHED" ? new Date() : null, createdByAdminId: session.id === "__super__" ? null : session.id } });
  return NextResponse.json({ post }, { status: 201 });
}
