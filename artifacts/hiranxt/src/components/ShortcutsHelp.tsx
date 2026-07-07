import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { useBackClose } from "@/hooks/use-back-close";

export interface ShortcutHelpItem {
  keys: string;
  description: string;
}

export function ShortcutsHelpDialog({
  open, onClose, shortcuts, title = "Keyboard Shortcuts",
}: {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutHelpItem[];
  title?: string;
}) {
  useBackClose(open, onClose);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {shortcuts.map(s => (
            <div key={s.keys} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground">{s.description}</span>
              <kbd className="px-2 py-0.5 rounded border border-border bg-muted text-xs font-mono font-semibold min-w-[1.5rem] text-center">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Shortcuts pause automatically while typing in a text field, and while a dialog is open.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// Small ghost button to make single-key shortcuts discoverable for mouse users.
export function ShortcutsHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Keyboard shortcuts (?)"
      data-testid="button-shortcuts-help"
    >
      <Keyboard className="w-3.5 h-3.5" />
      <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">?</kbd>
    </button>
  );
}
