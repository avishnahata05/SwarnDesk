import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceiptText, Plus, Zap, Trash2, Undo2 } from "lucide-react";
import { apiGet, apiSend } from "./api";
import type { Account, Voucher } from "./types";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";
import { InfoTooltip } from "@/components/InfoTooltip";

const QUICK_EXPENSE_CODES = ["5101", "5102", "5103", "5199"];

export default function VouchersTab() {
  const { toast } = useToast();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [jvOpen, setJvOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState([
    { accountId: "", side: "debit" as "debit" | "credit", amount: "" },
    { accountId: "", side: "credit" as "debit" | "credit", amount: "" },
  ]);

  const [quickAccountId, setQuickAccountId] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickMode, setQuickMode] = useState<"CASH" | "BANK">("CASH");
  const [quickNarration, setQuickNarration] = useState("");
  const [pageHelpOpen, setPageHelpOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, a] = await Promise.all([apiGet<Voucher[]>("/vouchers"), apiGet<Account[]>("/accounts")]);
      setVouchers(v); setAccounts(a);
    } catch {
      toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const quickAccounts = accounts.filter(a => QUICK_EXPENSE_CODES.includes(a.code));
  const cashAccount = accounts.find(a => a.code === "1001");
  const bankAccount = accounts.find(a => a.code === "1002");

  const totalDebit = lines.reduce((s, l) => s + (l.side === "debit" ? parseFloat(l.amount) || 0 : 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.side === "credit" ? parseFloat(l.amount) || 0 : 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const addLine = () => setLines(ls => [...ls, { accountId: "", side: "debit", amount: "" }]);
  const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<{ accountId: string; side: "debit" | "credit"; amount: string }>) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const createVoucher = async () => {
    if (!balanced) return;
    setSaving(true);
    try {
      await apiSend("/vouchers", "POST", {
        voucherType: "journal",
        narration: narration || null,
        lines: lines.filter(l => l.accountId && parseFloat(l.amount) > 0).map(l => ({
          accountId: parseInt(l.accountId),
          debit: l.side === "debit" ? parseFloat(l.amount) : 0,
          credit: l.side === "credit" ? parseFloat(l.amount) : 0,
        })),
      });
      toast({ title: "Journal voucher posted" });
      setJvOpen(false);
      setNarration("");
      setLines([{ accountId: "", side: "debit", amount: "" }, { accountId: "", side: "credit", amount: "" }]);
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to post voucher", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const createQuickExpense = async () => {
    const amt = parseFloat(quickAmount);
    const cashOrBank = quickMode === "CASH" ? cashAccount : bankAccount;
    if (!quickAccountId || !amt || amt <= 0 || !cashOrBank) return;
    setSaving(true);
    try {
      await apiSend("/vouchers", "POST", {
        voucherType: "payment",
        narration: quickNarration || null,
        lines: [
          { accountId: parseInt(quickAccountId), debit: amt, credit: 0 },
          { accountId: cashOrBank.id, debit: 0, credit: amt },
        ],
      });
      toast({ title: "Expense recorded" });
      setQuickOpen(false);
      setQuickAccountId(""); setQuickAmount(""); setQuickNarration("");
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to record expense", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const voidVoucher = async (v: Voucher) => {
    if (!confirm(`Void voucher ${v.voucherNumber}? This posts a reversing entry — it will not be deleted.`)) return;
    try {
      await apiSend(`/vouchers/${v.id}/void`, "POST", {});
      toast({ title: "Voucher voided" });
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to void", variant: "destructive" });
    }
  };

  const toggleExpand = async (v: Voucher) => {
    if (expanded === v.id) { setExpanded(null); return; }
    setExpanded(v.id);
    if (!v.lines) {
      try {
        const full = await apiGet<Voucher>(`/vouchers/${v.id}`);
        setVouchers(vs => vs.map(x => x.id === v.id ? full : x));
      } catch { /* leave collapsed on failure */ }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-primary" />
            Journal Vouchers
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Auto-posted from sales, purchases, girvi, repairs, custom orders, and karigar payments — plus manual entries below</p>
          <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
        </div>
        <div className="flex gap-2">
          <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5"><Zap className="w-3.5 h-3.5" />Quick Expense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Quick Expense</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Expense Account</Label>
                  <Select value={quickAccountId} onValueChange={setQuickAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {quickAccounts.length > 0
                        ? quickAccounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)
                        : accounts.filter(a => a.accountType === "expense").map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount</Label><Input type="number" value={quickAmount} onChange={e => setQuickAmount(e.target.value)} /></div>
                  <div>
                    <Label>Paid Via</Label>
                    <Select value={quickMode} onValueChange={v => setQuickMode(v as "CASH" | "BANK")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="BANK">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Narration (optional)</Label><Input value={quickNarration} onChange={e => setQuickNarration(e.target.value)} placeholder="e.g. Shop rent for July" /></div>
              </div>
              <DialogFooter>
                <Button onClick={createQuickExpense} disabled={saving || !quickAccountId || !(parseFloat(quickAmount) > 0)}>{saving ? "Recording..." : "Record Expense"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={jvOpen} onOpenChange={setJvOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" />New Journal Voucher</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Journal Voucher</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Narration</Label><Input value={narration} onChange={e => setNarration(e.target.value)} placeholder="e.g. Opening balance adjustment" /></div>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select value={l.accountId} onValueChange={v => updateLine(i, { accountId: v })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.filter(a => a.isActive).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={l.side} onValueChange={v => updateLine(i, { side: v as "debit" | "credit" })}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" className="w-28" value={l.amount} onChange={e => updateLine(i, { amount: e.target.value })} placeholder="Amount" />
                      <Button size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addLine} className="gap-1.5"><Plus className="w-3.5 h-3.5" />Add Line</Button>
                </div>
                <div className={`text-xs flex justify-between items-center px-1 ${balanced ? "text-emerald-600" : "text-red-600"}`}>
                  <span>Debit: {formatCurrency(totalDebit)}</span>
                  <span>Credit: {formatCurrency(totalCredit)}</span>
                  <span className="flex items-center gap-1">
                    {balanced ? "Balanced" : "Not balanced"}
                    <InfoTooltip text="Every voucher's debit lines must add up to exactly the same total as its credit lines — that's what keeps the books consistent. You can't post until they match." />
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createVoucher} disabled={saving || !balanced}>{saving ? "Posting..." : "Post Voucher"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2 text-sm text-muted-foreground">{vouchers.length} vouchers</CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading vouchers...</div>
          ) : vouchers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No vouchers yet — they'll appear here as you make sales, purchases, and other transactions.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {vouchers.map(v => (
                <div key={v.id}>
                  <button className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/20 text-sm" onClick={() => toggleExpand(v)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{v.voucherNumber}</span>
                      <span className="truncate">{v.narration ?? `${v.sourceModule} entry`}</span>
                      {v.reversedByVoucherId && <Badge variant="secondary" className="text-[10px] flex-shrink-0">Voided</Badge>}
                      {v.reversesVoucherId && <Badge variant="outline" className="text-[10px] flex-shrink-0">Reversal</Badge>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{new Date(v.voucherDate).toLocaleDateString("en-IN")}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{v.voucherType}</Badge>
                    </div>
                  </button>
                  {expanded === v.id && (
                    <div className="px-4 pb-3 bg-muted/10">
                      <table className="w-full text-xs">
                        <thead><tr className="text-muted-foreground">
                          <th className="text-left py-1">Account</th><th className="text-left py-1">Particulars</th><th className="text-right py-1">Debit</th><th className="text-right py-1">Credit</th>
                        </tr></thead>
                        <tbody>
                          {(v.lines ?? []).map((l, i) => (
                            <tr key={i} className="border-t border-border/30">
                              <td className="py-1">{l.accountName ?? accountById.get(l.accountId)?.name ?? l.accountId}</td>
                              <td className="py-1 text-muted-foreground">{l.particulars ?? "—"}</td>
                              <td className="py-1 text-right">{l.debit > 0 ? formatCurrency(l.debit) : ""}</td>
                              <td className="py-1 text-right">{l.credit > 0 ? formatCurrency(l.credit) : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!v.reversedByVoucherId && !v.reversesVoucherId && (
                        <div className="flex justify-end mt-2">
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-red-600" onClick={() => voidVoucher(v)}>
                            <Undo2 className="w-3 h-3" />Void
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Journal Vouchers"
        description="Every accounting entry your shop makes, in one place. Most of these post themselves automatically from sales, purchases, girvi loans, repairs, and karigar payments — you only need to add one manually for things like rent or salary."
        sections={[
          {
            heading: "What you can do here",
            items: [
              "Quick Expense — the fastest way to record a simple cash/bank expense (rent, salary, electricity, etc.)",
              "New Journal Voucher — a full manual entry with any number of debit/credit lines, for anything Quick Expense doesn't cover",
              "Click a voucher — expand it to see its individual debit/credit lines",
              "Void — reverses a voucher with a mirror-image entry; nothing is ever deleted, so the audit trail stays intact",
            ],
          },
          {
            heading: "Terms you'll see",
            items: [
              "Debit / Credit — the two sides of every entry; they must always add up to the same total",
              "Narration — a free-text note describing what the entry was for",
              "Reversal — an automatically-generated voucher that undoes an earlier one when it's voided",
            ],
          },
        ]}
      />
    </div>
  );
}
