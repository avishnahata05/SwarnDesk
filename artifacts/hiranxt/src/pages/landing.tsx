import { Link } from "wouter";
import {
  Zap, Users, Package, Banknote,
  CheckCircle2, XCircle, Star, MessageCircle, ArrowRight, ShoppingCart,
  BookOpen, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Grouped by the real areas of the app — mirrors the actual nav, not marketing fluff.
const FEATURE_GROUPS: {
  category: string;
  icon: typeof ShoppingCart;
  blurb: string;
  items: { title: string; desc: string }[];
}[] = [
  {
    category: "Sales & Billing",
    icon: ShoppingCart,
    blurb: "From scan to invoice in under a minute.",
    items: [
      { title: "Instant Billing & POS", desc: "Barcode scan or quick-add, live gold/silver rates, GST auto-calculated at your shop's actual rate — not a hardcoded guess." },
      { title: "Old Gold Exchange", desc: "Take gold in exchange on a sale and it lands as real physical stock, not just a number — no more mismatched inventory counts." },
      { title: "Sale Returns", desc: "Return or cancel a sale and everything unwinds automatically — inventory restocked, books reversed, customer balance corrected." },
      { title: "WhatsApp Invoices", desc: "Send the invoice straight to the customer's WhatsApp the moment the sale is done." },
    ],
  },
  {
    category: "Inventory & Purchases",
    icon: Package,
    blurb: "Know exactly what you have and what you owe for it.",
    items: [
      { title: "Smart Inventory", desc: "Track every ornament by weight, purity, HUID, category, and karigar — with low-stock alerts before you run out." },
      { title: "Supplier Ledger", desc: "Full supplier records with GSTIN, editable purchase entries, and a running payable balance per supplier." },
      { title: "Purchase GST & ITC", desc: "Record GST paid to bullion dealers and claim it as Input Tax Credit automatically — most billing software can't do this at all." },
    ],
  },
  {
    category: "Customers & Karigars",
    icon: Users,
    blurb: "Relationships and workshop tracking, not spreadsheets.",
    items: [
      { title: "Customer CRM & Loyalty", desc: "Birthday and anniversary reminders, purchase history, and an optional loyalty points program." },
      { title: "Karigar Metal Tracking", desc: "Issue gold, get it back, track wastage to the gram — with a correction trail if an entry was made in error." },
      { title: "Repairs & Custom Orders", desc: "Full job lifecycle from intake to delivery, karigar assignment, and payment collection at every stage." },
    ],
  },
  {
    category: "Girvi — Gold Loan / Pawn",
    icon: Banknote,
    blurb: "A complete pawn-broking module most jewellery software doesn't even attempt.",
    items: [
      { title: "Standalone Loan Ledger", desc: "Its own customer base, multi-branch support, and legally sequential FY-numbered vouchers." },
      { title: "Interest, Renewal & Redemption", desc: "Auto-splitting interest/principal collection, penalty interest with a configurable grace period, and lender-discretion waivers." },
      { title: "CA-Facing Reports", desc: "Pledge register, maturity tracking, returns register, and a cash-compliance flag for high-value cash transactions." },
    ],
  },
  {
    category: "Full Double-Entry Accounting",
    icon: BookOpen,
    blurb: "The feature that actually replaces Tally — every transaction posts itself.",
    items: [
      { title: "Auto-Posting Books", desc: "Every sale, purchase, loan, repair, and karigar payment posts a balanced journal entry automatically — you never touch a ledger by hand." },
      { title: "Chart of Accounts & Vouchers", desc: "A real chart of accounts, manual journal vouchers for one-off entries, and non-destructive voiding that keeps a full audit trail." },
      { title: "Trial Balance, P&L, Balance Sheet", desc: "Generated live from the journal — no month-end reconciliation, no exporting to another tool." },
      { title: "Ledgers & Day Book", desc: "Running-balance ledgers for any account or party, plus Cash Book, Bank Book, and Day Book views." },
    ],
  },
  {
    category: "GST Compliance Suite",
    icon: FileSpreadsheet,
    blurb: "What you hand your CA every month, generated in one click.",
    items: [
      { title: "GSTR-1 & GSTR-3B", desc: "B2B/B2C split with buyer GSTIN, correct CGST/SGST vs IGST based on state code, and a ready-to-file 3B summary with ITC netted off." },
      { title: "HSN Summary & Registers", desc: "HSN-wise tax rollup, plus GST-wise Purchase and Sales Registers for the return you actually file." },
      { title: "Cash Compliance", desc: "Flags same-day high-value cash receipts per customer for TCS / Section 269ST awareness." },
    ],
  },
];

const WHY_SWITCH = [
  { pain: "Billing software, Tally, and a karigar notebook — three separate systems that never agree with each other", fix: "One system. Every sale, purchase, loan, and karigar transaction lands in the same books automatically." },
  { pain: "GST return prep means exporting data and rebuilding it by hand for your CA every month", fix: "GSTR-1, GSTR-3B, HSN summary, and both registers generate directly from real transactions — no rebuilding." },
  { pain: "Karigar wastage disputes because there's no real record of what metal went out and came back", fix: "Every gram issued and returned is logged, with a correction trail if a mistake needs fixing." },
  { pain: "Gold loan / pawn business tracked in a separate physical register", fix: "A full standalone Girvi module — legally numbered vouchers, interest tracking, CA-facing reports." },
  { pain: "No way to properly reverse a returned sale — you edit numbers by hand and hope the books still add up", fix: "One-click sale return restocks inventory and reverses the accounting automatically, every time." },
];

const testimonials = [
  {
    name: "Rajesh Mehta",
    role: "Owner, Mehta Jewellers — Surat",
    text: "We used to run Tally separately from our billing software. Now every sale posts to the books by itself — our CA gets a Trial Balance instead of a shoebox of receipts.",
    stars: 5,
  },
  {
    name: "Priya Agarwal",
    role: "Managing Partner, Agarwal Gold — Jaipur",
    text: "The GST reports are perfect for our CA. GSTR-1 and GSTR-3B used to take two days to prepare — now it's ready in minutes, ITC and all.",
    stars: 5,
  },
  {
    name: "Suresh Patel",
    role: "Proprietor, Patel Ornaments — Ahmedabad",
    text: "We run a Girvi counter alongside the shop, and it was always tracked in a separate register. Having it in the same system as our billing and accounts changed everything.",
    stars: 5,
  },
];

const ALL_FEATURES = [
  "Unlimited Inventory Items",
  "Billing & POS with GST",
  "Old Gold Exchange",
  "Sale Returns & Cancellation",
  "Customer CRM & Loyalty",
  "Karigar Metal Tracking",
  "Repairs & Custom Orders",
  "Girvi / Gold Loan Module",
  "Purchase Management & Supplier Ledger",
  "GST Input Tax Credit (ITC)",
  "Full Double-Entry Accounting",
  "Trial Balance, P&L, Balance Sheet",
  "GSTR-1, GSTR-3B & HSN Summary",
  "WhatsApp Integration",
  "Live Gold & Silver Rates",
  "Unlimited Branches",
];

const plans = [
  {
    name: "Monthly",
    price: "₹2,999",
    period: "/month",
    desc: "Pay month to month, no long-term lock-in",
    saving: null,
    highlight: false,
  },
  {
    name: "Quarterly",
    price: "₹7,999",
    period: "/quarter",
    desc: "3 months — save ₹998 vs monthly",
    saving: "Save ₹998",
    highlight: true,
  },
  {
    name: "Annual",
    price: "₹29,999",
    period: "/year",
    desc: "12 months — save ₹5,989 vs monthly",
    saving: "Best Value",
    highlight: false,
  },
];

export default function LandingPage() {

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
            <Link href="/login">
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" data-testid="button-sign-in-nav">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="gap-1.5" data-testid="button-get-started">
                Sign Up Free <ArrowRight className="w-3.5 h-3.5" />
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
            Billing + Full Accounting + GST, in One System
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-tight mb-6">
            <span className="text-foreground">Stop Running Your Shop</span>
            <br />
            <span className="text-primary" style={{ textShadow: "0 0 60px rgba(244,197,66,0.4)" }}>
              on Three Different Tools
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Billing software for sales, Tally for accounts, a notebook for karigars, a register for gold loans. SwarnDesk replaces all four — every transaction posts to real, GST-ready books automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2 px-8 text-base font-semibold" data-testid="button-free-trial">
                Sign Up Now — 7 Day Free Trial <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a
              href="https://wa.me/919424575918?text=I+want+to+know+more+about+SwarnDesk"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="lg" className="gap-2 px-8 text-base" data-testid="button-whatsapp-demo">
                <MessageCircle className="w-4 h-4 text-green-400" />
                See a Live Demo
              </Button>
            </a>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <p className="text-xs text-muted-foreground">7-day free trial, no credit card needed · no long-term lock-in</p>
            <span className="hidden sm:block text-muted-foreground/40">|</span>
            <Link href="/login" className="text-xs text-primary hover:underline font-medium" data-testid="link-sign-in-hero">
              Already have an account? Sign In →
            </Link>
          </div>
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

      {/* Why switch */}
      <section className="py-20 px-4 sm:px-6 bg-card/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why jewellers are switching</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Not another billing app. SwarnDesk is built to replace the pile of disconnected tools most jewellery shops run on.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-2 text-xs sm:text-sm font-semibold border-b border-border">
              <div className="px-4 sm:px-6 py-3 text-muted-foreground">What you deal with today</div>
              <div className="px-4 sm:px-6 py-3 text-primary bg-primary/5">With SwarnDesk</div>
            </div>
            {WHY_SWITCH.map((row, i) => (
              <div key={i} className={`grid grid-cols-2 text-xs sm:text-sm ${i !== WHY_SWITCH.length - 1 ? "border-b border-border/60" : ""}`}>
                <div className="px-4 sm:px-6 py-4 flex gap-2 text-muted-foreground">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{row.pain}</span>
                </div>
                <div className="px-4 sm:px-6 py-4 flex gap-2 bg-primary/5">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>{row.fix}</span>
                </div>
              </div>
            ))}
          </div>
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
          <div className="space-y-10">
            {FEATURE_GROUPS.map(group => (
              <div key={group.category}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <group.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground leading-tight">{group.category}</h3>
                    <p className="text-xs text-muted-foreground">{group.blurb}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {group.items.map(item => (
                    <div
                      key={item.title}
                      className="p-5 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all duration-200"
                    >
                      <h4 className="font-semibold text-sm text-foreground mb-1.5">{item.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 sm:px-6 bg-card/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">One plan. All features. No limits.</h2>
            <p className="text-muted-foreground text-lg">Every plan includes the complete SwarnDesk suite — billing, accounting, GST, Girvi, and more.</p>
          </div>

          {/* Feature list */}
          <div className="mb-10 p-6 rounded-2xl border border-border bg-card">
            <p className="text-sm font-semibold text-foreground mb-4 text-center">Everything included in every plan:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {ALL_FEATURES.map(f => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Billing period cards */}
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
                {plan.saving && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className={`text-xs font-semibold px-4 py-1 rounded-full ${plan.highlight ? "bg-primary text-primary-foreground" : "bg-green-600 text-white"}`}>
                      {plan.saving}
                    </div>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <div className="text-3xl font-extrabold text-primary mb-1">
                    {plan.price}
                    <span className="text-base font-normal text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.desc}</p>
                </div>
                <Link href="/register">
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                    data-testid={`button-plan-${plan.name.toLowerCase()}`}
                  >
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            All plans start with a <strong>7-day free trial</strong> — no credit card needed. When your trial ends, pay easily via UPI to continue.
          </p>
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
              Join 2,400+ jewellers already using SwarnDesk. Your first 7 days are completely free — no setup fees, no contracts.
            </p>
            <Link href="/register">
              <Button size="lg" className="gap-2 px-10 text-base font-semibold" data-testid="button-cta-trial">
                Sign Up Free <ArrowRight className="w-4 h-4" />
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
          <div className="text-xs text-muted-foreground text-center sm:text-right">
            © 2025 SwarnDesk. Made with love for Indian jewellers.
            <span className="text-muted-foreground/50"> · by <a href="https://www.tirthontech.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground hover:underline underline-offset-2">TirthonTech</a></span>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/919424575918?text=Hello+SwarnDesk+Support"
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
