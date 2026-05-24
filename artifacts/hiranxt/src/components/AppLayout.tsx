import { useState, useEffect, useCallback } from "react";
import { useBackClose } from "@/hooks/use-back-close";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useGetCurrentRates, useUpdateRates, getGetCurrentRatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Hammer, Wrench,
  TruckIcon, BarChart3, Settings, Menu, X, MessageCircle, Globe, Banknote,
  ChevronRight, Pencil, LogOut, ShieldCheck, Megaphone, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/app/dashboard", label: "Dashboard", labelHi: "डैशबोर्ड", icon: LayoutDashboard },
  { href: "/app/inventory", label: "Inventory", labelHi: "इन्वेंटरी", icon: Package },
  { href: "/app/billing", label: "Billing & POS", labelHi: "बिलिंग", icon: ShoppingCart },
  { href: "/app/customers", label: "Customers", labelHi: "ग्राहक", icon: Users },
  { href: "/app/karigars", label: "Karigars", labelHi: "कारीगर", icon: Hammer },
  { href: "/app/repairs", label: "Repairs", labelHi: "मरम्मत", icon: Wrench },
  { href: "/app/girvi", label: "Girvi", labelHi: "गिरवी", icon: Banknote },
  { href: "/app/purchases", label: "Purchases", labelHi: "खरीद", icon: TruckIcon },
  { href: "/app/marketing", label: "Marketing", labelHi: "मार्केटिंग", icon: Megaphone },
  { href: "/app/pending-payments", label: "Pending Payments", labelHi: "बकाया भुगतान", icon: Clock },
  { href: "/app/reports", label: "Reports", labelHi: "रिपोर्ट", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", labelHi: "सेटिंग्स", icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  // Seed from localStorage so rate shows immediately on refresh (before API responds)
  const [goldRate, setGoldRate] = useState(() => {
    const cached = parseFloat(localStorage.getItem("sd_gold22k") || "");
    return isFinite(cached) ? Math.round(cached * 10) : 72500;
  });

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  useBackClose(sidebarOpen, closeSidebar);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [rateForm, setRateForm] = useState({ gold22k: "", gold24k: "", gold18k: "", silver: "" });

  const { data: rates } = useGetCurrentRates();
  const updateRates = useUpdateRates();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (rates) {
      setGoldRate(Math.round(rates.gold22k * 10));
      // Persist to localStorage so rates survive page refresh
      localStorage.setItem("sd_gold22k", rates.gold22k.toString());
      localStorage.setItem("sd_silver", rates.silver.toString());
      setRateForm({
        gold22k: String(Math.round(rates.gold22k * 10)),
        gold24k: String(Math.round(rates.gold24k * 10)),
        gold18k: String(Math.round(rates.gold18k * 10)),
        silver: String(Math.round(rates.silver * 1000)),
      });
    }
  }, [rates]);

  const openRateDialog = () => {
    if (rates) {
      setRateForm({
        gold22k: String(Math.round(rates.gold22k * 10)),
        gold24k: String(Math.round(rates.gold24k * 10)),
        gold18k: String(Math.round(rates.gold18k * 10)),
        silver: String(Math.round(rates.silver * 1000)),
      });
    }
    setRateDialogOpen(true);
  };

  const saveRates = () => {
    const payload: Record<string, number> = {};
    if (rateForm.gold22k) payload.gold22k = parseFloat(rateForm.gold22k) / 10;
    if (rateForm.gold24k) payload.gold24k = parseFloat(rateForm.gold24k) / 10;
    if (rateForm.gold18k) payload.gold18k = parseFloat(rateForm.gold18k) / 10;
    if (rateForm.silver) payload.silver = parseFloat(rateForm.silver) / 1000;

    updateRates.mutate({ data: payload }, {
      onSuccess: (updated) => {
        setGoldRate(Math.round(updated.gold22k * 10));
        localStorage.setItem("sd_gold22k", updated.gold22k.toString());
        localStorage.setItem("sd_silver", updated.silver.toString());
        queryClient.invalidateQueries({ queryKey: getGetCurrentRatesQueryKey() });
        setRateDialogOpen(false);
        toast({ title: "Metal rates updated successfully" });
      },
      onError: () => toast({ title: "Failed to update rates", variant: "destructive" }),
    });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col bg-sidebar transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden border border-white/20">
            <img src="/logo.png" alt="SwarnDesk" className="w-7 h-7 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-white tracking-tight">SwarnDesk</div>
            <div className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Jewellery ERP</div>
          </div>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, labelHi, icon: Icon }) => {
            const isActive = location === href || location.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-white text-sidebar font-semibold shadow-sm"
                    : "text-white/75 hover:bg-white/[0.10] hover:text-white"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-sidebar" : "text-white/70 group-hover:text-white")} />
                <span className="flex-1 truncate">{lang === "hi" ? labelHi : label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-sidebar/50 flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-white/10 space-y-1">
          {/* User info */}
          {user && (
            <div className="px-3 py-2 mb-1">
              <div className="text-[12px] font-semibold text-white truncate">{user.shopName}</div>
              <div className="text-[11px] text-white/50 truncate">{user.email}</div>
            </div>
          )}

          {/* Admin Panel link */}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/60 hover:bg-white/10 hover:text-white transition-all"
              onClick={() => setSidebarOpen(false)}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              Admin Panel
            </Link>
          )}

          <a
            href="https://wa.me/919424575918?text=Hello+SwarnDesk+Support"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/60 hover:bg-white/10 hover:text-white transition-all"
          >
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            WhatsApp Support
          </a>

          {/* Logout */}
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/60 hover:bg-white/10 hover:text-white transition-all text-left"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 flex-shrink-0 shadow-xs">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Gold ticker — clickable */}
          <div className="flex items-center gap-2 flex-1">
            <button
              className="hidden sm:flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs hover:bg-amber-100 transition-colors group cursor-pointer"
              onClick={openRateDialog}
              data-testid="button-header-gold-rate"
              title="Click to update today's rates"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
              <span className="text-amber-700 font-medium">22K Gold</span>
              <span className="font-bold text-amber-800">₹{goldRate.toLocaleString("en-IN")}/10g</span>
              <Pencil className="w-3 h-3 text-amber-500 group-hover:text-amber-700 transition-colors" />
            </button>
            <button
              className="hidden md:flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs hover:bg-muted/80 transition-colors group cursor-pointer"
              onClick={openRateDialog}
              data-testid="button-header-silver-rate"
              title="Click to update today's rates"
            >
              <span className="text-muted-foreground">Silver</span>
              <span className="font-semibold text-foreground">₹{rates?.silver ? Math.round(rates.silver * 1000).toLocaleString("en-IN") : "95000"}/kg</span>
              <Pencil className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>

          {/* Language toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLang(l => l === "en" ? "hi" : "en")}
            data-testid="button-language-toggle"
            className="text-xs gap-1.5 h-8"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "en" ? "हिंदी" : "English"}
          </Button>
        </header>

        {/* Subscription / trial expiry banner */}
        {user && user.role !== "admin" && (() => {
          const now = Date.now();
          let daysLeft = 0;
          let label = "";
          let urgent = false;

          if (user.plan === "trial") {
            daysLeft = Math.ceil((new Date(user.trialEndsAt).getTime() - now) / 86400000);
            label = daysLeft > 0
              ? `Free trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Subscribe to keep access.`
              : "Your free trial has ended.";
            urgent = daysLeft <= 2;
          } else if (user.plan === "active" && user.subscriptionEndsAt) {
            daysLeft = Math.ceil((new Date(user.subscriptionEndsAt).getTime() - now) / 86400000);
            if (daysLeft <= 7) {
              label = daysLeft > 0
                ? `Subscription expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Renew to avoid interruption.`
                : "Your subscription has expired.";
              urgent = daysLeft <= 2;
            }
          }

          if (!label) return null;
          return (
            <div className={cn(
              "flex items-center justify-between px-4 py-2 text-xs font-medium flex-shrink-0",
              urgent ? "bg-red-600 text-white" : "bg-amber-500 text-white"
            )}>
              <span>{label}</span>
              <Link href="/payment" className="underline font-semibold whitespace-nowrap ml-3 hover:opacity-80">
                {user.plan === "active" ? "Renew now →" : "Subscribe now →"}
              </Link>
            </div>
          );
        })()}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Rate Update Dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Update Today's Metal Rates
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Check your <strong>local sarafa / bullion market</strong> rates every morning and update manually. Enter gold <strong>per 10 grams</strong> and silver <strong>per kg</strong>.
            </p>
            <div className="space-y-3">
              {[
                { label: "Gold 22K (₹ per 10g)", key: "gold22k", placeholder: "e.g. 72500" },
                { label: "Gold 24K (₹ per 10g)", key: "gold24k", placeholder: "e.g. 79500" },
                { label: "Gold 18K (₹ per 10g)", key: "gold18k", placeholder: "e.g. 59400" },
                { label: "Silver (₹ per kg)", key: "silver", placeholder: "e.g. 95000" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">{label}</label>
                  <Input
                    type="number"
                    step="1"
                    value={rateForm[key as keyof typeof rateForm]}
                    onChange={e => setRateForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    data-testid={`input-rate-${key}`}
                  />
                </div>
              ))}
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <strong>Note:</strong> These rates apply immediately to all new bills and inventory calculations. Old bills are not affected.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveRates} disabled={updateRates.isPending} data-testid="button-save-rates">
              {updateRates.isPending ? "Saving..." : "Update Rates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
