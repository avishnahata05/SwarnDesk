import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface TourStep {
  /** Matches a `data-tour="<id>"` attribute somewhere in the app shell */
  id: string;
  title: string;
  body: string;
  placement: "right" | "bottom" | "top" | "left";
}

// Ordered walk through the app shell — sidebar first (always present), then
// a couple of dashboard-only elements. Steps whose target isn't in the DOM
// (e.g. a staff account without Accounting/Settings access) are skipped
// automatically by TourOverlay, so this list can stay role-agnostic.
export const TOUR_STEPS: TourStep[] = [
  { id: "brand", title: "Welcome to SwarnDesk", body: "This is your jewellery shop's command center. Let's walk through the essentials — it only takes a minute.", placement: "right" },
  { id: "nav-dashboard", title: "Dashboard", body: "A live snapshot of today's sales, profit, and stock — the first thing to check every morning.", placement: "right" },
  { id: "nav-billing", title: "Billing & POS", body: "Create sales, print invoices, and apply GST or old-gold exchange in a few taps.", placement: "right" },
  { id: "nav-inventory", title: "Inventory", body: "Manage your stock, weights, purity, and HUID/hallmark details.", placement: "right" },
  { id: "nav-customers", title: "Customers", body: "Every customer's purchase history and loyalty points, in one place.", placement: "right" },
  { id: "nav-accounting", title: "Accounting", body: "Full double-entry books and ledgers that update automatically as you sell.", placement: "right" },
  { id: "nav-settings", title: "Settings", body: "Your shop profile, tax rules, metal rates, and branding all live here.", placement: "right" },
  { id: "rate-ticker", title: "Today's Metal Rates", body: "Update gold and silver rates here each morning — every bill and stock valuation uses these live rates.", placement: "bottom" },
  { id: "stat-cards", title: "Your Numbers, Live", body: "Sales, profit, inventory value and more — always up to date.", placement: "bottom" },
  { id: "quick-actions", title: "Quick Actions", body: "Jump straight into your most common tasks from right here.", placement: "bottom" },
];

type TourPhase = "idle" | "welcome" | "running";

interface TourContextValue {
  phase: TourPhase;
  stepIndex: number;
  steps: TourStep[];
  /** Explicit "Take a tour" entry point — always replays from the top */
  start: () => void;
  beginSteps: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  finish: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

function tourKey(userId: number) {
  return `sd_tour_completed_${userId}`;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [phase, setPhase] = useState<TourPhase>("idle");
  const [stepIndex, setStepIndex] = useState(0);

  // Auto-offer the tour once per user, the first time they land on the dashboard.
  useEffect(() => {
    if (!user || phase !== "idle") return;
    if (location !== "/app/dashboard") return;
    if (localStorage.getItem(tourKey(user.id))) return;
    setPhase("welcome");
  }, [user, location, phase]);

  const markCompleted = useCallback(() => {
    if (user) localStorage.setItem(tourKey(user.id), "1");
  }, [user]);

  const start = useCallback(() => {
    if (location !== "/app/dashboard") navigate("/app/dashboard");
    setStepIndex(0);
    setPhase("welcome");
  }, [location, navigate]);

  const beginSteps = useCallback(() => {
    setStepIndex(0);
    setPhase("running");
  }, []);

  // Pure bounds-safe increment — callers (the Next button, and TourOverlay's
  // auto-skip-if-missing effect) are responsible for calling finish() instead
  // once they're on the last step, so this never needs a side effect.
  const next = useCallback(() => {
    setStepIndex(i => Math.min(i + 1, TOUR_STEPS.length - 1));
  }, []);

  const prev = useCallback(() => {
    setStepIndex(i => Math.max(0, i - 1));
  }, []);

  const skip = useCallback(() => {
    setPhase("idle");
    markCompleted();
    toast({ title: "You can replay the tour anytime from the sidebar." });
  }, [markCompleted, toast]);

  const finish = useCallback(() => {
    setPhase("idle");
    markCompleted();
    toast({ title: "Tour complete!", description: "Replay it anytime from “Take a Tour” in the sidebar." });
  }, [markCompleted, toast]);

  return (
    <TourContext.Provider value={{ phase, stepIndex, steps: TOUR_STEPS, start, beginSteps, next, prev, skip, finish }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}
