import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { useTour } from "@/contexts/TourContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CARD_WIDTH = 300;
const CARD_HEIGHT_ESTIMATE = 170;
const GAP = 12;
const VIEWPORT_MARGIN = 12;

/** Tracks the on-screen box of the current step's target, re-measuring on
 * scroll/resize and while layout is still settling (e.g. mid smooth-scroll). */
function useTargetBox(targetId: string | null) {
  const [box, setBox] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!targetId) {
      setBox(null);
      return;
    }
    let cancelled = false;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${targetId}"]`);
      if (!el) {
        if (!cancelled) setBox(null);
        return;
      }
      if (!cancelled) setBox(el.getBoundingClientRect());
    };
    const el = document.querySelector(`[data-tour="${targetId}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    // Poll briefly to track the element while a smooth-scroll is in flight.
    const interval = setInterval(measure, 200);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [targetId]);

  return box;
}

function cardPosition(box: DOMRect, placement: "top" | "bottom" | "left" | "right") {
  let top: number;
  let left: number;
  switch (placement) {
    case "right":
      left = box.right + GAP;
      top = box.top;
      break;
    case "left":
      left = box.left - CARD_WIDTH - GAP;
      top = box.top;
      break;
    case "top":
      left = box.left;
      top = box.top - CARD_HEIGHT_ESTIMATE - GAP;
      break;
    default:
      left = box.left;
      top = box.bottom + GAP;
  }
  left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN);
  top = Math.min(Math.max(top, VIEWPORT_MARGIN), window.innerHeight - CARD_HEIGHT_ESTIMATE - VIEWPORT_MARGIN);
  return { top, left };
}

function WelcomeDialog() {
  const tour = useTour();
  return (
    <Dialog open onOpenChange={v => !v && tour.skip()}>
      <DialogContent className="max-w-sm">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-amber-500" />
          </div>
        </div>
        <DialogHeader>
          <DialogTitle className="text-center">Welcome to SwarnDesk 👋</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground text-center -mt-2">
          Take a 60-second tour to see where everything lives — Billing, Inventory, Customers, Accounting and more.
        </p>
        <DialogFooter className="sm:justify-center gap-2 pt-2">
          <Button variant="outline" onClick={tour.skip} data-testid="button-tour-skip">Skip for now</Button>
          <Button onClick={tour.beginSteps} data-testid="button-tour-start">Start Tour</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpotlightStep() {
  const tour = useTour();
  const step = tour.steps[tour.stepIndex];
  const box = useTargetBox(step.id);
  const isLast = tour.stepIndex === tour.steps.length - 1;

  // A step whose target isn't in the DOM (e.g. Accounting/Settings hidden for
  // this role) is skipped automatically rather than stalling the tour.
  useEffect(() => {
    const el = document.querySelector(`[data-tour="${step.id}"]`);
    if (el) return;
    const t = setTimeout(() => {
      if (document.querySelector(`[data-tour="${step.id}"]`)) return;
      if (isLast) tour.finish();
      else tour.next();
    }, 400);
    return () => clearTimeout(t);
  }, [step.id, tour, isLast]);

  if (!box) return null;

  const pad = 8;
  const spot = {
    top: box.top - pad,
    left: box.left - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
  const card = cardPosition(box, step.placement);

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="absolute inset-0" />
      <div
        className="absolute rounded-xl ring-2 ring-amber-400 pointer-events-none transition-all duration-300 ease-out"
        style={{ ...spot, boxShadow: "0 0 0 9999px rgba(15,23,42,0.6)" }}
      />
      <div
        className="absolute bg-popover text-popover-foreground rounded-xl shadow-2xl p-4 pointer-events-auto transition-all duration-300 ease-out border"
        style={{ top: card.top, left: card.left, width: CARD_WIDTH }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-amber-600 text-[11px] font-semibold uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            Step {tour.stepIndex + 1} of {tour.steps.length}
          </div>
          <button onClick={tour.skip} className="text-muted-foreground hover:text-foreground" aria-label="Skip tour" data-testid="button-tour-close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h3 className="font-bold text-sm mb-1">{step.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {tour.steps.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === tour.stepIndex ? "bg-amber-500" : "bg-muted"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {tour.stepIndex > 0 && (
              <Button size="sm" variant="outline" onClick={tour.prev} data-testid="button-tour-back">Back</Button>
            )}
            <Button size="sm" onClick={isLast ? tour.finish : tour.next} data-testid="button-tour-next">
              {isLast ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function TourOverlay() {
  const { phase } = useTour();
  if (phase === "welcome") return <WelcomeDialog />;
  if (phase === "running") return <SpotlightStep />;
  return null;
}
