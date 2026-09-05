import { Link } from "wouter";
import { ArrowRight, Calendar, Clock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BLOG_POSTS } from "@/content/blog";
import { useSEO, SITE_URL, WHATSAPP_URL } from "@/lib/seo";

export default function BlogIndex() {
  useSEO({
    title: "Jewellery ERP, GST & Girvi Guides — SwarnDesk Blog",
    description: "Practical guides for Indian jewellers on GST returns, HUID hallmarking, Girvi gold loan tracking, karigar wastage, and choosing jewellery ERP software.",
    path: "/blog",
    keywords: "jewellery ERP blog, jewellery GST guide, girvi guide, HUID guide, jewellery software blog",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "SwarnDesk Blog",
      description: "Guides for Indian jewellers on GST, HUID hallmarking, Girvi gold loans, karigar tracking, and jewellery ERP software.",
      url: `${SITE_URL}/blog`,
      publisher: { "@type": "Organization", name: "SwarnDesk", url: SITE_URL },
      blogPost: BLOG_POSTS.map(p => ({
        "@type": "BlogPosting",
        headline: p.title,
        url: `${SITE_URL}/blog/${p.slug}`,
        datePublished: p.publishedAt,
        dateModified: p.updatedAt,
      })),
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="SwarnDesk jewellery ERP software logo" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-lg font-bold tracking-tight">SwarnDesk</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="/#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/blog" className="text-foreground font-medium">Blog</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="gap-1.5">Sign Up Free <ArrowRight className="w-3.5 h-3.5" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      <header className="pt-32 pb-16 px-4 sm:px-6 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">SwarnDesk Blog</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Practical guides on GST returns, HUID hallmarking, Girvi gold loans, karigar tracking, and choosing jewellery ERP software, written for Indian jewellers.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <div className="grid sm:grid-cols-2 gap-6">
          {BLOG_POSTS.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <article className="h-full flex flex-col p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all duration-200 cursor-pointer">
                <Badge variant="secondary" className="w-fit mb-3">{post.category}</Badge>
                <h2 className="text-lg font-bold text-foreground mb-2 leading-snug">{post.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{post.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />
                    {new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{post.readTime}</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </main>

      <section className="pb-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center p-10 rounded-3xl border border-primary/20 bg-primary/5">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to run your shop on one system?</h2>
          <p className="text-muted-foreground mb-8">Billing, GST, full accounting, and Girvi in one app. 7 day free trial, no credit card needed.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2 px-8">Sign Up Free <ArrowRight className="w-4 h-4" /></Button>
            </Link>
            <a href={`${WHATSAPP_URL}?text=I+want+to+know+more+about+SwarnDesk`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="gap-2 px-8">
                <MessageCircle className="w-4 h-4 text-green-400" /> Talk to Us: +91 89894 96800
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white border border-border flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="SwarnDesk" className="w-5 h-5 object-contain" />
            </div>
            <span className="font-bold">SwarnDesk</span>
            <span className="text-muted-foreground text-sm ml-2">India's Smartest Jewellery ERP</span>
          </div>
          <div className="text-xs text-muted-foreground text-center sm:text-right">
            Call / WhatsApp <a href="tel:+918989496800" className="hover:text-foreground hover:underline">+91 89894 96800</a>
            <span className="text-muted-foreground/50"> · © 2026 SwarnDesk · by <a href="https://www.tirthontech.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground hover:underline underline-offset-2">TirthonTech</a></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
