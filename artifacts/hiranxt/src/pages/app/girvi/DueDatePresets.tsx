import { addMonths, toDateInputValue } from "./api";

const PRESETS = [
  { label: "1 Month", months: 1 },
  { label: "3 Months", months: 3 },
  { label: "6 Months", months: 6 },
  { label: "1 Year", months: 12 },
];

// Quick-pick buttons for a due-date <input type="date">, relative to `from`
// (today for a new loan, the loan's current due date for an extension, etc.)
// so the lender doesn't have to type or scroll a date picker every time.
export default function DueDatePresets({ from, onPick }: { from: Date; onPick: (isoDate: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-1.5">
      {PRESETS.map(p => (
        <button
          key={p.label}
          type="button"
          onClick={() => onPick(toDateInputValue(addMonths(from, p.months)))}
          className="px-2 py-0.5 rounded-full text-[11px] font-medium border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
