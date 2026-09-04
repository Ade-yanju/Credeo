import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { slugify } from "@/lib/news";

const schema = z.object({ title: z.string().trim().min(3).max(180), excerpt: z.string().trim().min(10).max(500), content: z.string().trim().min(20).max(100000), category: z.string().trim().min(2).max(40), authorName: z.string().trim().min(2).max(100), coverImageUrl: z.string().url().max(1000).optional().nullable(), status: z.enum(["DRAFT", "PUBLISHED"]), slug: z.string().trim().max(100).optional() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid post" }, { status: 400 });
  const d = parsed.data;
  const existing = await prisma.newsPost.findUnique({ where: { id: params.id }, select: { publishedAt: true } });
  if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const slug = slugify(d.slug || d.title) || `post-${Date.now()}`;
  const conflict = await prisma.newsPost.findFirst({ where: { slug, NOT: { id: params.id } }, select: { id: true } });
  if (conflict) return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });
  const post = await prisma.newsPost.update({ where: { id: params.id }, data: { ...d, slug, publishedAt: d.status === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : null } });
  return NextResponse.json({ post });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!getAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.newsPost.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
