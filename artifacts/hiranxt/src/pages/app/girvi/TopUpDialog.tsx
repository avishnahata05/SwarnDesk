import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, XCircle, PlusCircle } from "lucide-react";
import { API, getAuthHeaders } from "./api";
import type { Loan, Rates } from "./types";
import DueDatePresets from "./DueDatePresets";

type ItemRow = {
  key: string;
  itemType: string;
  customItemType: string;
  quantity: number;
  metalType: string;
  purity: string;
  grossWeight: string;
  netWeight: string;
  estimatedValue: string;
  notes: string;
  itemCode: string;
};

const ITEM_TYPES = ["Necklace", "Bangle", "Ring", "Chain", "Earring", "Pendant", "Bracelet", "Mangalsutra", "Payal", "Tikka", "Nose Ring", "Other"];
const GOLD_PURITIES = ["24K", "22K", "18K", "14K"];
const SILVER_PURITIES = ["925"];

function makeItem(): ItemRow {
  return { key: Math.random().toString(36).slice(2), itemType: "Necklace", customItemType: "", quantity: 1, metalType: "gold", purity: "22K", grossWeight: "", netWeight: "", estimatedValue: "", notes: "", itemCode: "" };
}

function getItemRate(metalType: string, purity: string, rates?: Rates) {
  if (metalType === "silver") return rates?.silver ?? 95;
  const map: Record<string, number> = {
    "24K": rates?.gold24k ?? 7950,
    "22K": rates?.gold22k ?? 7250,
    "18K": rates?.gold18k ?? 5940,
    "14K": Math.round((rates?.gold18k ?? 5940) * 14 / 18),
    "925": rates?.silver ?? 95,
  };
  return map[purity] ?? rates?.gold22k ?? 7250;
}

