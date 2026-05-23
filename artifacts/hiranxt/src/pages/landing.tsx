import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Zap, Users, Hammer, Package,
  CheckCircle2, Star, MessageCircle, ArrowRight, ShoppingCart, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: LayoutDashboard, title: "Live Dashboard", desc: "See your gold rates, daily earnings, and sales performance the moment you open the app — no waiting, no refresh needed." },
  { icon: Package, title: "Smart Inventory", desc: "Track every ornament by weight, purity, HUID, and karigar. You'll always know what's in stock and where it is." },
  { icon: ShoppingCart, title: "Instant Billing", desc: "Bill a customer in under 60 seconds. GST auto-calculation, old gold exchange, and instant WhatsApp invoice — all in one screen." },
  { icon: Users, title: "Customer Management", desc: "Never forget a birthday or anniversary. Keep purchase history, loyalty points, and reminders for every customer." },
  { icon: Hammer, title: "Karigar Tracking", desc: "Give metal, get ornaments. Track every gram of gold with your karigars — no more disputes, no more wastage." },
  { icon: Zap, title: "AI Business Insights", desc: "Ask SwarnDesk in plain language — 'What sold most this week?' or 'Which items are running low?' — and get instant answers." },
];

const testimonials = [
  {
    name: "Rajesh Mehta",
    role: "Owner, Mehta Jewellers — Surat",
    text: "SwarnDesk changed how we run our 3 showrooms. The karigar tracking alone saved us 15 grams of gold per month in wastage disputes.",
    stars: 5,
  },
  {
    name: "Priya Agarwal",
    role: "Managing Partner, Agarwal Gold — Jaipur",
    text: "The GST reports are perfect for our CA. We cut compliance time from 2 days to 2 hours every single month.",
    stars: 5,
  },
  {
    name: "Suresh Patel",
    role: "Proprietor, Patel Ornaments — Ahmedabad",
    text: "My customers love getting their invoice on WhatsApp right after purchase. It feels professional and my repeat customers have gone up.",
    stars: 5,
  },
];

const plans = [
  {
    name: "Starter",
    price: "₹999",
    desc: "Perfect for a single-shop jeweller",
    features: ["1 Branch", "Up to 500 items", "Billing & POS", "Customer CRM", "GST Reports"],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹2,499",
    desc: "For jewellers who are growing fast",
    features: ["5 Branches", "Unlimited items", "Karigar Management", "AI Assistant", "All Reports + Export", "WhatsApp Integration"],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "For large chains and wholesalers",
    features: ["Unlimited Branches", "Dedicated Support", "Custom Integrations", "API Access", "On-premise Option", "Training & Onboarding"],
    cta: "Contact Sales",
    highlight: false,
  },
];

export default function LandingPage() {
  const [goldRate, setGoldRate] = useState(7250);

  useEffect(() => {
    const interval = setInterval(() => {
      setGoldRate(prev => prev + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 5));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="SwarnDesk Logo" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-lg font-bold tracking-tight">SwarnDesk</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5 border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              22K Gold: <span className="text-primary font-semibold ml-1">₹{goldRate.toLocaleString("en-IN")}/g</span>
            </div>
            <Link href="/app/dashboard">
              <Button size="sm" className="gap-1.5" data-testid="button-get-started">
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-xs text-primary font-medium mb-8">
            <Zap className="w-3.5 h-3.5" />
            India's Most Advanced Jewellery ERP
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-tight mb-6">
            <span className="text-foreground">Run Your Jewellery</span>
            <br />
            <span className="text-primary" style={{ textShadow: "0 0 60px rgba(244,197,66,0.4)" }}>
              Business Smarter
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            SwarnDesk brings your entire jewellery shop onto one screen — inventory, billing, karigars, repairs, and GST — so you can focus on selling, not paperwork.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/app/dashboard">
              <Button size="lg" className="gap-2 px-8 text-base font-semibold" data-testid="button-free-trial">
                Try Free for 30 Days <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a
              href="https://wa.me/919999999999?text=I+want+to+know+more+about+SwarnDesk"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="lg" className="gap-2 px-8 text-base" data-testid="button-whatsapp-demo">
                <MessageCircle className="w-4 h-4 text-green-400" />
                See a Live Demo
              </Button>
            </a>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">No credit card needed — free for 30 days, cancel anytime</p>
        </div>

        {/* Stats */}
        <div className="max-w-3xl mx-auto mt-16 grid grid-cols-3 gap-6">
          {[
            { label: "Active Jewellers", value: "2,400+" },
            { label: "Transactions / Day", value: "18,000+" },
            { label: "Gold Tracked", value: "₹850 Cr+" },
          ].map(stat => (
            <div key={stat.label} className="text-center p-4 rounded-xl border border-border bg-card">
              <div className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything a jeweller actually needs</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Built from the ground up for Indian jewellers — whether you run a small counter or a chain of showrooms.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(feature => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 sm:px-6 bg-card/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Honest, simple pricing</h2>
            <p className="text-muted-foreground text-lg">Start free. Pay only when your business grows.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`relative p-6 rounded-2xl border transition-all ${
                  plan.highlight
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                      Most Popular
                    </div>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <div className="text-3xl font-extrabold text-primary mb-1">
                    {plan.price}
                    <span className="text-base font-normal text-muted-foreground">
                      {plan.price !== "Custom" ? "/mo" : ""}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.desc}</p>
                </div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/app/dashboard">
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                    data-testid={`button-plan-${plan.name.toLowerCase()}`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">2,400+ jewellers trust SwarnDesk</h2>
            <p className="text-muted-foreground text-lg">From busy counters in Surat to showrooms in Jaipur and Ahmedabad</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.name} className="p-6 rounded-2xl border border-border bg-card">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">"{t.text}"</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-10 rounded-3xl border border-primary/20 bg-primary/5">
            <div className="w-16 h-16 rounded-full bg-white border border-border shadow-md flex items-center justify-center mx-auto mb-6 overflow-hidden">
              <img src="/logo.png" alt="SwarnDesk" className="w-12 h-12 object-contain" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to simplify your jewellery business?</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join 2,400+ jewellers already using SwarnDesk. Your first 30 days are completely free — no setup fees, no contracts.
            </p>
            <Link href="/app/dashboard">
              <Button size="lg" className="gap-2 px-10 text-base font-semibold" data-testid="button-cta-trial">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white border border-border flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="SwarnDesk" className="w-5 h-5 object-contain" />
            </div>
            <span className="font-bold">SwarnDesk</span>
            <span className="text-muted-foreground text-sm ml-2">India's Smartest Jewellery ERP</span>
          </div>
          <div className="text-xs text-muted-foreground">© 2025 SwarnDesk. Made with love for Indian jewellers.</div>
        </div>
      </footer>

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/919999999999?text=Hello+SwarnDesk+Support"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-all hover:scale-105"
        data-testid="button-whatsapp-float"
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </a>
    </div>
  );
}
