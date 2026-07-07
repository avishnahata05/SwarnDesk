import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeftRight, RotateCcw, Search, Printer } from "lucide-react";
import { API, getAuthHeaders, authHeader } from "./api";
import type { Transfer, Branch, Loan, LoanItem, GirviSettings } from "./types";
import { openTransferVoucher } from "./vouchers";

export default function TransfersTab({ branches }: { branches: Branch[] }) {
  const { toast } = useToast();
  const { data: appSettings } = useGetSettings();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loans, setLoans] = useState<Record<number, Loan>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [girviSettings, setGirviSettings] = useState<GirviSettings | null>(null);

  const [returnTarget, setReturnTarget] = useState<Transfer | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const shopName = appSettings?.businessName ?? "SwarnDesk Jewellers";
  const shopAddress = appSettings?.address ?? "";
  const shopMobile = appSettings?.mobile ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, lRes, sRes] = await Promise.all([
        fetch(`${API}/transfers`, { headers: authHeader() }),
        fetch(`${API}?status=all`, { headers: authHeader() }),
        fetch(`${API}/settings`, { headers: authHeader() }),
      ]);
      if (tRes.ok) setTransfers(await tRes.json());
      if (lRes.ok) {
        const loansData: Loan[] = await lRes.json();
        setLoans(Object.fromEntries(loansData.map(l => [l.id, l])));
      }
      if (sRes.ok) setGirviSettings(await sRes.json());
    } catch {
      toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const branchName = (id: number | null) => branches.find(b => b.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    if (!search.trim()) return transfers;
    const q = search.trim().toLowerCase();
    return transfers.filter(t => {
      const loan = loans[t.loanId];
      return t.transferNumber.toLowerCase().includes(q) || (loan?.loanNumber.toLowerCase().includes(q)) || (loan?.customerName.toLowerCase().includes(q));
    });
  }, [transfers, loans, search]);

  const handleReturn = async () => {
    if (!returnTarget) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/transfers/${returnTarget.id}/return`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ notes: returnNotes.trim() || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast({ title: "Transfer marked as returned" });
      setReturnTarget(null);
      setReturnNotes("");
      load();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const printVoucher = async (t: Transfer) => {
    const loan = loans[t.loanId];
    if (!loan) { toast({ title: "Loan data not available" }); return; }
    try {
      const r = await fetch(`${API}/transfers/${t.id}/items`, { headers: authHeader() });
      const items: LoanItem[] = r.ok ? await r.json() : [];
      openTransferVoucher(t, loan, items, branches, shopName, shopAddress, shopMobile, girviSettings ?? undefined);
    } catch {
      toast({ title: "Failed to load transfer items", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-primary" />
          Branch Transfers
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Move pledged items between branches or reassign a pledge to another customer, with a full audit trail</p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by transfer #, loan #, or customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && transfers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading transfers...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search ? `No transfers found for "${search}"` : "No transfers yet. Use \"Transfer Items\" on a loan in the Loans tab to move pledged items between branches."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(t => {
                const loan = loans[t.loanId];
                return (
                  <div key={t.id} className="px-3 md:px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm font-mono">{t.transferNumber}</span>
                        {loan && <span className="text-xs text-muted-foreground">{loan.customerName} · {loan.loanNumber}</span>}
                        <Badge variant={t.isReturned ? "secondary" : "default"} className="text-xs">{t.isReturned ? "RETURNED" : "IN TRANSIT / ACTIVE"}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {branchName(t.fromBranchId)} → {t.toBranchId ? branchName(t.toBranchId) : "—"}
                        {t.toCustomerId ? " · Customer reassignment" : ""}
                        {" · "}{new Date(t.transferDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        {t.reason ? ` · ${t.reason}` : ""}
                      </div>
                      {t.isReturned && (
                        <div className="text-xs text-emerald-600 mt-0.5">
                          Returned {t.returnedAt ? new Date(t.returnedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""} · Voucher {t.returnVoucherNumber}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => printVoucher(t)}>
                        <Printer className="w-3.5 h-3.5" />Voucher
                      </Button>
                      {!t.isReturned && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setReturnTarget(t); setReturnNotes(""); }}>
                          <RotateCcw className="w-3.5 h-3.5" />Return Transfer
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!returnTarget} onOpenChange={v => { if (!v) setReturnTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-blue-500" />Return Transfer</DialogTitle></DialogHeader>
          {returnTarget && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs">
                <div className="font-mono font-semibold">{returnTarget.transferNumber}</div>
                <div className="text-muted-foreground mt-1">{branchName(returnTarget.fromBranchId)} → {returnTarget.toBranchId ? branchName(returnTarget.toBranchId) : "—"}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Notes (optional)</label>
                <Textarea value={returnNotes} onChange={e => setReturnNotes(e.target.value)} rows={2} className="text-sm resize-y" placeholder="e.g. Item physically received back at Main branch" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setReturnTarget(null)}>Cancel</Button>
                <Button size="sm" onClick={handleReturn} disabled={submitting}>{submitting ? "Processing..." : "Confirm Return"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
