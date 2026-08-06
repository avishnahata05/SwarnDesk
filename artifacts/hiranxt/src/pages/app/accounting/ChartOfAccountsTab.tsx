import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Landmark, Plus, Lock, Ban, RotateCcw, Trash2, Pencil, Building2 } from "lucide-react";
import { apiGet, apiSend } from "./api";
import type { Account } from "./types";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";
import { InfoTooltip } from "@/components/InfoTooltip";

const TYPE_LABELS: Record<Account["accountType"], string> = {
  asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: "Expenses",
};
const TYPE_ORDER: Account["accountType"][] = ["asset", "liability", "equity", "income", "expense"];

export default function ChartOfAccountsTab() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", accountType: "expense" as Account["accountType"], openingBalance: "0", openingBalanceType: "debit" as "debit" | "credit" });
  const [pageHelpOpen, setPageHelpOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState({
    code: "", name: "", accountType: "expense" as Account["accountType"], openingBalance: "0", openingBalanceType: "debit" as "debit" | "credit",
    bankName: "", bankAccountNumber: "", bankIfsc: "", isDefaultBank: false,
  });
  const [editSaving, setEditSaving] = useState(false);

  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankForm, setBankForm] = useState({ code: "", name: "", bankName: "", bankAccountNumber: "", bankIfsc: "", openingBalance: "0", isDefaultBank: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await apiGet<Account[]>("/accounts"));
    } catch {
      toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAccount = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      await apiSend("/accounts", "POST", { ...form, openingBalance: parseFloat(form.openingBalance) || 0 });
      toast({ title: "Account created" });
      setDialogOpen(false);
      setForm({ code: "", name: "", accountType: "expense", openingBalance: "0", openingBalanceType: "debit" });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to create account", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const createBankAccount = async () => {
    if (!bankForm.code.trim() || !bankForm.name.trim()) return;
    setBankSaving(true);
    try {
      await apiSend("/accounts", "POST", {
        code: bankForm.code, name: bankForm.name, accountType: "asset", accountSubType: "bank",
        openingBalance: parseFloat(bankForm.openingBalance) || 0, openingBalanceType: "debit",
        bankName: bankForm.bankName || null, bankAccountNumber: bankForm.bankAccountNumber || null,
        bankIfsc: bankForm.bankIfsc || null, isDefaultBank: bankForm.isDefaultBank,
      });
      toast({ title: "Bank account added" });
      setBankDialogOpen(false);
      setBankForm({ code: "", name: "", bankName: "", bankAccountNumber: "", bankIfsc: "", openingBalance: "0", isDefaultBank: false });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to add bank account", variant: "destructive" });
    } finally { setBankSaving(false); }
  };

  const toggleActive = async (a: Account) => {
    try {
      await apiSend(`/accounts/${a.id}`, "PATCH", { isActive: !a.isActive });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" });
    }
  };

  const openEdit = (a: Account) => {
    setEditingAccount(a);
    setEditForm({
      code: a.code, name: a.name, accountType: a.accountType, openingBalance: String(a.openingBalance), openingBalanceType: a.openingBalanceType,
      bankName: a.bankName ?? "", bankAccountNumber: a.bankAccountNumber ?? "", bankIfsc: a.bankIfsc ?? "", isDefaultBank: a.isDefaultBank,
    });
  };

  const saveEdit = async () => {
    if (!editingAccount) return;
    if (!editForm.name.trim()) { toast({ title: "Account name is required", variant: "destructive" }); return; }
    if (!editingAccount.isSystemAccount && !editForm.code.trim()) { toast({ title: "Account code is required", variant: "destructive" }); return; }
    setEditSaving(true);
    try {
      // System accounts are matched by `code` elsewhere in the app (see
      // getOrCreateDefaultAccounts) — code/type stay fixed for them, only
      // rename + opening balance are sent.
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        openingBalance: parseFloat(editForm.openingBalance) || 0,
        openingBalanceType: editForm.openingBalanceType,
      };
      if (editingAccount.accountSubType === "bank") {
        body.bankName = editForm.bankName || null;
        body.bankAccountNumber = editForm.bankAccountNumber || null;
        body.bankIfsc = editForm.bankIfsc || null;
        body.isDefaultBank = editForm.isDefaultBank;
      }
      if (!editingAccount.isSystemAccount) {
        body.code = editForm.code.trim();
        body.accountType = editForm.accountType;
      }
      await apiSend(`/accounts/${editingAccount.id}`, "PATCH", body);
      toast({ title: "Account updated" });
      setEditingAccount(null);
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to update account", variant: "destructive" });
    } finally { setEditSaving(false); }
  };

  const deleteAccount = async (a: Account) => {
    if (!confirm(`Delete account "${a.name}"? Only possible if it has no journal entries yet.`)) return;
    try {
      await apiSend(`/accounts/${a.id}`, "DELETE");
      toast({ title: "Account deleted" });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to delete", variant: "destructive" });
    }
  };

  const grouped = TYPE_ORDER.map(t => ({ type: t, rows: accounts.filter(a => a.accountType === t) }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            Chart of Accounts
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Every sale, purchase, girvi, repair, and karigar transaction posts against these accounts</p>
          <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
        </div>
        <div className="flex items-center gap-2">
        <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5"><Building2 className="w-3.5 h-3.5" />Add Bank Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Bank Account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Track a specific bank account separately — pick which one a payment went into wherever you record cash/bank/UPI receipts.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Account Code</Label><Input value={bankForm.code} onChange={e => setBankForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 1003" /></div>
                <div><Label>Display Name *</Label><Input value={bankForm.name} onChange={e => setBankForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. HDFC Current A/c" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Bank Name</Label><Input value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} placeholder="e.g. HDFC Bank" /></div>
                <div><Label>Account Number</Label><Input value={bankForm.bankAccountNumber} onChange={e => setBankForm(f => ({ ...f, bankAccountNumber: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>IFSC</Label><Input value={bankForm.bankIfsc} onChange={e => setBankForm(f => ({ ...f, bankIfsc: e.target.value }))} /></div>
                <div><Label>Opening Balance</Label><Input type="number" value={bankForm.openingBalance} onChange={e => setBankForm(f => ({ ...f, openingBalance: e.target.value }))} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={bankForm.isDefaultBank} onCheckedChange={v => setBankForm(f => ({ ...f, isDefaultBank: !!v }))} />
                Use as default bank account in payment forms
              </label>
            </div>
            <DialogFooter>
              <Button onClick={createBankAccount} disabled={bankSaving || !bankForm.code.trim() || !bankForm.name.trim()}>{bankSaving ? "Adding..." : "Add Bank Account"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" />Add Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 5201" /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.accountType} onValueChange={v => setForm(f => ({ ...f, accountType: v as Account["accountType"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_ORDER.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Advertising Expense" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Opening Balance</Label><Input type="number" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} /></div>
                <div>
                  <Label className="flex items-center gap-1">
                    Balance Side
                    <InfoTooltip text="Which side of the ledger this account's opening balance sits on. Assets/Expenses normally start Debit; Liabilities/Equity/Income normally start Credit." />
                  </Label>
                  <Select value={form.openingBalanceType} onValueChange={v => setForm(f => ({ ...f, openingBalanceType: v as "debit" | "credit" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createAccount} disabled={saving || !form.code.trim() || !form.name.trim()}>{saving ? "Creating..." : "Create Account"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Dialog open={!!editingAccount} onOpenChange={v => { if (!v) setEditingAccount(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {editingAccount && (
            <div className="space-y-3">
              {editingAccount.isSystemAccount && (
                <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 flex-shrink-0" />
                  System account — code and type are fixed since other parts of the app post to it by code. Name and opening balance can still be changed.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Code</Label>
                  <Input
                    value={editForm.code}
                    onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))}
                    disabled={editingAccount.isSystemAccount}
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={editForm.accountType}
                    onValueChange={v => setEditForm(f => ({ ...f, accountType: v as Account["accountType"] }))}
                    disabled={editingAccount.isSystemAccount}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_ORDER.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Opening Balance</Label><Input type="number" value={editForm.openingBalance} onChange={e => setEditForm(f => ({ ...f, openingBalance: e.target.value }))} /></div>
                <div>
                  <Label className="flex items-center gap-1">
                    Balance Side
                    <InfoTooltip text="Which side of the ledger this account's opening balance sits on. Assets/Expenses normally start Debit; Liabilities/Equity/Income normally start Credit." />
                  </Label>
                  <Select value={editForm.openingBalanceType} onValueChange={v => setEditForm(f => ({ ...f, openingBalanceType: v as "debit" | "credit" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editingAccount.accountSubType === "bank" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Bank Name</Label><Input value={editForm.bankName} onChange={e => setEditForm(f => ({ ...f, bankName: e.target.value }))} /></div>
                    <div><Label>Account Number</Label><Input value={editForm.bankAccountNumber} onChange={e => setEditForm(f => ({ ...f, bankAccountNumber: e.target.value }))} /></div>
                  </div>
                  <div><Label>IFSC</Label><Input value={editForm.bankIfsc} onChange={e => setEditForm(f => ({ ...f, bankIfsc: e.target.value }))} /></div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={editForm.isDefaultBank} onCheckedChange={v => setEditForm(f => ({ ...f, isDefaultBank: !!v }))} />
                    Use as default bank account in payment forms
                  </label>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccount(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving || !editForm.name.trim()}>{editSaving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading accounts...</div>
      ) : (
        grouped.map(g => g.rows.length > 0 && (
          <Card key={g.type} className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">{TYPE_LABELS[g.type]}</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {g.rows.map(a => (
                <div key={a.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm ${!a.isActive ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{a.code}</span>
                    <span className="font-medium">{a.name}</span>
                    {a.isSystemAccount && <Badge variant="outline" className="text-[10px] gap-1"><Lock className="w-2.5 h-2.5" />System</Badge>}
                    {a.accountSubType === "bank" && a.isDefaultBank && <Badge variant="outline" className="text-[10px]">Default bank</Badge>}
                    {a.accountSubType === "bank" && (a.bankName || a.bankAccountNumber) && (
                      <span className="text-[11px] text-muted-foreground">{a.bankName}{a.bankAccountNumber ? ` •${a.bankAccountNumber.slice(-4)}` : ""}</span>
                    )}
                    {!a.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    {a.openingBalance > 0 && (
                      <span className="text-xs text-muted-foreground">Opening: {formatCurrency(a.openingBalance)} {a.openingBalanceType === "debit" ? "Dr" : "Cr"}</span>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => openEdit(a)}>
                      <Pencil className="w-3 h-3" />Edit
                    </Button>
                    {!a.isSystemAccount && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => toggleActive(a)}>
                          {a.isActive ? <><Ban className="w-3 h-3" />Deactivate</> : <><RotateCcw className="w-3 h-3" />Reactivate</>}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-red-600" onClick={() => deleteAccount(a)}>
                          <Trash2 className="w-3 h-3" />Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Chart of Accounts"
        description="The full list of accounts your books are built from — grouped into Assets, Liabilities, Equity, Income, and Expenses. Every transaction in the app posts against one or more of these automatically."
        sections={[
          {
            heading: "What you can do here",
            items: [
              "Add Account — create your own account (e.g. a specific expense category) alongside the built-in system accounts",
              "Edit — rename any account or adjust its opening balance; code and type can also be changed for accounts you created (not for built-in system accounts)",
              "Deactivate/Reactivate — hide an account you no longer use without deleting its history",
              "Delete — only possible for accounts with no journal entries posted against them yet",
            ],
          },
          {
            heading: "Terms you'll see",
            items: [
              "System account — a built-in account (like Cash or Sales Revenue) that the app itself posts to; can't be deleted",
              "Opening Balance / Balance Side — the starting balance for this account and which side (Debit or Credit) it sits on",
            ],
          },
        ]}
      />
    </div>
  );
}
