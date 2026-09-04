import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

// The sitemap includes database-managed posts. Do not query Prisma during the
// production build, when the application database may not be reachable.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await prisma.newsPost.findMany({ where: { status: "PUBLISHED", publishedAt: { not: null } }, select: { slug: true, updatedAt: true, publishedAt: true } });
  return [
    { url: "https://vodiumledger.com", lastModified: new Date() },
    { url: "https://vodiumledger.com/blog", lastModified: new Date() },
    ...posts.map((post) => ({ url: `https://vodiumledger.com/blog/${post.slug}`, lastModified: post.updatedAt ?? post.publishedAt ?? new Date() })),
  ];
}
