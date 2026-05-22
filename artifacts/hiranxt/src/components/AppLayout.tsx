import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useGetCurrentRates } from "@workspace/api-client-react";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Hammer, Wrench,
  TruckIcon, BarChart3, Settings, Menu, X, Gem, MessageCircle, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/app/dashboard", label: "Dashboard", labelHi: "डैशबोर्ड", icon: LayoutDashboard },
  { href: "/app/inventory", label: "Inventory", labelHi: "इन्वेंटरी", icon: Package },
  { href: "/app/billing", label: "Billing & POS", labelHi: "बिलिंग", icon: ShoppingCart },
  { href: "/app/customers", label: "Customers", labelHi: "ग्राहक", icon: Users },
  { href: "/app/karigars", label: "Karigars", labelHi: "कारीगर", icon: Hammer },
  { href: "/app/repairs", label: "Repairs", labelHi: "मरम्मत", icon: Wrench },
  { href: "/app/purchases", label: "Purchases", labelHi: "खरीद", icon: TruckIcon },
  { href: "/app/reports", label: "Reports", labelHi: "रिपोर्ट", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", labelHi: "सेटिंग्स", icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [goldRate, setGoldRate] = useState(7250);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const { data: rates } = useGetCurrentRates();

  useEffect(() => {
    if (rates) setGoldRate(rates.gold22k);
  }, [rates]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGoldRate(prev => prev + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 5));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Gem className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground tracking-tight">HiraNXT</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Jewellery ERP</div>
          </div>
          <button
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, labelHi, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                location === href || location.startsWith(href)
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {lang === "hi" ? labelHi : label}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-sidebar-border">
          <a
            href="https://wa.me/919999999999?text=Hello+HiraNXT+Support"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp Support
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 flex-shrink-0">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Gold ticker */}
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-1.5 border border-border text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-muted-foreground">22K Gold</span>
              <span className="font-semibold text-primary">₹{goldRate.toLocaleString("en-IN")}/g</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-background rounded-lg px-3 py-1.5 border border-border text-xs">
              <span className="text-muted-foreground">Silver</span>
              <span className="font-semibold text-muted-foreground">₹{rates?.silver ? Math.round(rates.silver).toLocaleString("en-IN") : "95"}/g</span>
            </div>
          </div>

          {/* Language toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLang(l => l === "en" ? "hi" : "en")}
            data-testid="button-language-toggle"
            className="text-xs gap-1.5"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "en" ? "हिंदी" : "English"}
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
