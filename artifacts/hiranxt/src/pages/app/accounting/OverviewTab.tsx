import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Landmark, ArrowDownCircle, ArrowUpCircle, TrendingUp, BookOpen } from "lucide-react";
import { apiGet } from "./api";
import type { Ledger, Outstanding, ProfitLoss } from "./types";

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const to = now.toISOString().split("T")[0];
  return { from, to };
}

export default function OverviewTab() {
  const [cash, setCash] = useState<Ledger | null>(null);
  const [bank, setBank] = useState<Ledger | null>(null);
  const [outstanding, setOutstanding] = useState<Outstanding | null>(null);
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = monthRange();
    try {
      const [c, b, o, p] = await Promise.all([
        apiGet<Ledger>("/reports/cash-book"),
        apiGet<Ledger>("/reports/bank-book"),
        apiGet<Outstanding>("/reports/outstanding"),
        apiGet<ProfitLoss>(`/reports/profit-loss?from=${from}&to=${to}`),
      ]);
      setCash(c); setBank(b); setOutstanding(o); setPl(p);
    } catch {
      // KPI cards degrade to "—" below on failure — non-fatal for the page
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: "Cash in Hand", value: cash?.closingBalance, icon: Wallet, color: "text-emerald-600" },
    { label: "Bank Balance", value: bank?.closingBalance, icon: Landmark, color: "text-blue-600" },
    { label: "Total Debtors (owed to you)", value: outstanding?.totalDebtors, icon: ArrowDownCircle, color: "text-amber-600" },
    { label: "Total Creditors (you owe)", value: outstanding?.totalCreditors, icon: ArrowUpCircle, color: "text-red-600" },
    { label: "Net Profit (this month)", value: pl?.netProfit, icon: TrendingUp, color: (pl?.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-red-600" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Accounting Overview
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Full double-entry books — every sale, purchase, girvi transaction, repair, custom order, and karigar payment posts here automatically.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <c.icon className="w-3.5 h-3.5" />
                {c.label}
              </div>
              <div className={`text-lg font-bold ${c.color}`}>
                {loading ? "…" : c.value !== undefined ? formatCurrency(c.value ?? 0) : "—"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How this works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1.5">
          <p>Every sale, payment collection, purchase, girvi loan disbursal/collection/redemption/forfeiture, repair payment, custom order payment, and karigar wage payment automatically posts a balanced journal entry — no manual bookkeeping needed for day-to-day operations.</p>
          <p>Use <strong>Journal Vouchers</strong> for one-off entries (rent, salary, misc expenses) or corrections. Use <strong>Ledgers &amp; Books</strong> to see any account or party's running balance, the Day Book, Cash Book, or Bank Book. Use <strong>Reports</strong> for the Trial Balance, Profit &amp; Loss, Balance Sheet, and Outstanding (Debtors/Creditors).</p>
        </CardContent>
      </Card>
    </div>
  );
}
