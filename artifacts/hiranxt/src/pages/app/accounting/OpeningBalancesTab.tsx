import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, Users, Truck, Hammer, Save, CircleDollarSign } from "lucide-react";
import { apiGet, apiSend, apiGetOther, apiSendOther } from "./api";
import type { Account } from "./types";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";
import { InfoTooltip } from "@/components/InfoTooltip";

type Party = { id: number; name: string; mobile?: string; openingBalance: number; openingBalanceType: "debit" | "credit" };

// Rows edit locally until "Save" is clicked for that row — avoids a PATCH firing on
// every keystroke, and makes it obvious which rows still have unsaved changes.
function useDraft<T extends { id: number }>(rows: T[] | null, keyOf: (r: T) => { amount: number; type: "debit" | "credit" }) {
  const [drafts, setDrafts] = useState<Record<number, { amount: string; type: "debit" | "credit" }>>({});
  useEffect(() => {
    if (!rows) return;
    setDrafts(prev => {
      const next = { ...prev };
      for (const r of rows) {
        if (next[r.id] === undefined) {
          const k = keyOf(r);
          next[r.id] = { amount: String(k.amount), type: k.type };
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  return [drafts, setDrafts] as const;
}

export default function OpeningBalancesTab() {
  const { toast } = useToast();
  const [pageHelpOpen, setPageHelpOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [customers, setCustomers] = useState<(Party & { mobile: string })[] | null>(null);
  const [suppliers, setSuppliers] = useState<(Party & { mobile: string })[] | null>(null);
  const [karigars, setKarigars] = useState<(Party & { mobile: string })[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [accts, custs, supps, karigs] = await Promise.all([
        apiGet<Account[]>("/accounts"),
        apiGetOther<any[]>("/customers?limit=1000"),
        apiGetOther<any[]>("/suppliers"),
        apiGetOther<any[]>("/karigars"),
      ]);
      setAccounts(accts);
      setCustomers(custs.map(c => ({ id: c.id, name: c.name, mobile: c.mobile, openingBalance: Math.abs(c.balance), openingBalanceType: c.balance < 0 ? "debit" : "credit" })));
      setSuppliers(supps.map(s => ({ id: s.id, name: s.name, mobile: s.mobile, openingBalance: s.openingBalance, openingBalanceType: s.openingBalanceType })));
      setKarigars(karigs.map(k => ({ id: k.id, name: k.name, mobile: k.mobile, openingBalance: k.openingBalance, openingBalanceType: k.openingBalanceType })));
    } catch {
      toast({ title: "Failed to load opening balances", variant: "destructive" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cashBankAccounts = (accounts ?? []).filter(a => a.accountSubType === "cash" || a.accountSubType === "bank");
  const capitalAccount = (accounts ?? []).find(a => a.accountSubType === "capital");

  const [custDrafts, setCustDrafts] = useDraft(customers, c => ({ amount: c.openingBalance, type: c.openingBalanceType }));
  const [suppDrafts, setSuppDrafts] = useDraft(suppliers, s => ({ amount: s.openingBalance, type: s.openingBalanceType }));
  const [karDrafts, setKarDrafts] = useDraft(karigars, k => ({ amount: k.openingBalance, type: k.openingBalanceType }));
  const [acctDrafts, setAcctDrafts] = useDraft(accounts, a => ({ amount: a.openingBalance, type: a.openingBalanceType }));

  const saveAccount = async (a: Account) => {
    const d = acctDrafts[a.id];
    if (!d) return;
    setSavingId(`acct-${a.id}`);
    try {
      await apiSend(`/accounts/${a.id}`, "PATCH", { openingBalance: parseFloat(d.amount) || 0, openingBalanceType: d.type });
      toast({ title: `${a.name} opening balance saved` });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save", variant: "destructive" });
    } finally { setSavingId(null); }
  };

  const saveCustomer = async (c: Party) => {
    const d = custDrafts[c.id];
    if (!d) return;
    setSavingId(`cust-${c.id}`);
    try {
      const mag = parseFloat(d.amount) || 0;
      await apiSendOther(`/customers/${c.id}`, "PATCH", { balance: d.type === "credit" ? mag : -mag });
      toast({ title: `${c.name} opening balance saved` });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save", variant: "destructive" });
    } finally { setSavingId(null); }
  };

  const saveSupplier = async (s: Party) => {
    const d = suppDrafts[s.id];
    if (!d) return;
    setSavingId(`supp-${s.id}`);
    try {
      await apiSendOther(`/suppliers/${s.id}`, "PATCH", { openingBalance: parseFloat(d.amount) || 0, openingBalanceType: d.type });
      toast({ title: `${s.name} opening balance saved` });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save", variant: "destructive" });
    } finally { setSavingId(null); }
  };

  const saveKarigar = async (k: Party) => {
    const d = karDrafts[k.id];
    if (!d) return;
    setSavingId(`kar-${k.id}`);
    try {
      await apiSendOther(`/karigars/${k.id}`, "PATCH", { openingBalance: parseFloat(d.amount) || 0, openingBalanceType: d.type });
      toast({ title: `${k.name} opening balance saved` });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save", variant: "destructive" });
    } finally { setSavingId(null); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CircleDollarSign className="w-6 h-6 text-primary" />
          Opening Balances
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Everything you already had before switching to SwarnDesk — cash in the drawer, bank balances, and what customers/suppliers/karigars already owed. Set these once so your reports are accurate from day one.
        </p>
        <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
      </div>

      {/* Cash & Bank */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Landmark className="w-4 h-4" />Cash & Bank Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cashBankAccounts.length === 0 && <p className="text-sm text-muted-foreground">Loading...</p>}
          {cashBankAccounts.map(a => {
            const d = acctDrafts[a.id] ?? { amount: "0", type: "debit" as const };
            const dirty = d.amount !== String(a.openingBalance) || d.type !== a.openingBalanceType;
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm">
                <div className="flex-1 min-w-[140px]">
                  <div className="font-medium">{a.name}</div>
                  {a.bankName && <div className="text-[11px] text-muted-foreground">{a.bankName}{a.bankAccountNumber ? ` •${a.bankAccountNumber.slice(-4)}` : ""}</div>}
                </div>
                <Input type="number" className="h-8 w-28 text-sm" value={d.amount} onChange={e => setAcctDrafts(p => ({ ...p, [a.id]: { ...d, amount: e.target.value } }))} />
                <Select value={d.type} onValueChange={v => setAcctDrafts(p => ({ ...p, [a.id]: { ...d, type: v as "debit" | "credit" } }))}>
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="debit">Debit</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent>
                </Select>
                <Button size="sm" variant={dirty ? "default" : "outline"} className="h-8 gap-1 text-xs" disabled={!dirty || savingId === `acct-${a.id}`} onClick={() => saveAccount(a)}>
                  <Save className="w-3 h-3" />{savingId === `acct-${a.id}` ? "Saving..." : "Save"}
                </Button>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground pt-1">Need to track a second bank account? Add one from Chart of Accounts → "Add Bank Account".</p>
        </CardContent>
      </Card>

      {/* Capital */}
      {capitalAccount && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Capital Account
              <InfoTooltip text="The owner's own investment into the shop — money or assets put in that aren't a loan. If you're not sure, leave this at 0 and ask your accountant." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const a = capitalAccount;
              const d = acctDrafts[a.id] ?? { amount: "0", type: "credit" as const };
              const dirty = d.amount !== String(a.openingBalance) || d.type !== a.openingBalanceType;
              return (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm">
                  <div className="flex-1 min-w-[140px] font-medium">{a.name}</div>
                  <Input type="number" className="h-8 w-28 text-sm" value={d.amount} onChange={e => setAcctDrafts(p => ({ ...p, [a.id]: { ...d, amount: e.target.value } }))} />
                  <Select value={d.type} onValueChange={v => setAcctDrafts(p => ({ ...p, [a.id]: { ...d, type: v as "debit" | "credit" } }))}>
                    <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="debit">Debit</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent>
                  </Select>
                  <Button size="sm" variant={dirty ? "default" : "outline"} className="h-8 gap-1 text-xs" disabled={!dirty || savingId === `acct-${a.id}`} onClick={() => saveAccount(a)}>
                    <Save className="w-3 h-3" />{savingId === `acct-${a.id}` ? "Saving..." : "Save"}
                  </Button>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Customers */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" />Customers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground -mt-1">Due = they already owed you money. Advance = they'd already paid you ahead of an order.</p>
          {customers === null && <p className="text-sm text-muted-foreground">Loading...</p>}
          {customers !== null && customers.length === 0 && <p className="text-sm text-muted-foreground">No customers yet.</p>}
          {(customers ?? []).map(c => {
            const d = custDrafts[c.id] ?? { amount: "0", type: "debit" as const };
            const dirty = d.amount !== String(c.openingBalance) || d.type !== c.openingBalanceType;
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm">
                <div className="flex-1 min-w-[140px]">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">{c.mobile}</div>
                </div>
                <Input type="number" className="h-8 w-28 text-sm" value={d.amount} onChange={e => setCustDrafts(p => ({ ...p, [c.id]: { ...d, amount: e.target.value } }))} />
                <Select value={d.type} onValueChange={v => setCustDrafts(p => ({ ...p, [c.id]: { ...d, type: v as "debit" | "credit" } }))}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="debit">Due (owes you)</SelectItem><SelectItem value="credit">Advance</SelectItem></SelectContent>
                </Select>
                <Button size="sm" variant={dirty ? "default" : "outline"} className="h-8 gap-1 text-xs" disabled={!dirty || savingId === `cust-${c.id}`} onClick={() => saveCustomer(c)}>
                  <Save className="w-3 h-3" />{savingId === `cust-${c.id}` ? "Saving..." : "Save"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Suppliers */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Truck className="w-4 h-4" />Suppliers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {suppliers === null && <p className="text-sm text-muted-foreground">Loading...</p>}
          {suppliers !== null && suppliers.length === 0 && <p className="text-sm text-muted-foreground">No suppliers yet.</p>}
          {(suppliers ?? []).map(s => {
            const d = suppDrafts[s.id] ?? { amount: "0", type: "credit" as const };
            const dirty = d.amount !== String(s.openingBalance) || d.type !== s.openingBalanceType;
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm">
                <div className="flex-1 min-w-[140px]">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">{s.mobile}</div>
                </div>
                <Input type="number" className="h-8 w-28 text-sm" value={d.amount} onChange={e => setSuppDrafts(p => ({ ...p, [s.id]: { ...d, amount: e.target.value } }))} />
                <Select value={d.type} onValueChange={v => setSuppDrafts(p => ({ ...p, [s.id]: { ...d, type: v as "debit" | "credit" } }))}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="credit">You owe them</SelectItem><SelectItem value="debit">You paid ahead</SelectItem></SelectContent>
                </Select>
                <Button size="sm" variant={dirty ? "default" : "outline"} className="h-8 gap-1 text-xs" disabled={!dirty || savingId === `supp-${s.id}`} onClick={() => saveSupplier(s)}>
                  <Save className="w-3 h-3" />{savingId === `supp-${s.id}` ? "Saving..." : "Save"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Karigars */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Hammer className="w-4 h-4" />Karigars</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground -mt-1">This is a cash-wages balance — pending gold/silver issued to a karigar is tracked separately on the Karigars page.</p>
          {karigars === null && <p className="text-sm text-muted-foreground">Loading...</p>}
          {karigars !== null && karigars.length === 0 && <p className="text-sm text-muted-foreground">No karigars yet.</p>}
          {(karigars ?? []).map(k => {
            const d = karDrafts[k.id] ?? { amount: "0", type: "credit" as const };
            const dirty = d.amount !== String(k.openingBalance) || d.type !== k.openingBalanceType;
            return (
              <div key={k.id} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm">
                <div className="flex-1 min-w-[140px]">
                  <div className="font-medium">{k.name}</div>
                  <div className="text-[11px] text-muted-foreground">{k.mobile}</div>
                </div>
                <Input type="number" className="h-8 w-28 text-sm" value={d.amount} onChange={e => setKarDrafts(p => ({ ...p, [k.id]: { ...d, amount: e.target.value } }))} />
                <Select value={d.type} onValueChange={v => setKarDrafts(p => ({ ...p, [k.id]: { ...d, type: v as "debit" | "credit" } }))}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="credit">Wages due</SelectItem><SelectItem value="debit">Advance to them</SelectItem></SelectContent>
                </Select>
                <Button size="sm" variant={dirty ? "default" : "outline"} className="h-8 gap-1 text-xs" disabled={!dirty || savingId === `kar-${k.id}`} onClick={() => saveKarigar(k)}>
                  <Save className="w-3 h-3" />{savingId === `kar-${k.id}` ? "Saving..." : "Save"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Opening Balances"
        description="The one place to enter everything you already had before switching to SwarnDesk, so your books start accurate instead of at zero."
        sections={[
          {
            heading: "Why this matters",
            items: [
              "Without opening balances, your Cash Book, Bank Book, and reports will show ₹0 to start — even if you actually had money in the drawer or the bank",
              "A customer who already owed you money, or a supplier you already owed, won't show up in Outstanding/Party Ledger unless you set it here",
              "These are one-time entries — they're never touched by future sales, purchases, or payments recorded in the app",
            ],
          },
          {
            heading: "Where it shows up",
            items: [
              "Cash & Bank opening balances appear in Ledgers & Books (Cash Book, Bank Book, Account Ledger) and in Trial Balance / Balance Sheet",
              "Customer/Supplier/Karigar opening balances appear in Party Ledger and the Outstanding (debtors/creditors) report",
            ],
          },
        ]}
      />
    </div>
  );
}
