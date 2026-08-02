import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Small "i" icon that explains one confusing term/field/button in place.
// Uses a click-triggered Popover (not a hover-only Tooltip) so it works the
// same way on touch devices as on desktop — a shop's front desk is often on
// a tablet or phone, where hover doesn't exist.
export function InfoTooltip({ text, className }: { text: string; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          className={`inline-flex items-center justify-center align-middle text-muted-foreground/70 hover:text-primary transition-colors ${className ?? ""}`}
          aria-label="More info"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 text-xs leading-relaxed"
        align="start"
        onClick={e => e.stopPropagation()}
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}
