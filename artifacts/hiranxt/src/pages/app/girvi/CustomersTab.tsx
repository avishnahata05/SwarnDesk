import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useBackClose } from "@/hooks/use-back-close";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Search, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Pencil, Trash2 } from "lucide-react";
import { API, getAuthHeaders, authHeader } from "./api";
import type { Customer, CustomerStatement } from "./types";

type CustomerForm = {
  name: string; mobile: string; fatherName: string; address: string; altMobile: string; email: string;
  idProofType: string; idProofNumber: string; pan: string; notes: string;
};

const emptyForm: CustomerForm = { name: "", mobile: "", fatherName: "", address: "", altMobile: "", email: "", idProofType: "aadhaar", idProofNumber: "", pan: "", notes: "" };

export default function CustomersTab() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statements, setStatements] = useState<Record<number, CustomerStatement>>({});

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const closeForm = useCallback(() => setShowForm(false), []);
  useBackClose(showForm, closeForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/customers`, { headers: authHeader() });
      if (r.ok) setCustomers(await r.json());
    } catch {
      toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.mobile.includes(q) || c.customerCode.toLowerCase().includes(q));
  }, [customers, search]);

  const loadStatement = async (id: number) => {
    if (statements[id]) return;
    try {
      const r = await fetch(`${API}/customers/${id}/statement`, { headers: authHeader() });
      if (r.ok) { const data = await r.json(); setStatements(prev => ({ ...prev, [id]: data })); }
    } catch { /* silent */ }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
    if (expandedId !== id) loadStatement(id);
  };

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      name: c.name, mobile: c.mobile, fatherName: c.fatherName ?? "", address: c.address ?? "",
      altMobile: c.altMobile ?? "", email: c.email ?? "", idProofType: c.idProofType ?? "aadhaar",
      idProofNumber: c.idProofNumber ?? "", pan: c.pan ?? "", notes: c.notes ?? "",
    });
    setShowForm(true);
  };

  const setF = (k: keyof CustomerForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    try {
      const r = await fetch(`${API}/customers/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({ error: "Failed" }))).error ?? "Failed");
      toast({ title: "Customer deleted" });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to delete", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!form.mobile.trim()) { toast({ title: "Mobile is required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const body = {
        name: form.name, mobile: form.mobile, fatherName: form.fatherName.trim() || null,
        address: form.address.trim() || null, altMobile: form.altMobile.trim() || null, email: form.email.trim() || null,
        idProofType: form.idProofType || null, idProofNumber: form.idProofNumber.trim() || null,
        pan: form.pan.trim() || null, notes: form.notes.trim() || null,
      };
      const r = editingId
        ? await fetch(`${API}/customers/${editingId}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body) })
        : await fetch(`${API}/customers`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast({ title: editingId ? "Customer updated" : "Customer created" });
      setShowForm(false);
      setStatements(prev => { if (editingId) { const n = { ...prev }; delete n[editingId]; return n; } return prev; });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Girvi Customers
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Standalone customer ledger — KYC, contact details, full transaction history</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />New Customer
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, mobile, or customer code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && customers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading customers...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{search ? `No customers found for "${search}"` : "No customers yet — create your first one."}</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(c => {
                const statement = statements[c.id];
                const expanded = expandedId === c.id;
                return (
                  <div key={c.id} className="px-3 md:px-4 py-3">
                    <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => toggleExpand(c.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{c.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">{c.customerCode}</span>
                          {c.kycComplete ? (
                            <Badge variant="outline" className="text-[10px] gap-1 text-emerald-700 border-emerald-300"><ShieldCheck className="w-3 h-3" />KYC OK</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] gap-1 text-amber-700 border-amber-300"><ShieldAlert className="w-3 h-3" />KYC Missing</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{c.mobile}{c.fatherName ? ` · F/H: ${c.fatherName}` : ""}</div>
                      </div>
                      {statement && (
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-primary">{formatCurrency(statement.summary.totalOutstanding)}</div>
                          <div className="text-xs text-muted-foreground">{statement.summary.activeLoans} active loan{statement.summary.activeLoans !== 1 ? "s" : ""}</div>
                        </div>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0" onClick={e => { e.stopPropagation(); openEdit(c); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0 text-red-600" onClick={e => { e.stopPropagation(); handleDelete(c.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <div className="text-muted-foreground flex-shrink-0">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                    </div>

                    {expanded && (
                      <div className="mt-3 space-y-3">
                        {!statement ? (
                          <div className="text-xs text-muted-foreground">Loading statement...</div>
                        ) : (
                          <>
                            <div className="p-3 rounded-xl bg-muted/20 border border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div><div className="text-muted-foreground mb-1 font-medium">Total Loans</div><div className="font-bold text-lg">{statement.summary.totalLoans}</div></div>
                              <div><div className="text-muted-foreground mb-1 font-medium">Outstanding Principal</div><div className="font-bold text-lg">{formatCurrency(statement.summary.outstandingPrincipal)}</div></div>
                              <div><div className="text-muted-foreground mb-1 font-medium">Outstanding Interest</div><div className="font-bold text-lg">{formatCurrency(statement.summary.outstandingInterest)}</div></div>
                              <div><div className="text-muted-foreground mb-1 font-medium">Total Interest Paid (All Time)</div><div className="font-bold text-lg text-emerald-600">{formatCurrency(statement.summary.totalInterestPaidAllTime)}</div></div>
                            </div>
                            {(c.address || c.idProofNumber || c.pan) && (
                              <div className="p-3 rounded-xl bg-muted/10 border border-border text-xs space-y-1">
                                {c.address && <div className="whitespace-pre-line"><span className="text-muted-foreground">Address: </span>{c.address}</div>}
                                {c.idProofType && <div><span className="text-muted-foreground">{c.idProofType.replace(/_/g, " ").toUpperCase()}: </span>{c.idProofNumber ?? "—"}</div>}
                                {c.pan && <div><span className="text-muted-foreground">PAN: </span>{c.pan}</div>}
                              </div>
                            )}
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-1.5">Loans ({statement.loans.length})</div>
                              <div className="rounded-lg border border-border divide-y divide-border/50">
                                {statement.loans.map(l => (
                                  <div key={l.id} className="flex items-center justify-between px-3 py-2 text-xs">
                                    <div><span className="font-mono">{l.loanNumber}</span> <Badge variant="outline" className="text-[10px] ml-1">{l.status}</Badge></div>
                                    <div className="text-right">
                                      <div className="font-semibold">{formatCurrency(l.loanAmount)}</div>
                                      <div className="text-muted-foreground">{l.status === "active" || l.status === "extended" ? `Due: ${formatCurrency(l.totalDue)}` : ""}</div>
                                    </div>
                                  </div>
                                ))}
                                {statement.loans.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No loans yet.</div>}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-1.5">Payment History ({statement.payments.length})</div>
                              <div className="rounded-lg border border-border divide-y divide-border/50 max-h-48 overflow-y-auto">
                                {statement.payments.map(p => (
                                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-xs">
                                    <div>
                                      <span className="font-mono">{p.loanNumber}</span> <span className="text-muted-foreground">{p.paymentType}</span>
                                      <div className="text-muted-foreground">{new Date(p.paymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {p.paymentMode}</div>
                                    </div>
                                    <div className="font-semibold text-emerald-600">{formatCurrency(p.amount)}</div>
                                  </div>
                                ))}
                                {statement.payments.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No payments recorded yet.</div>}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit Customer" : "New Girvi Customer"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Name *</label><input className={inp} value={form.name} onChange={e => setF("name", e.target.value)} /></div>
              <div><label className={lbl}>Mobile *</label><input className={inp} value={form.mobile} onChange={e => setF("mobile", e.target.value)} /></div>
              <div><label className={lbl}>Father's Name</label><input className={inp} value={form.fatherName} onChange={e => setF("fatherName", e.target.value)} /></div>
              <div><label className={lbl}>Alt. Mobile</label><input className={inp} value={form.altMobile} onChange={e => setF("altMobile", e.target.value)} /></div>
              <div><label className={lbl}>Email</label><input className={inp} value={form.email} onChange={e => setF("email", e.target.value)} /></div>
              <div>
                <label className={lbl}>ID Proof Type</label>
                <Select value={form.idProofType} onValueChange={v => setF("idProofType", v)}>
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
              <div><label className={lbl}>ID Proof Number</label><input className={inp} value={form.idProofNumber} onChange={e => setF("idProofNumber", e.target.value)} /></div>
              <div><label className={lbl}>PAN</label><input className={inp} value={form.pan} onChange={e => setF("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" /></div>
            </div>
            <div>
              <label className={lbl}>Address</label>
              <Textarea value={form.address} onChange={e => setF("address", e.target.value)} rows={2} className="text-sm resize-y" placeholder="Multiple lines allowed" />
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <Textarea value={form.notes} onChange={e => setF("notes", e.target.value)} rows={2} className="text-sm resize-y" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>{submitting ? "Saving..." : editingId ? "Save Changes" : "Create Customer"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