export default function TopUpDialog({ open, loan, onClose, onToppedUp, rates }: {
  open: boolean;
  loan: Loan | null;
  onClose: () => void;
  onToppedUp: (loan: Loan) => void;
  rates?: Rates;
}) {
  const { toast } = useToast();
  const [additionalAmount, setAdditionalAmount] = useState("");
  const [interestPaid, setInterestPaid] = useState("0");
  const [newDueDate, setNewDueDate] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [addingItems, setAddingItems] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([makeItem()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && loan) {
      setAdditionalAmount("");
      setInterestPaid("0");
      const d = new Date(loan.dueDate);
      setNewDueDate(d.toISOString().split("T")[0]);
      setPaymentMode("cash");
      setNotes("");
      setAddingItems(false);
      setItems([makeItem()]);
    }
  }, [open, loan]);

  const updateItem = useCallback((key: string, field: keyof ItemRow, value: string | number) => {
    setItems(prev => prev.map(it => {
      if (it.key !== key) return it;
      const updated = { ...it, [field]: value };
      if (field === "metalType") {
        const validPurities = value === "silver" ? SILVER_PURITIES : GOLD_PURITIES;
        if (!validPurities.includes(updated.purity)) updated.purity = value === "silver" ? "925" : "22K";
      }
      if (field === "grossWeight" || field === "netWeight" || field === "metalType" || field === "purity") {
        const wt = parseFloat(String(updated.netWeight || updated.grossWeight) || "0");
        if (wt > 0) updated.estimatedValue = String(Math.round(wt * getItemRate(updated.metalType, updated.purity, rates)));
      }
      return updated;
    }));
  }, [rates]);

  if (!loan) return null;

  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1";

  const addAmt = parseFloat(additionalAmount) || 0;
  const newPrincipal = loan.currentPrincipal + addAmt;
  const itemsTotal = addingItems ? items.reduce((s, it) => s + (parseFloat(it.estimatedValue) || 0) * it.quantity, 0) : 0;

  const handleSubmit = async () => {
    const amt = parseFloat(additionalAmount);
    if (!isFinite(amt) || amt <= 0) { toast({ title: "Enter a positive top-up amount", variant: "destructive" }); return; }
    const paid = parseFloat(interestPaid) || 0;
    if (paid < 0) { toast({ title: "Interest collected cannot be negative", variant: "destructive" }); return; }
    if (!newDueDate) { toast({ title: "Select a due date", variant: "destructive" }); return; }
    const dueD = new Date(newDueDate);
    if (isNaN(dueD.getTime()) || dueD <= new Date()) { toast({ title: "Due date must be in the future", variant: "destructive" }); return; }

    let itemsPayload: Record<string, unknown>[] | undefined;
    if (addingItems) {
      for (const it of items) {
        if (it.itemType === "Other" && !it.customItemType.trim()) { toast({ title: "Enter a name for the custom item type", variant: "destructive" }); return; }
        const gw = parseFloat(it.grossWeight);
        if (!isFinite(gw) || gw <= 0) { toast({ title: `Enter gross weight for ${it.itemType === "Other" ? it.customItemType.trim() : it.itemType}`, variant: "destructive" }); return; }
      }
      itemsPayload = items.map(it => ({
        itemType: it.itemType === "Other" ? it.customItemType.trim() : it.itemType,
        quantity: it.quantity,
        metalType: it.metalType,
        purity: it.purity,
        grossWeight: parseFloat(it.grossWeight),
        netWeight: parseFloat(it.netWeight || it.grossWeight) || parseFloat(it.grossWeight),
        estimatedValue: parseFloat(it.estimatedValue) || 0,
        notes: it.notes.trim() || null,
        itemCode: it.itemCode.trim() || null,
      }));
    }

    setSubmitting(true);
    try {
      const r = await fetch(`${API}/${loan.id}/topup`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({
          additionalAmount: amt,
          interestPaid: paid,
          newDueDate: dueD.toISOString(),
          paymentMode,
          notes: notes.trim() || null,
          items: itemsPayload,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      const updated: Loan = await r.json();
      toast({ title: `₹${amt.toLocaleString("en-IN")} top-up disbursed` });
      onToppedUp(updated);
      onClose();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to top up loan", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Top-Up Loan {loan.loanNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><strong>{loan.customerName}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Current principal</span><span>{formatCurrency(loan.currentPrincipal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Outstanding interest</span><span>{formatCurrency(loan.outstandingInterest)}</span></div>
            <div className="flex justify-between border-t border-border pt-1"><span className="text-muted-foreground">Collateral on file</span><span>{loan.metalType.toUpperCase()} {loan.purity} · {loan.grossWeight.toFixed(3)}g · {formatCurrency(loan.estimatedValue)}</span></div>
          </div>

          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
            Topping up resets the interest clock to today for future interest — like a renewal — but any interest already owed stays on the books, it isn't erased.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lbl}>Additional Amount (₹) *</label><input className={inp} type="number" value={additionalAmount} onChange={e => setAdditionalAmount(e.target.value)} autoFocus /></div>
            <div>
              <label className={lbl}>Interest collected now (₹) <span className="text-muted-foreground/60">optional</span></label>
              <input className={inp} type="number" value={interestPaid} onChange={e => setInterestPaid(e.target.value)} placeholder="0 if nothing collected now" />
            </div>
            {parseFloat(interestPaid) > 0 && (
              <div>
                <label className={lbl}>Payment mode</label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className={lbl}>New Due Date *</label>
              <input className={inp} type="date" value={newDueDate} min={new Date().toISOString().split("T")[0]} onChange={e => setNewDueDate(e.target.value)} />
              <DueDatePresets from={new Date()} onPick={setNewDueDate} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Notes (optional)</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Customer brought an additional item for more funds" rows={2} className="text-sm resize-y" />
            </div>
          </div>

          {addAmt > 0 && (
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              New principal after top-up: <strong>{formatCurrency(newPrincipal)}</strong> ({formatCurrency(loan.currentPrincipal)} + {formatCurrency(addAmt)})
            </div>
          )}

          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Additional Collateral</div>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddingItems(v => !v)}>
                <PlusCircle className="w-3 h-3" />{addingItems ? "Remove items" : "Add items"}
              </Button>
            </div>
            {!addingItems && <p className="text-xs text-muted-foreground">Optional — only if the customer is pledging more collateral for this top-up.</p>}

            {addingItems && (
              <>
                {items.map((it, idx) => (
                  <div key={it.key} className="p-3 rounded-lg bg-background border border-border space-y-2 relative">
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(prev => prev.filter(x => x.key !== it.key))} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" title="Remove item">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <div className="text-xs font-medium text-muted-foreground">Item {idx + 1}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className={lbl}>Type</label>
                        <Select value={it.itemType} onValueChange={v => updateItem(it.key, "itemType", v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                        {it.itemType === "Other" && (
                          <input className={`${inp} mt-1`} value={it.customItemType} onChange={e => updateItem(it.key, "customItemType", e.target.value)} placeholder="Enter item name" />
                        )}
                      </div>
                      <div>
                        <label className={lbl}>Qty</label>
                        <input className={inp} type="number" min="1" value={it.quantity} onChange={e => updateItem(it.key, "quantity", Math.max(1, parseInt(e.target.value) || 1))} />
                      </div>
                      <div>
                        <label className={lbl}>Metal</label>
                        <Select value={it.metalType} onValueChange={v => updateItem(it.key, "metalType", v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="gold">Gold</SelectItem><SelectItem value="silver">Silver</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className={lbl}>Purity</label>
                        <Select value={it.purity} onValueChange={v => updateItem(it.key, "purity", v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {it.metalType === "silver" ? <SelectItem value="925">Silver 925</SelectItem> : GOLD_PURITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className={lbl}>Gross Wt (g/pc) *</label>
                        <input className={inp} type="number" step="0.001" value={it.grossWeight} onChange={e => updateItem(it.key, "grossWeight", e.target.value)} placeholder="0.000" />
                      </div>
                      <div>
                        <label className={lbl}>Net Wt (g/pc)</label>
                        <input className={inp} type="number" step="0.001" value={it.netWeight} onChange={e => updateItem(it.key, "netWeight", e.target.value)} placeholder="Same as gross" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={lbl}>Est. Value (₹) <span className="text-muted-foreground/60">auto · editable</span></label>
                        <input className={inp} type="number" value={it.estimatedValue} onChange={e => updateItem(it.key, "estimatedValue", e.target.value)} placeholder="0" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={lbl}>Serial / Tag No.</label>
                        <input className={inp} value={it.itemCode} onChange={e => updateItem(it.key, "itemCode", e.target.value)} placeholder="Optional" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={lbl}>Item Notes</label>
                        <input className={inp} value={it.notes} onChange={e => updateItem(it.key, "notes", e.target.value)} placeholder="Optional" />
                      </div>
                    </div>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setItems(prev => [...prev, makeItem()])}>
                  <Plus className="w-3 h-3" />Add Another Item
                </Button>
                {itemsTotal > 0 && (
                  <div className="text-xs text-muted-foreground">Additional collateral value: <strong className="text-primary">{formatCurrency(itemsTotal)}</strong></div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>{submitting ? "Processing..." : "Confirm Top-Up"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
