import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Gem, MessageCircle } from "lucide-react";
import { useSEO } from "@/lib/seo";

const WHATSAPP_SUPPORT_URL = "https://wa.me/918989496800?text=Hello+SwarnDesk+Support";

export default function NotFound() {
  useSEO({
    title: "Page Not Found",
    description: "This page doesn't exist or the link may be outdated.",
    path: "/404",
    noindex: true,
  });
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm px-4">
        <Gem className="w-12 h-12 text-primary mx-auto opacity-50" />
        <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
        <p className="text-muted-foreground">Page not found</p>
        <p className="text-sm text-muted-foreground">
          This page doesn't exist or the link may be outdated. If you think this is a mistake, contact WhatsApp Support.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/">
            <a><Button>Go Home</Button></a>
          </Link>
          <a
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 underline"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp Support
          </a>
        </div>
      </div>
    </div>
  );
}
