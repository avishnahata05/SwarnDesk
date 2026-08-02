import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";
import { useBackClose } from "@/hooks/use-back-close";

export interface PageHelpSection {
  heading: string;
  items: string[];
}

// The always-there answer to "what is this page for, again?" — same visual
// language as ShortcutsHelpDialog/Button, but explains the SCREEN rather than
// keyboard shortcuts. Every page/tab gets one of these next to its title.
export function PageHelpDialog({
  open, onClose, title, description, sections,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  sections?: PageHelpSection[];
}) {
  useBackClose(open, onClose);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          {sections?.map(s => (
            <div key={s.heading}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{s.heading}</div>
              <ul className="space-y-1">
                {s.items.map(item => (
                  <li key={item} className="text-sm flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Small ghost button, same shape as ShortcutsHelpButton — the discoverable,
// always-there entry point for "what does this page do".
export function PageHelpButton({ onClick, label = "Help" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="What is this page for?"
      data-testid="button-page-help"
    >
      <HelpCircle className="w-3.5 h-3.5" />
      <span className="underline decoration-dotted underline-offset-2">{label}</span>
    </button>
  );
}
