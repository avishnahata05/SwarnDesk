import { Link, useParams, Redirect } from "wouter";
import { ArrowRight, ArrowLeft, Calendar, Clock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BlogBlocks from "@/components/blog/BlogBlocks";
import { getPostBySlug, getRelatedPosts } from "@/content/blog";
import { useSEO, SITE_URL, WHATSAPP_URL } from "@/lib/seo";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) return <Redirect to="/blog" />;

  const faqBlock = post.blocks.find(b => b.type === "faq");
  const url = `${SITE_URL}/blog/${post.slug}`;

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      author: { "@type": "Organization", name: post.author },
      publisher: { "@type": "Organization", name: "SwarnDesk", url: SITE_URL },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  if (faqBlock && faqBlock.type === "faq") {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqBlock.items.map(item => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  useSEO({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    type: "article",
    keywords: post.keywords,
    jsonLd,
  });

  const related = getRelatedPosts(post.slug);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="SwarnDesk jewellery ERP software logo" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-lg font-bold tracking-tight">SwarnDesk</span>
          </Link>
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

      <article className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Blog
          </Link>

          <Badge variant="secondary" className="mb-4">{post.category}</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4">{post.title}</h1>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b border-border">
            <span>{post.author}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />
              {new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{post.readTime}</span>
          </div>

          <p className="text-lg text-foreground/90 leading-relaxed mb-8 font-medium">
            {post.directAnswer}
          </p>

          <BlogBlocks blocks={post.blocks} />

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl">
            <p className="text-sm text-muted-foreground">Questions about switching to SwarnDesk?</p>
            <a href={`${WHATSAPP_URL}?text=I+read+the+blog+and+want+to+know+more+about+SwarnDesk`} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                <MessageCircle className="w-4 h-4" /> WhatsApp Us: +91 89894 96800
              </Button>
            </a>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="pb-24 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold mb-6">Related guides</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`}>
                  <div className="h-full p-5 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all cursor-pointer">
                    <h3 className="font-semibold text-sm text-foreground mb-1.5 leading-snug">{r.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-border py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white border border-border flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="SwarnDesk" className="w-5 h-5 object-contain" />
            </div>
            <span className="font-bold">SwarnDesk</span>
          </div>
          <div className="text-xs text-muted-foreground text-center sm:text-right">
            Call / WhatsApp <a href="tel:+918989496800" className="hover:text-foreground hover:underline">+91 89894 96800</a>
            <span className="text-muted-foreground/50"> · © 2026 SwarnDesk</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
