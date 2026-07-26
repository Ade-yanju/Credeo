import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, User } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatedBorder } from "@/components/ui/animated-border";
import { NewsletterForm } from "@/components/ui/newsletter-form";

export const metadata = {
  title: "Blog : Vodium Ledger",
  description:
    "Insights on campus vendor finance, credit data, and African fintech.",
};

type TagColor = "purple" | "gold" | "emerald";

interface BlogPost {
  tag: string;
  tagColor: TagColor;
  date: string;
  title: string;
  excerpt: string;
  author: string;
  readTime: string;
  href: string;
  featured?: boolean;
}

const posts: BlogPost[] = [
  {
    tag: "RESEARCH",
    tagColor: "purple",
    date: "15 May 2026",
    title:
      "Why Nigerian campus vendors lose ₦2.4 billion to informal credit every year",
    excerpt:
      "We surveyed 300 campus vendors across 12 universities. Here's what the data says about Nigeria's informal campus credit market and why it's ripe for disruption.",
    author: "Adewale Okafor",
    readTime: "8 min read",
    href: "/blog/campus-credit-market",
    featured: true,
  },
  {
    tag: "PRODUCT",
    tagColor: "gold",
    date: "28 May 2026",
    title: "How Vodium recovered ₦2.3M in campus credit defaults in 90 days",
    excerpt:
      "Our pilot cohort of 23 vendors tracked ₦6.1M in credit over three months. Here's what we learned about what makes vendors actually recover their money.",
    author: "Chidinma Eze",
    readTime: "5 min read",
    href: "/blog/pilot-recovery-results",
  },
  {
    tag: "GUIDE",
    tagColor: "emerald",
    date: "3 June 2026",
    title: "The WhatsApp credit tracking guide for Nigerian campus vendors",
    excerpt:
      "Step-by-step: how to use Vodium Ledger's WhatsApp bot to record credits, send reminders, and track repayments all without leaving WhatsApp.",
    author: "Amaka Nwosu",
    readTime: "4 min read",
    href: "/blog/whatsapp-credit-tracking-guide",
  },
];

const tagStyles: Record<TagColor, string> = {
  purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  gold: "bg-vodium-gold/10 text-vodium-gold border border-vodium-gold/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
};

function TagBadge({ tag, color }: { tag: string; color: TagColor }) {
  return (
    <span
      className={`text-[10px] font-bold tracking-[0.2em] px-2.5 py-1 rounded-full ${tagStyles[color]}`}
    >
      {tag}
    </span>
  );
}

function FeaturedCard({ post }: { post: BlogPost }) {
  return (
    <AnimatedBorder className="mb-5">
      <Link href={post.href} className="group block p-8 md:p-10">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-[10px] font-bold tracking-[0.2em] px-2.5 py-1 rounded-full bg-vodium-gold/15 text-vodium-gold border border-vodium-gold/30">
            FEATURED
          </span>
          <TagBadge tag={post.tag} color={post.tagColor} />
          <span className="text-vodium-cream/30 text-xs">{post.date}</span>
        </div>
        <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl text-vodium-cream leading-snug mb-4 group-hover:text-vodium-gold transition-colors duration-200 max-w-3xl">
          {post.title}
        </h2>
        <p className="text-vodium-cream/55 text-base leading-relaxed max-w-2xl mb-6">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 text-xs text-vodium-cream/40">
            <span className="flex items-center gap-1.5">
              <User size={12} />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              {post.readTime}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-vodium-gold text-sm font-semibold group-hover:gap-3 transition-all duration-200">
            Read article <ArrowRight size={14} />
          </span>
        </div>
      </Link>
    </AnimatedBorder>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <MagicCard className="rounded-2xl">
      <Link href={post.href} className="group block p-6 h-full flex flex-col">
        <div className="flex items-center gap-2.5 mb-4">
          <TagBadge tag={post.tag} color={post.tagColor} />
          <span className="text-vodium-cream/30 text-xs">{post.date}</span>
        </div>
        <h3 className="font-serif text-xl md:text-2xl text-vodium-cream leading-snug mb-3 group-hover:text-vodium-gold transition-colors duration-200 flex-1">
          {post.title}
        </h3>
        <p className="text-vodium-cream/50 text-sm leading-relaxed mb-5">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-vodium-cream/35">
            <span className="flex items-center gap-1.5">
              <User size={11} />
              {post.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={11} />
              {post.readTime}
            </span>
          </div>
          <ArrowRight
            size={13}
            className="text-vodium-cream/20 group-hover:text-vodium-gold transition-colors"
          />
        </div>
      </Link>
    </MagicCard>
  );
}

export default function BlogPage() {
  const [featured, ...rest] = posts;

  return (
    <div className="min-h-screen bg-vodium-black text-vodium-cream">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-vodium-charcoal border border-vodium-gold/40 flex items-center justify-center">
              <span className="font-serif text-vodium-gold text-lg leading-none">
                V
              </span>
            </div>
            <span className="font-serif tracking-[0.18em] text-vodium-gold text-sm">
              VODIUM LEDGER
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-vodium-cream/50 hover:text-vodium-gold transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Home
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 btn-gold px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-[0_0_20px_rgba(201,169,97,0.3)] transition-all"
            >
              Get started <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero */}
        <section className="mesh-bg relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(201,169,97,0.05),transparent)] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 md:px-12 pt-24 pb-20 relative z-10">
            <span className="inline-block text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold mb-5">
              Blog
            </span>
            <h1 className="font-serif text-5xl md:text-6xl text-vodium-cream mb-4 leading-tight max-w-xl">
              From the
              <br />
              Vodium team.
            </h1>
            <p className="text-vodium-cream/50 text-lg max-w-xl leading-relaxed">
              Insights on campus credit, Nigerian fintech, and the data
              we&apos;re seeing.
            </p>
          </div>
          <div className="brand-divider" />
        </section>

        {/* Posts */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-20">
          {featured && <FeaturedCard post={featured} />}
          <div className="grid md:grid-cols-2 gap-5 mt-5">
            {rest.map((post) => (
              <PostCard key={post.href} post={post} />
            ))}
          </div>
        </section>

        {/* Newsletter */}
        <section className="border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-20">
            <div className="max-w-lg mx-auto">
              <AnimatedBorder className="p-8 md:p-10">
                <div className="text-center mb-8">
                  <span className="inline-block text-vodium-gold text-xs tracking-[0.3em] uppercase font-semibold mb-4">
                    Newsletter
                  </span>
                  <h2 className="font-serif text-2xl md:text-3xl text-vodium-cream mb-3">
                    Get insights delivered.
                  </h2>
                  <p className="text-vodium-cream/50 text-sm leading-relaxed">
                    Articles on campus finance, product updates, and fintech
                    data straight to your inbox.
                  </p>
                </div>
                <NewsletterForm />
                <p className="text-vodium-cream/25 text-xs mt-4 text-center">
                  No spam. Unsubscribe any time.
                </p>
              </AnimatedBorder>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-vodium-cream/30">
          <span className="text-center md:text-left">© 2026 Vodium. Lagos, Nigeria.<br />Vodium Ledger is operated by VODIUMX TECHNOLOGIES LTD (RC: 8976921).</span>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="hover:text-vodium-gold transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-vodium-gold transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/about"
              className="hover:text-vodium-gold transition-colors"
            >
              About
            </Link>
            <Link
              href="/careers"
              className="hover:text-vodium-gold transition-colors"
            >
              Careers
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
