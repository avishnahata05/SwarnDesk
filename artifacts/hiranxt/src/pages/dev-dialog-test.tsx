import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function DevDialogTest() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="p-8 space-y-4">
      <h1>Dialog/Sheet scroll test harness (temporary)</h1>
      <Button onClick={() => setDialogOpen(true)}>Open tall dialog</Button>
      <Button onClick={() => setSheetOpen(true)}>Open tall sheet</Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tall Test Dialog</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="p-3 border rounded" data-testid={`row-${i}`}>
                Field row {i + 1} — some content to force overflow
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button data-testid="submit-btn" onClick={() => setDialogOpen(false)}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right">
          <SheetHeader><SheetTitle>Tall Test Sheet</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="p-3 border rounded">
                Nav item {i + 1}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
