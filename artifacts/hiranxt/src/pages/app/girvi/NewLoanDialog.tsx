import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, XCircle, AlertTriangle, Search, UserCheck, UserPlus } from "lucide-react";
import { API, getAuthHeaders, authHeader } from "./api";
import type { Rates, Branch, Customer } from "./types";
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

export default function NewLoanDialog({ open, onClose, onCreated, rates, branches }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  rates?: Rates;
  branches: Branch[];
}) {
  const { toast } = useToast();

  // Customer: search-existing vs create-new
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "", mobile: "", fatherName: "", address: "", altMobile: "", email: "",
    idProofType: "aadhaar", idProofNumber: "", pan: "", notes: "",
  });
  const [existingLoans, setExistingLoans] = useState<{ loanNumber: string; loanAmount: number; startDate: string; status: string }[]>([]);

  const [branchId, setBranchId] = useState("");
  const [form, setForm] = useState({
    loanAmount: "", interestRate: "2", penaltyRate: "1", interestPeriod: "monthly", processingFee: "0",
    startDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    notes: "",
  });
  const [items, setItems] = useState<ItemRow[]>([makeItem()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && branches.length > 0 && !branchId) {
      const def = branches.find(b => b.isDefault) ?? branches[0];
      setBranchId(String(def.id));
    }
  }, [open, branches]);

  // Debounced customer search by mobile/name
  useEffect(() => {
    if (!customerQuery.trim() || customerQuery.trim().length < 3) { setCustomerResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/customers?q=${encodeURIComponent(customerQuery.trim())}`, { headers: authHeader() });
        if (r.ok && !cancelled) setCustomerResults(await r.json());
      } catch { /* ignore */ }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [customerQuery]);

  // Detect existing active loans for the selected/found customer
  useEffect(() => {
    const mobile = selectedCustomer?.mobile ?? (creatingNew ? newCustomer.mobile : "");
    const digits = mobile.replace(/\D/g, "");
    if (digits.length < 10) { setExistingLoans([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}?mobile=${encodeURIComponent(digits)}&status=active`, { headers: authHeader() });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setExistingLoans(data.slice(0, 5));
      } catch { /* ignore */ }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [selectedCustomer, creatingNew, newCustomer.mobile]);

  const resetCustomerStep = () => {
    setSelectedCustomer(null);
    setCreatingNew(false);
    setCustomerQuery("");
    setCustomerResults([]);
    setNewCustomer({ name: "", mobile: "", fatherName: "", address: "", altMobile: "", email: "", idProofType: "aadhaar", idProofNumber: "", pan: "", notes: "" });
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setNc = (k: string, v: string) => setNewCustomer(f => ({ ...f, [k]: v }));

  const updateItem = useCallback((key: string, field: keyof ItemRow, value: string | number) => {
    setItems(prev => prev.map(it => {
      if (it.key !== key) return it;
      const updated = { ...it, [field]: value };
      if (field === "metalType") {
        const validPurities = value === "silver" ? SILVER_PURITIES : GOLD_PURITIES;
        if (!validPurities.includes(updated.purity)) {
          updated.purity = value === "silver" ? "925" : "22K";
        }
      }
      if (field === "grossWeight" || field === "netWeight" || field === "metalType" || field === "purity") {
        const wt = parseFloat(String(updated.netWeight || updated.grossWeight) || "0");
        if (wt > 0) {
          updated.estimatedValue = String(Math.round(wt * getItemRate(updated.metalType, updated.purity, rates)));
        }
      }
      return updated;
    }));
  }, [rates]);

  useEffect(() => {
    if (!rates) return;
    setItems(prev => prev.map(it => {
      const wt = parseFloat(it.netWeight || it.grossWeight) || 0;
      if (wt <= 0) return it;
      return { ...it, estimatedValue: String(Math.round(wt * getItemRate(it.metalType, it.purity, rates))) };
    }));
  }, [rates]);

  const addItem = () => setItems(prev => [...prev, makeItem()]);
  const removeItem = (key: string) => setItems(prev => prev.length > 1 ? prev.filter(it => it.key !== key) : prev);

  const totalGross = items.reduce((s, it) => s + (parseFloat(it.grossWeight) || 0) * it.quantity, 0);
  const totalNet = items.reduce((s, it) => s + (parseFloat(it.netWeight || it.grossWeight) || 0) * it.quantity, 0);
  const totalEst = items.reduce((s, it) => s + (parseFloat(it.estimatedValue) || 0) * it.quantity, 0);

  const loanAmt = parseFloat(form.loanAmount || "0");
  const ltv = totalEst > 0 ? (loanAmt / totalEst) * 100 : 0;

  const resetAll = () => {
    resetCustomerStep();
    setForm({
      loanAmount: "", interestRate: "2", penaltyRate: "1", interestPeriod: "monthly", processingFee: "0",
      startDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
      notes: "",
    });
    setItems([makeItem()]);
  };

  const handleSubmit = async () => {
    if (!selectedCustomer && !creatingNew) { toast({ title: "Search for an existing customer or create a new one", variant: "destructive" }); return; }
    if (creatingNew) {
      if (!newCustomer.name.trim()) { toast({ title: "Customer name is required", variant: "destructive" }); return; }
      if (!newCustomer.mobile.trim()) { toast({ title: "Customer mobile is required", variant: "destructive" }); return; }
    }
    for (const it of items) {
      if (it.itemType === "Other" && !it.customItemType.trim()) { toast({ title: "Enter a name for the custom item type", variant: "destructive" }); return; }
      const gw = parseFloat(it.grossWeight);
      if (!isFinite(gw) || gw <= 0) { toast({ title: `Enter gross weight for ${it.itemType === "Other" ? it.customItemType.trim() : it.itemType}`, variant: "destructive" }); return; }
    }
    const la = parseFloat(form.loanAmount);
    if (!isFinite(la) || la <= 0) { toast({ title: "Loan amount must be a positive number", variant: "destructive" }); return; }
    const ir = parseFloat(form.interestRate);
    if (!isFinite(ir) || ir < 0 || ir > 100) { toast({ title: "Interest rate must be between 0 and 100", variant: "destructive" }); return; }
    if (!form.startDate) { toast({ title: "Loan date is required", variant: "destructive" }); return; }
    const startD = new Date(form.startDate);
    if (isNaN(startD.getTime())) { toast({ title: "Invalid loan date", variant: "destructive" }); return; }
    if (startD.getTime() > Date.now() + 86400000) { toast({ title: "Loan date cannot be in the future", variant: "destructive" }); return; }
    if (!form.dueDate) { toast({ title: "Due date is required", variant: "destructive" }); return; }
    const dueD = new Date(form.dueDate);
    if (isNaN(dueD.getTime())) { toast({ title: "Invalid due date", variant: "destructive" }); return; }
    if (dueD <= startD) { toast({ title: "Due date must be after the loan date", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({
          customerId: selectedCustomer?.id,
          newCustomer: creatingNew ? {
            name: newCustomer.name, mobile: newCustomer.mobile, fatherName: newCustomer.fatherName.trim() || null,
            address: newCustomer.address.trim() || null, altMobile: newCustomer.altMobile.trim() || null,
            email: newCustomer.email.trim() || null, idProofType: newCustomer.idProofType || null,
            idProofNumber: newCustomer.idProofNumber.trim() || null, pan: newCustomer.pan.trim() || null,
            notes: newCustomer.notes.trim() || null,
          } : undefined,
          branchId: branchId ? parseInt(branchId) : undefined,
          loanAmount: la,
          interestRate: ir,
          penaltyRate: parseFloat(form.penaltyRate) || 0,
          processingFee: parseFloat(form.processingFee) || 0,
          interestPeriod: form.interestPeriod,
          startDate: startD.toISOString(),
          dueDate: dueD.toISOString(),
          notes: form.notes.trim() || null,
          items: items.map(it => ({
            itemType: it.itemType === "Other" ? it.customItemType.trim() : it.itemType,
            quantity: it.quantity,
            metalType: it.metalType,
            purity: it.purity,
            grossWeight: parseFloat(it.grossWeight),
            netWeight: parseFloat(it.netWeight || it.grossWeight) || parseFloat(it.grossWeight),
            estimatedValue: parseFloat(it.estimatedValue) || 0,
            notes: it.notes.trim() || null,
            itemCode: it.itemCode.trim() || null,
          })),
        }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({ error: "Failed" }));
        throw new Error(errData.error ?? "Failed");
      }
      toast({ title: "Girvi loan created!" });
      onCreated();
      resetAll();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to create loan", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1";
  const customerResolved = !!selectedCustomer || creatingNew;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); resetAll(); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Girvi Loan</DialogTitle></DialogHeader>
        <div className="space-y-4">

          {/* Customer: search-or-create */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</div>

            {customerResolved ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <span className="font-medium">{selectedCustomer?.name ?? newCustomer.name}</span>
                  <span className="text-xs text-muted-foreground">{selectedCustomer?.mobile ?? newCustomer.mobile}</span>
                  {selectedCustomer && <span className="text-[10px] text-muted-foreground font-mono">{selectedCustomer.customerCode}</span>}
                  {creatingNew && <span className="text-[10px] text-emerald-600">(new)</span>}
                </div>
                <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={resetCustomerStep}>Change</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input className={`${inp} pl-9`} value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} placeholder="Search by name or mobile number..." />
                </div>
                {customerResults.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {customerResults.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedCustomer(c)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm hover:border-primary/40 hover:bg-primary/5 text-left"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.mobile} · {c.customerCode}</span>
                      </button>
                    ))}
                  </div>
                )}
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setCreatingNew(true)}>
                  <UserPlus className="w-3.5 h-3.5" />Create New Customer
                </Button>
              </>
            )}

            {creatingNew && !selectedCustomer && (
              <div className="p-3 rounded-lg bg-background border border-border space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={lbl}>Customer Name *</label><input className={inp} value={newCustomer.name} onChange={e => setNc("name", e.target.value)} placeholder="Full name" /></div>
                  <div><label className={lbl}>Mobile *</label><input className={inp} value={newCustomer.mobile} onChange={e => setNc("mobile", e.target.value)} placeholder="+91 XXXXX XXXXX" /></div>
                  <div><label className={lbl}>Father's Name</label><input className={inp} value={newCustomer.fatherName} onChange={e => setNc("fatherName", e.target.value)} placeholder="Father's / husband's name" /></div>
                  <div><label className={lbl}>Alt. Mobile</label><input className={inp} value={newCustomer.altMobile} onChange={e => setNc("altMobile", e.target.value)} /></div>
                </div>
                <div>
                  <label className={lbl}>Address</label>
                  <Textarea value={newCustomer.address} onChange={e => setNc("address", e.target.value)} placeholder="Full address (multiple lines allowed)" rows={2} className="text-sm resize-y" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>ID Proof Type</label>
                    <Select value={newCustomer.idProofType} onValueChange={v => setNc("idProofType", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                        <SelectItem value="pan">PAN Card</SelectItem>
                        <SelectItem value="voter_id">Voter ID</SelectItem>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="driving_license">Driving License</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><label className={lbl}>ID Proof Number</label><input className={inp} value={newCustomer.idProofNumber} onChange={e => setNc("idProofNumber", e.target.value)} /></div>
                  <div><label className={lbl}>PAN (optional)</label><input className={inp} value={newCustomer.pan} onChange={e => setNc("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" /></div>
                </div>
              </div>
            )}

            {existingLoans.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  This customer already has {existingLoans.length} active loan{existingLoans.length !== 1 ? "s" : ""}. You can still create a new loan for additional jewellery.
                </div>
                <div className="space-y-1">
                  {existingLoans.map(el => (
                    <div key={el.loanNumber} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-amber-200">
                      <span className="font-mono font-semibold text-amber-900">{el.loanNumber}</span>
                      <span className="text-muted-foreground">Started {new Date(el.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      <span className="font-semibold text-primary">{formatCurrency(el.loanAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pledged Items */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pledged Items</div>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addItem}>
                <Plus className="w-3 h-3" />Add Item
              </Button>
            </div>

            {items.map((it, idx) => (
              <div key={it.key} className="p-3 rounded-lg bg-background border border-border space-y-2 relative">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove item"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <div className="text-xs font-medium text-muted-foreground">Item {idx + 1}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-1">
                    <label className={lbl}>Type</label>
                    <Select value={it.itemType} onValueChange={v => updateItem(it.key, "itemType", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    {it.itemType === "Other" && (
                      <input
                        className={`${inp} mt-1`}
                        value={it.customItemType}
                        onChange={e => updateItem(it.key, "customItemType", e.target.value)}
                        placeholder="Enter item name"
                        autoFocus
                      />
                    )}
                  </div>
                  <div>
                    <label className={lbl}>Qty</label>
                    <input className={inp} type="number" min="1" value={it.quantity}
                      onChange={e => updateItem(it.key, "quantity", Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <div>
                    <label className={lbl}>Metal</label>
                    <Select value={it.metalType} onValueChange={v => updateItem(it.key, "metalType", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={lbl}>Purity</label>
                    <Select value={it.purity} onValueChange={v => updateItem(it.key, "purity", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {it.metalType === "silver" ? (
                          <SelectItem value="925">Silver 925</SelectItem>
                        ) : (
                          GOLD_PURITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={lbl}>Gross Wt (g/pc) *</label>
                    <input className={inp} type="number" step="0.001" value={it.grossWeight}
                      onChange={e => updateItem(it.key, "grossWeight", e.target.value)} placeholder="0.000" />
                  </div>
                  <div>
                    <label className={lbl} title="Net weight (pure metal, after removing stones/other material) is used to value the loan">
                      Net Wt (g/pc) <span className="text-muted-foreground/60">used for valuation</span>
                    </label>
                    <input className={inp} type="number" step="0.001" value={it.netWeight}
                      onChange={e => updateItem(it.key, "netWeight", e.target.value)} placeholder="Same as gross" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Est. Value (₹) <span className="text-muted-foreground/60">auto · editable</span></label>
                    <input className={inp} type="number" value={it.estimatedValue}
                      onChange={e => updateItem(it.key, "estimatedValue", e.target.value)} placeholder="0" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Serial / Tag No. <span className="text-muted-foreground/60">written on the item's tag</span></label>
                    <input className={inp} value={it.itemCode} onChange={e => updateItem(it.key, "itemCode", e.target.value)} placeholder="Optional — e.g. shop tag number" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Item Notes <span className="text-muted-foreground/60">e.g. identifying marks, scratches</span></label>
                    <input className={inp} value={it.notes} onChange={e => updateItem(it.key, "notes", e.target.value)} placeholder="Optional" />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
              <div><span className="text-muted-foreground">Total Gross: </span><strong>{totalGross.toFixed(3)} g</strong></div>
              <div><span className="text-muted-foreground">Total Net: </span><strong>{totalNet.toFixed(3)} g</strong></div>
              <div><span className="text-muted-foreground">Total Est. Value: </span><strong className="text-primary">{formatCurrency(totalEst)}</strong></div>
            </div>
          </div>

          {/* Loan terms */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Loan Terms</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {branches.length > 1 && (
                <div>
                  <label className={lbl}>Branch</label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{branches.filter(b => b.isActive).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><label className={lbl}>Loan Amount (₹) *</label><input className={inp} type="number" value={form.loanAmount} onChange={e => set("loanAmount", e.target.value)} /></div>
              <div>
                <label className={lbl}>Interest Period</label>
                <Select value={form.interestPeriod} onValueChange={v => set("interestPeriod", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Per Day</SelectItem>
                    <SelectItem value="weekly">Per Week</SelectItem>
                    <SelectItem value="monthly">Per Month</SelectItem>
                    <SelectItem value="yearly">Per Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className={lbl}>Interest Rate (%) per period</label><input className={inp} type="number" step="0.1" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} /></div>
              <div>
                <label className={lbl}>Penalty Rate (%) <span className="text-muted-foreground/60">extra if overdue</span></label>
                <input className={inp} type="number" step="0.1" value={form.penaltyRate} onChange={e => set("penaltyRate", e.target.value)} placeholder="e.g. 1" />
              </div>
              <div><label className={lbl}>Processing Fee (₹) <span className="text-muted-foreground/60">one-time, taxable</span></label><input className={inp} type="number" value={form.processingFee} onChange={e => set("processingFee", e.target.value)} /></div>
              <div>
                <label className={lbl}>Loan Date * <span className="text-muted-foreground/60">defaults to today — back-date for entries done later</span></label>
                <input className={inp} type="date" value={form.startDate} max={new Date().toISOString().split("T")[0]} onChange={e => set("startDate", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Due Date *</label>
                <input className={inp} type="date" value={form.dueDate} min={form.startDate || new Date().toISOString().split("T")[0]} onChange={e => set("dueDate", e.target.value)} />
                <DueDatePresets from={form.startDate ? new Date(form.startDate) : new Date()} onPick={v => set("dueDate", v)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Notes</label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Remarks, conditions, etc. (multiple lines allowed)" rows={2} className="text-sm resize-y" />
              </div>
            </div>
          </div>

          {loanAmt > 0 && totalEst > 0 && (
            <div
              className={`p-3 rounded-xl border text-xs ${ltv > 80 ? "bg-red-50 border-red-200 text-red-700" : ltv > 60 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-green-50 border-green-200 text-green-700"}`}
              title="LTV = loan amount as a % of the gold's current market value. Higher means less safety margin."
            >
              <strong>LTV: {ltv.toFixed(0)}%</strong> — {ltv > 80 ? "⚠ High risk" : ltv > 60 ? "Moderate risk" : "Good — comfortable margin"}
              <span className="text-muted-foreground/70"> (loan amount as % of gold's market value)</span>
            </div>
          )}

          {form.loanAmount && form.interestRate && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
              <div className="font-semibold text-primary mb-1">Interest Preview</div>
              {(() => {
                const principal = parseFloat(form.loanAmount || "0");
                const rate = parseFloat(form.interestRate || "0");
                const pd = form.interestPeriod === "daily" ? 1 : form.interestPeriod === "weekly" ? 7 : form.interestPeriod === "yearly" ? 365 : 30;
                const dailyRate = (rate / 100) / pd;
                return (
                  <>
                    <div className="text-muted-foreground mb-1">
                      {rate}% per {form.interestPeriod} ({(dailyRate * 100).toFixed(4)}%/day) = <strong>{formatCurrency(Math.round(principal * dailyRate))}/day</strong>
                    </div>
                    {[{ label: "1 month (30d)", days: 30 }, { label: "3 months (90d)", days: 90 }, { label: "6 months (180d)", days: 180 }].map(({ label, days }) => {
                      const interest = Math.round(principal * (rate / 100) * (days / pd));
                      return (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span>Interest: {formatCurrency(interest)} · Total: {formatCurrency(principal + interest)}</span>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { onClose(); resetAll(); }}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>{submitting ? "Creating..." : "Create Girvi Loan"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
