import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Gem, Zap, Users, Hammer, Package,
  CheckCircle2, Star, MessageCircle, ArrowRight, ShoppingCart, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: LayoutDashboard, title: "Live Dashboard", desc: "Real-time gold rates, daily P&L, and sales analytics at a glance." },
  { icon: Package, title: "Smart Inventory", desc: "Track every item by weight, purity, HUID, and karigar. Never lose stock." },
  { icon: ShoppingCart, title: "Instant Billing", desc: "One-screen POS with GST auto-calculation, exchange gold, and WhatsApp invoices." },
  { icon: Users, title: "Customer CRM", desc: "Birthday reminders, loyalty schemes, and full purchase history per customer." },
  { icon: Hammer, title: "Karigar Tracking", desc: "Issue metal by weight, track wastage, and manage wages for every artisan." },
  { icon: Zap, title: "AI Assistant", desc: "Ask HiraNXT anything — low stock, best-sellers, today's profit — in plain language." },
];

const testimonials = [
  {
    name: "Rajesh Mehta",
    role: "Owner, Mehta Jewellers — Surat",
    text: "HiraNXT transformed how we run our 3 showrooms. The karigar tracking alone saved us 15 grams of gold per month in wastage disputes.",
    stars: 5,
  },
  {
    name: "Priya Agarwal",
    role: "Managing Partner, Agarwal Gold — Jaipur",
    text: "The GST reports and GSTR-1 export are perfect. Our CA is thrilled. We cut compliance time from 2 days to 2 hours every month.",
    stars: 5,
  },
  {
    name: "Suresh Patel",
    role: "Proprietor, Patel Ornaments — Ahmedabad",
    text: "The WhatsApp billing feature is a game-changer. My customers love getting their invoices instantly on WhatsApp.",
    stars: 5,
  },
];

const plans = [
  {
    name: "Starter",
    price: "₹999",
    desc: "Perfect for single-shop jewellers",
    features: ["1 Branch", "Up to 500 items", "Billing & POS", "Customer CRM", "GST Reports"],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹2,499",
    desc: "For growing jewellery businesses",
    features: ["5 Branches", "Unlimited items", "Karigar Management", "AI Assistant", "All Reports + Export", "WhatsApp Integration"],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "For large chains & wholesalers",
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
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Gem className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">HiraNXT</span>
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
            <span className="text-foreground">India's Smartest</span>
            <br />
            <span className="text-primary" style={{ textShadow: "0 0 60px rgba(244,197,66,0.4)" }}>
              Jewellery ERP
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Manage inventory, billing, karigars, repairs, and GST compliance — all in one platform built for Indian jewellers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/app/dashboard">
              <Button size="lg" className="gap-2 px-8 text-base font-semibold" data-testid="button-free-trial">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a
              href="https://wa.me/919999999999?text=I+want+to+know+more+about+HiraNXT"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="lg" className="gap-2 px-8 text-base" data-testid="button-whatsapp-demo">
                <MessageCircle className="w-4 h-4 text-green-400" />
                WhatsApp Demo
              </Button>
            </a>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">No credit card required — 30 days free trial</p>
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
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything a jeweller needs</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Built ground-up for the Indian jewellery trade — from retail counters to wholesale operations.
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
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">Start free. Upgrade when you're ready.</p>
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
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Trusted by 2,400+ jewellers</h2>
            <p className="text-muted-foreground text-lg">Across India's jewellery hubs — Mumbai, Surat, Jaipur, Ahmedabad</p>
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
            <Gem className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to transform your jewellery business?</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join 2,400+ jewellers already using HiraNXT. Start your 30-day free trial today.
            </p>
            <Link href="/app/dashboard">
              <Button size="lg" className="gap-2 px-10 text-base font-semibold" data-testid="button-cta-trial">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-primary" />
            <span className="font-bold">HiraNXT</span>
            <span className="text-muted-foreground text-sm ml-2">India's Smartest Jewellery ERP</span>
          </div>
          <div className="text-xs text-muted-foreground">© 2025 HiraNXT. Made with love for Indian jewellers.</div>
        </div>
      </footer>

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/919999999999?text=Hello+HiraNXT+Support"
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
