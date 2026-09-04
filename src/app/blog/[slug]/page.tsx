import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { readingTime } from "@/lib/news";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await prisma.newsPost.findFirst({ where: { slug: params.slug, status: "PUBLISHED" }, select: { title: true, excerpt: true, coverImageUrl: true } });
  if (!post) return { title: "Article not found" };
  return { title: `${post.title} : Vodium Ledger`, description: post.excerpt, openGraph: { title: post.title, description: post.excerpt, images: post.coverImageUrl ? [post.coverImageUrl] : undefined, type: "article" } };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const post = await prisma.newsPost.findFirst({ where: { slug: params.slug, status: "PUBLISHED" } });
  if (!post) notFound();
  return <div className="marketing-page min-h-screen"><SiteNav /><main className="pt-16"><article className="max-w-3xl mx-auto px-6 md:px-12 py-24"><Link href="/blog" className="inline-flex items-center gap-2 text-sm text-vodium-gold mb-10"><ArrowLeft size={14}/> All articles</Link><div className="flex items-center gap-3 mb-5"><span className="text-[10px] font-bold tracking-[0.2em] px-2.5 py-1 rounded-full bg-vodium-gold/10 text-vodium-gold border border-vodium-gold/20">{post.category}</span><span className="text-xs text-[color:var(--text-quaternary)]">{new Date(post.publishedAt!).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</span></div><h1 className="font-serif text-4xl md:text-6xl leading-tight text-[color:var(--text-primary)]">{post.title}</h1><p className="text-lg leading-relaxed text-[color:var(--text-tertiary)] mt-6">{post.excerpt}</p><div className="flex items-center gap-5 text-xs text-[color:var(--text-quaternary)] mt-7 mb-14"><span className="inline-flex items-center gap-1.5"><User size={12}/>{post.authorName}</span><span className="inline-flex items-center gap-1.5"><Clock size={12}/>{readingTime(post.content)}</span></div>{post.coverImageUrl && <img src={post.coverImageUrl} alt="" className="w-full rounded-2xl mb-12" />}<div className="space-y-6 text-[color:var(--text-secondary)] leading-8 text-base">{post.content.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></article></main><SiteFooter /></div>;
}
