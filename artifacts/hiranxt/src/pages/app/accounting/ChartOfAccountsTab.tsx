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
import { Landmark, Plus, Lock, Ban, RotateCcw, Trash2 } from "lucide-react";
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

  const toggleActive = async (a: Account) => {
    try {
      await apiSend(`/accounts/${a.id}`, "PATCH", { isActive: !a.isActive });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" });
    }
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
                    {!a.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    {a.openingBalance > 0 && (
                      <span className="text-xs text-muted-foreground">Opening: {formatCurrency(a.openingBalance)} {a.openingBalanceType === "debit" ? "Dr" : "Cr"}</span>
                    )}
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
