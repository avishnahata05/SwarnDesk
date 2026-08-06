import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle, Save } from "lucide-react";
import { apiGet, apiSend } from "./api";
import type { Loan, LoanItem } from "./types";

const ITEM_TYPES = ["Necklace", "Bangle", "Ring", "Chain", "Earring", "Pendant", "Bracelet", "Mangalsutra", "Payal", "Tikka", "Nose Ring", "Other"];
const GOLD_PURITIES = ["24K", "22K", "18K", "14K"];
const SILVER_PURITIES = ["925"];

// Everything in this dialog is a data-entry correction, not a business event —
// it's only offered while loan.isEditable is true (no payment recorded yet).
// Real events (a payment, a return, a renewal) go through LoansTab's action
// dialogs instead, which is also where the accounting/audit trail lives.
export default function EditLoanDialog({ open, loan, onClose, onUpdated, onDeleted }: {
  open: boolean;
  loan: Loan | null;
  onClose: () => void;
  onUpdated: (loan: Loan) => void;
  onDeleted: (loanId: number) => void;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<LoanItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [form, setForm] = useState({
    loanAmount: "", interestRate: "", interestPeriod: "monthly", penaltyRate: "", processingFee: "",
    startDate: "", dueDate: "", notes: "", fatherName: "", address: "",
    customerName: "", customerMobile: "", kycDocType: "none", kycDocNumber: "",
  });
  const [savingTerms, setSavingTerms] = useState(false);
  const [savingItemKey, setSavingItemKey] = useState<number | null>(null);
  const [deletingLoan, setDeletingLoan] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newItem, setNewItem] = useState<{ show: boolean; itemType: string; quantity: string; metalType: string; purity: string; grossWeight: string; netWeight: string; estimatedValue: string; notes: string; itemCode: string }>({
    show: false, itemType: "Necklace", quantity: "1", metalType: "gold", purity: "22K", grossWeight: "", netWeight: "", estimatedValue: "", notes: "", itemCode: "",
  });

  const loadItems = useCallback(async () => {
    if (!loan) return;
    setLoadingItems(true);
    try {
      const data = await apiGet<LoanItem[]>(`/${loan.id}/items`);
      setItems(data);
    } catch {
      toast({ title: "Failed to load pledged items", variant: "destructive" });
    } finally {
      setLoadingItems(false);
    }
  }, [loan]);

  useEffect(() => {
    if (open && loan) {
      setForm({
        loanAmount: String(loan.loanAmount),
        interestRate: String(loan.interestRate),
        interestPeriod: loan.interestPeriod,
        penaltyRate: String(loan.penaltyRate),
        processingFee: String(loan.processingFee),
        startDate: loan.startDate.split("T")[0],
        dueDate: loan.dueDate.split("T")[0],
        notes: loan.notes ?? "",
        fatherName: loan.fatherName ?? "",
        address: loan.address ?? "",
        customerName: loan.customerName,
        customerMobile: loan.customerMobile,
        kycDocType: loan.kycDocType ?? "none",
        kycDocNumber: loan.kycDocNumber ?? "",
      });
      setConfirmDelete(false);
      setNewItem(n => ({ ...n, show: false }));
      loadItems();
    }
  }, [open, loan, loadItems]);

  if (!loan) return null;
  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1";
  const pledgedItems = items.filter(it => it.status === "pledged");

  const saveTerms = async () => {
    const la = parseFloat(form.loanAmount);
    if (!isFinite(la) || la <= 0) { toast({ title: "Loan amount must be positive", variant: "destructive" }); return; }
    const ir = parseFloat(form.interestRate);
    if (!isFinite(ir) || ir < 0 || ir > 100) { toast({ title: "Interest rate must be 0–100", variant: "destructive" }); return; }
    const startD = new Date(form.startDate);
    const dueD = new Date(form.dueDate);
    if (isNaN(startD.getTime()) || isNaN(dueD.getTime())) { toast({ title: "Invalid date", variant: "destructive" }); return; }
    if (dueD <= startD) { toast({ title: "Due date must be after the loan date", variant: "destructive" }); return; }
    if (!form.customerName.trim()) { toast({ title: "Customer name cannot be blank", variant: "destructive" }); return; }
    if (!form.customerMobile.trim()) { toast({ title: "Customer mobile cannot be blank", variant: "destructive" }); return; }

    setSavingTerms(true);
    try {
      const updated = await apiSend<Loan>(`/${loan.id}`, "PATCH", {
        loanAmount: la,
        interestRate: ir,
        interestPeriod: form.interestPeriod,
        penaltyRate: parseFloat(form.penaltyRate) || 0,
        processingFee: parseFloat(form.processingFee) || 0,
        startDate: startD.toISOString(),
        dueDate: dueD.toISOString(),
        notes: form.notes.trim() || null,
        fatherName: form.fatherName.trim() || null,
        address: form.address.trim() || null,
        customerName: form.customerName.trim(),
        customerMobile: form.customerMobile.trim(),
        kycDocType: form.kycDocType !== "none" ? form.kycDocType : null,
        kycDocNumber: form.kycDocNumber.trim() || null,
      });
      toast({ title: "Loan terms updated" });
      onUpdated(updated);
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to update loan", variant: "destructive" });
    } finally {
      setSavingTerms(false);
    }
  };

  const saveItem = async (it: LoanItem, patch: Partial<LoanItem>) => {
    setSavingItemKey(it.id);
    try {
      const result = await apiSend<{ item: LoanItem; loan: Loan }>(`/${loan.id}/items/${it.id}`, "PATCH", {
        itemType: patch.itemType, quantity: patch.quantity, metalType: patch.metalType, purity: patch.purity,
        grossWeight: patch.grossWeight, netWeight: patch.netWeight, estimatedValue: patch.estimatedValue,
        notes: patch.notes, itemCode: patch.itemCode,
      });
      setItems(prev => prev.map(x => x.id === it.id ? result.item : x));
      onUpdated(result.loan);
      toast({ title: "Item updated" });
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to update item", variant: "destructive" });
    } finally {
      setSavingItemKey(null);
    }
  };

  const deleteItem = async (it: LoanItem) => {
    if (pledgedItems.length <= 1) { toast({ title: "Cannot delete the loan's last item — delete the whole loan instead", variant: "destructive" }); return; }
    if (!confirm(`Remove "${it.itemType}" from this loan? Use this only to fix a mistake — if it was actually returned, cancel and use Release Items instead.`)) return;
    setSavingItemKey(it.id);
    try {
      const result = await apiSend<{ loan: Loan }>(`/${loan.id}/items/${it.id}`, "DELETE");
      setItems(prev => prev.filter(x => x.id !== it.id));
      onUpdated(result.loan);
      toast({ title: "Item removed" });
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to remove item", variant: "destructive" });
    } finally {
      setSavingItemKey(null);
    }
  };

  const addItem = async () => {
    const gw = parseFloat(newItem.grossWeight);
    if (!isFinite(gw) || gw <= 0) { toast({ title: "Enter a positive gross weight", variant: "destructive" }); return; }
    setSavingItemKey(-1);
    try {
      const result = await apiSend<{ item: LoanItem; loan: Loan }>(`/${loan.id}/items`, "POST", {
        itemType: newItem.itemType,
        quantity: Math.max(1, parseInt(newItem.quantity) || 1),
        metalType: newItem.metalType,
        purity: newItem.purity,
        grossWeight: gw,
        netWeight: parseFloat(newItem.netWeight || newItem.grossWeight) || gw,
        estimatedValue: parseFloat(newItem.estimatedValue) || 0,
        notes: newItem.notes.trim() || null,
        itemCode: newItem.itemCode.trim() || null,
      });
      setItems(prev => [...prev, result.item]);
      onUpdated(result.loan);
      setNewItem({ show: false, itemType: "Necklace", quantity: "1", metalType: "gold", purity: "22K", grossWeight: "", netWeight: "", estimatedValue: "", notes: "", itemCode: "" });
      toast({ title: "Item added" });
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to add item", variant: "destructive" });
    } finally {
      setSavingItemKey(null);
    }
  };

  const deleteLoan = async () => {
    setDeletingLoan(true);
    try {
      await apiSend(`/${loan.id}`, "DELETE");
      toast({ title: "Loan voided — disbursement entry reversed" });
      onDeleted(loan.id);
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to void loan", variant: "destructive" });
    } finally {
      setDeletingLoan(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Girvi Loan {loan.loanNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!loan.isEditable && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              This loan already has payment history, so amount/rate/dates and items can no longer be corrected here — use Collect/Renew/Redeem/Partial Release from the loan row instead.
            </div>
          )}

          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Details</div>
            <p className="text-[11px] text-muted-foreground -mt-2">
              This is a snapshot taken at pledge time — editing it here only fixes this loan's record, it does not change the customer's own profile.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Customer Name *</label><input className={inp} value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} /></div>
              <div><label className={lbl}>Mobile *</label><input className={inp} value={form.customerMobile} onChange={e => setForm(f => ({ ...f, customerMobile: e.target.value }))} /></div>
              <div>
                <label className={lbl}>ID Proof Type</label>
                <Select value={form.kycDocType} onValueChange={v => setForm(f => ({ ...f, kycDocType: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not on file</SelectItem>
                    <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                    <SelectItem value="pan">PAN Card</SelectItem>
                    <SelectItem value="voter_id">Voter ID</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="driving_license">Driving License</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className={lbl}>ID Proof Number</label><input className={inp} value={form.kycDocNumber} onChange={e => setForm(f => ({ ...f, kycDocNumber: e.target.value }))} /></div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Loan Terms</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Loan Amount (₹) *</label><input className={inp} type="number" disabled={!loan.isEditable} value={form.loanAmount} onChange={e => setForm(f => ({ ...f, loanAmount: e.target.value }))} /></div>
              <div>
                <label className={lbl}>Interest Period</label>
                <Select value={form.interestPeriod} onValueChange={v => setForm(f => ({ ...f, interestPeriod: v }))} disabled={!loan.isEditable}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Per Day</SelectItem>
                    <SelectItem value="weekly">Per Week</SelectItem>
                    <SelectItem value="monthly">Per Month</SelectItem>
                    <SelectItem value="yearly">Per Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className={lbl}>Interest Rate (%) per period</label><input className={inp} type="number" step="0.1" disabled={!loan.isEditable} value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} /></div>
              <div><label className={lbl}>Penalty Rate (%)</label><input className={inp} type="number" step="0.1" value={form.penaltyRate} onChange={e => setForm(f => ({ ...f, penaltyRate: e.target.value }))} /></div>
              <div><label className={lbl}>Processing Fee (₹)</label><input className={inp} type="number" disabled={!loan.isEditable} value={form.processingFee} onChange={e => setForm(f => ({ ...f, processingFee: e.target.value }))} /></div>
              <div>
                <label className={lbl}>Loan Date *</label>
                <input className={inp} type="date" disabled={!loan.isEditable} max={new Date().toISOString().split("T")[0]} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Due Date *</label>
                <input className={inp} type="date" disabled={!loan.isEditable} min={form.startDate} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div><label className={lbl}>Father's / Husband's Name</label><input className={inp} value={form.fatherName} onChange={e => setForm(f => ({ ...f, fatherName: e.target.value }))} /></div>
              <div className="sm:col-span-2">
                <label className={lbl}>Address</label>
                <Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} className="text-sm resize-y" />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Notes</label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-sm resize-y" />
              </div>
            </div>
            {loan.isEditable && (
              <p className="text-[11px] text-muted-foreground">
                Changing the loan amount or processing fee reverses the original disbursement entry and books a corrected one — the ledger stays balanced and auditable.
              </p>
            )}
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={saveTerms} disabled={savingTerms}>
                <Save className="w-3.5 h-3.5" />{savingTerms ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pledged Items</div>
              {loan.isEditable && (
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setNewItem(n => ({ ...n, show: !n.show }))}>
                  <Plus className="w-3 h-3" />Add Item
                </Button>
              )}
            </div>

            {loadingItems ? (
              <div className="text-xs text-muted-foreground py-2">Loading items...</div>
            ) : (
              pledgedItems.map(it => (
                <ItemEditRow key={it.id} item={it} editable={loan.isEditable} saving={savingItemKey === it.id} onSave={patch => saveItem(it, patch)} onDelete={() => deleteItem(it)} />
              ))
            )}

            {items.length > pledgedItems.length && (
              <p className="text-[11px] text-muted-foreground">
                {items.length - pledgedItems.length} other item(s) on this loan are already returned/transferred/forfeited and aren't shown here.
              </p>
            )}

            {newItem.show && loan.isEditable && (
              <div className="p-3 rounded-lg bg-background border border-dashed border-primary/40 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className={lbl}>Type</label>
                    <Select value={newItem.itemType} onValueChange={v => setNewItem(n => ({ ...n, itemType: v }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><label className={lbl}>Qty</label><input className={inp} type="number" min="1" value={newItem.quantity} onChange={e => setNewItem(n => ({ ...n, quantity: e.target.value }))} /></div>
                  <div>
                    <label className={lbl}>Metal</label>
                    <Select value={newItem.metalType} onValueChange={v => setNewItem(n => ({ ...n, metalType: v, purity: v === "silver" ? "925" : "22K" }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="gold">Gold</SelectItem><SelectItem value="silver">Silver</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={lbl}>Purity</label>
                    <Select value={newItem.purity} onValueChange={v => setNewItem(n => ({ ...n, purity: v }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {newItem.metalType === "silver" ? <SelectItem value="925">Silver 925</SelectItem> : GOLD_PURITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className={lbl}>Gross Wt (g/pc) *</label><input className={inp} type="number" step="0.001" value={newItem.grossWeight} onChange={e => setNewItem(n => ({ ...n, grossWeight: e.target.value }))} /></div>
                  <div><label className={lbl}>Net Wt (g/pc)</label><input className={inp} type="number" step="0.001" value={newItem.netWeight} onChange={e => setNewItem(n => ({ ...n, netWeight: e.target.value }))} placeholder="Same as gross" /></div>
                  <div><label className={lbl}>Est. Value (₹)</label><input className={inp} type="number" value={newItem.estimatedValue} onChange={e => setNewItem(n => ({ ...n, estimatedValue: e.target.value }))} /></div>
                  <div><label className={lbl}>Serial / Tag No.</label><input className={inp} value={newItem.itemCode} onChange={e => setNewItem(n => ({ ...n, itemCode: e.target.value }))} /></div>
                  <div className="sm:col-span-4"><label className={lbl}>Notes</label><input className={inp} value={newItem.notes} onChange={e => setNewItem(n => ({ ...n, notes: e.target.value }))} /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setNewItem(n => ({ ...n, show: false }))}>Cancel</Button>
                  <Button size="sm" onClick={addItem} disabled={savingItemKey === -1}>{savingItemKey === -1 ? "Adding..." : "Add Item"}</Button>
                </div>
              </div>
            )}
          </div>

          {loan.isEditable && (
            <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
              <div className="text-xs font-semibold text-destructive uppercase tracking-wide">Void This Loan</div>
              <p className="text-xs text-muted-foreground">
                Use this only if the loan was entered by mistake (wrong customer, duplicate, test entry). It reverses the disbursement entry in the books and marks the loan voided — the record stays for audit, nothing is deleted outright.
              </p>
              {!confirmDelete ? (
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5" />Void Loan
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive font-medium">Void {loan.loanNumber} for {formatCurrency(loan.loanAmount)}? This can't be undone.</span>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button size="sm" variant="destructive" onClick={deleteLoan} disabled={deletingLoan}>{deletingLoan ? "Voiding..." : "Confirm Void"}</Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemEditRow({ item, editable, saving, onSave, onDelete }: {
  item: LoanItem;
  editable: boolean;
  saving: boolean;
  onSave: (patch: Partial<LoanItem>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    itemType: item.itemType, quantity: String(item.quantity), metalType: item.metalType, purity: item.purity,
    grossWeight: String(item.grossWeight / item.quantity), netWeight: String(item.netWeight / item.quantity),
    estimatedValue: String(item.estimatedValue / item.quantity), notes: item.notes ?? "", itemCode: item.itemCode ?? "",
  });
  const inp = "w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary";
  const lbl = "text-[10px] text-muted-foreground block mb-0.5";

  const dirty =
    draft.itemType !== item.itemType || draft.quantity !== String(item.quantity) ||
    draft.metalType !== item.metalType || draft.purity !== item.purity ||
    draft.grossWeight !== String(item.grossWeight / item.quantity) ||
    draft.netWeight !== String(item.netWeight / item.quantity) ||
    draft.estimatedValue !== String(item.estimatedValue / item.quantity) ||
    draft.notes !== (item.notes ?? "") || draft.itemCode !== (item.itemCode ?? "");

  return (
    <div className="p-3 rounded-lg bg-background border border-border space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className={lbl}>Type</label>
          <Select value={draft.itemType} onValueChange={v => setDraft(d => ({ ...d, itemType: v }))} disabled={!editable}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><label className={lbl}>Qty</label><input className={inp} type="number" min="1" disabled={!editable} value={draft.quantity} onChange={e => setDraft(d => ({ ...d, quantity: e.target.value }))} /></div>
        <div>
          <label className={lbl}>Metal</label>
          <Select value={draft.metalType} onValueChange={v => setDraft(d => ({ ...d, metalType: v, purity: v === "silver" ? "925" : d.purity }))} disabled={!editable}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="gold">Gold</SelectItem><SelectItem value="silver">Silver</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <label className={lbl}>Purity</label>
          <Select value={draft.purity} onValueChange={v => setDraft(d => ({ ...d, purity: v }))} disabled={!editable}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {draft.metalType === "silver" ? <SelectItem value="925">Silver 925</SelectItem> : GOLD_PURITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><label className={lbl}>Gross Wt (g/pc)</label><input className={inp} type="number" step="0.001" disabled={!editable} value={draft.grossWeight} onChange={e => setDraft(d => ({ ...d, grossWeight: e.target.value }))} /></div>
        <div><label className={lbl}>Net Wt (g/pc)</label><input className={inp} type="number" step="0.001" disabled={!editable} value={draft.netWeight} onChange={e => setDraft(d => ({ ...d, netWeight: e.target.value }))} /></div>
        <div><label className={lbl}>Est. Value (₹/pc)</label><input className={inp} type="number" disabled={!editable} value={draft.estimatedValue} onChange={e => setDraft(d => ({ ...d, estimatedValue: e.target.value }))} /></div>
        <div><label className={lbl}>Serial / Tag No.</label><input className={inp} disabled={!editable} value={draft.itemCode} onChange={e => setDraft(d => ({ ...d, itemCode: e.target.value }))} /></div>
        <div className="sm:col-span-4"><label className={lbl}>Notes</label><input className={inp} disabled={!editable} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></div>
      </div>
      {editable && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={onDelete} disabled={saving}>
            <Trash2 className="w-3 h-3" />Remove
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={!dirty || saving}
            onClick={() => onSave({
              itemType: draft.itemType,
              quantity: Math.max(1, parseInt(draft.quantity) || 1),
              metalType: draft.metalType,
              purity: draft.purity,
              grossWeight: parseFloat(draft.grossWeight) || 0,
              netWeight: parseFloat(draft.netWeight) || 0,
              estimatedValue: parseFloat(draft.estimatedValue) || 0,
              notes: draft.notes.trim() || null,
              itemCode: draft.itemCode.trim() || null,
            } as unknown as Partial<LoanItem>)}
          >
            <Save className="w-3 h-3" />{saving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
