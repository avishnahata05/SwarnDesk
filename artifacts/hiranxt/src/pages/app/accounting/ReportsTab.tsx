import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Download, RefreshCw } from "lucide-react";
import { apiGet } from "./api";
import { exportToCsv } from "@/lib/csv";
import type { BalanceSheet, Outstanding, ProfitLoss, TrialBalance } from "./types";

type ReportKey = "trial-balance" | "profit-loss" | "balance-sheet" | "outstanding"
  | "gstr3b" | "hsn-summary" | "purchase-register" | "sales-register" | "cash-compliance";
const REPORTS: { key: ReportKey; label: string }[] = [
  { key: "trial-balance", label: "Trial Balance" },
  { key: "profit-loss", label: "Profit & Loss" },
  { key: "balance-sheet", label: "Balance Sheet" },
  { key: "outstanding", label: "Outstanding (Debtors/Creditors)" },
  { key: "gstr3b", label: "GSTR-3B Summary" },
  { key: "hsn-summary", label: "HSN Summary" },
  { key: "purchase-register", label: "Purchase Register" },
  { key: "sales-register", label: "Sales Register" },
  { key: "cash-compliance", label: "Cash Compliance" },
];
const needsRange: Record<ReportKey, boolean> = {
  "trial-balance": false, "profit-loss": true, "balance-sheet": false, outstanding: false,
  gstr3b: true, "hsn-summary": true, "purchase-register": true, "sales-register": true, "cash-compliance": true,
};
const needsAsOf: Record<ReportKey, boolean> = {
  "trial-balance": true, "profit-loss": false, "balance-sheet": true, outstanding: false,
  gstr3b: false, "hsn-summary": false, "purchase-register": false, "sales-register": false, "cash-compliance": false,
};
const ENDPOINT: Record<ReportKey, string> = {
  "trial-balance": "trial-balance", "profit-loss": "profit-loss", "balance-sheet": "balance-sheet", outstanding: "outstanding",
  gstr3b: "gstr3b", "hsn-summary": "hsn-summary", "purchase-register": "purchase-register", "sales-register": "sales-register", "cash-compliance": "cash-compliance",
};

export default function ReportsTab() {
  const { toast } = useToast();
  const [active, setActive] = useState<ReportKey>("trial-balance");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [cache, setCache] = useState<Partial<Record<ReportKey, unknown>>>({});
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const key = active;
    const myId = ++requestIdRef.current;
    setLoading(true);
    try {
      const path = needsAsOf[key] ? `/reports/${ENDPOINT[key]}?asOf=${asOf}`
        : needsRange[key] ? `/reports/${ENDPOINT[key]}?from=${from}&to=${to}`
        : `/reports/${ENDPOINT[key]}`;
      const data = await apiGet(path);
      if (requestIdRef.current === myId) setCache(prev => ({ ...prev, [key]: data }));
    } catch {
      if (requestIdRef.current === myId) toast({ title: "Failed to load report", variant: "destructive" });
    } finally {
      if (requestIdRef.current === myId) setLoading(false);
    }
  }, [active, from, to, asOf]);

  useEffect(() => { load(); }, [load]);

  const data = cache[active];

  const doExport = () => {
    let rows: Record<string, unknown>[] = [];
    if (active === "trial-balance") rows = (data as TrialBalance | undefined)?.rows ?? [];
    else if (active === "profit-loss") { const d = data as ProfitLoss | undefined; rows = [...(d?.income ?? []).map(r => ({ ...r, section: "Income" })), ...(d?.expense ?? []).map(r => ({ ...r, section: "Expense" }))]; }
    else if (active === "balance-sheet") { const d = data as BalanceSheet | undefined; rows = [...(d?.assets ?? []).map(r => ({ ...r, section: "Asset" })), ...(d?.liabilities ?? []).map(r => ({ ...r, section: "Liability" })), ...(d?.equity ?? []).map(r => ({ ...r, section: "Equity" }))]; }
    else if (active === "outstanding") { const d = data as Outstanding | undefined; rows = [...(d?.debtors ?? []).map(r => ({ ...r, section: "Debtor" })), ...(d?.creditors ?? []).map(r => ({ ...r, section: "Creditor" }))]; }
    else if (active === "gstr3b") rows = data ? [data as Record<string, unknown>] : [];
    else if (active === "hsn-summary") rows = (data as { rows?: Record<string, unknown>[] } | undefined)?.rows ?? [];
    else if (active === "purchase-register" || active === "sales-register") rows = (data as Record<string, unknown>[] | undefined) ?? [];
    else if (active === "cash-compliance") rows = (data as { flagged?: Record<string, unknown>[] } | undefined)?.flagged ?? [];
    const ok = exportToCsv(`${active}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    if (!ok) toast({ title: "No data to export", variant: "destructive" });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileBarChart className="w-6 h-6 text-primary" />
          Financial Reports
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Trial Balance, Profit &amp; Loss, Balance Sheet, and Outstanding — computed live from the journal</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {REPORTS.map(r => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active === r.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {needsRange[active] && (
              <>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-xs w-36" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs w-36" />
              </>
            )}
            {needsAsOf[active] && <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="h-8 text-xs w-36" />}
            <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 h-8">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={doExport} className="gap-1.5 h-8">
            <Download className="w-3.5 h-3.5" />Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading report...</div>
          ) : active === "trial-balance" ? (
            <TrialBalanceView data={data as TrialBalance | undefined} />
          ) : active === "profit-loss" ? (
            <ProfitLossView data={data as ProfitLoss | undefined} />
          ) : active === "balance-sheet" ? (
            <BalanceSheetView data={data as BalanceSheet | undefined} />
          ) : active === "outstanding" ? (
            <OutstandingView data={data as Outstanding | undefined} />
          ) : active === "gstr3b" ? (
            <Gstr3bView data={data as Record<string, number> | undefined} />
          ) : active === "hsn-summary" ? (
            <HsnSummaryView data={data as { rows: { hsnCode: string; description: string; count: number; taxableValue: number; tax: number }[] } | undefined} />
          ) : active === "purchase-register" ? (
            <PurchaseRegisterView rows={(data as any[] | undefined) ?? []} />
          ) : active === "sales-register" ? (
            <SalesRegisterView rows={(data as any[] | undefined) ?? []} />
          ) : (
            <CashComplianceView data={data as { limit: number; flagged: { customerName: string; date: string; total: number }[] } | undefined} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-2 py-1.5 font-medium text-muted-foreground border-b border-border ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-2 py-1.5 border-b border-border/50 ${right ? "text-right" : ""}`}>{children}</td>;
}

function TrialBalanceView({ data }: { data: TrialBalance | undefined }) {
  if (!data) return null;
  if (data.rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No transactions yet.</p>;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr><Th>Code</Th><Th>Account</Th><Th right>Debit</Th><Th right>Credit</Th></tr></thead>
          <tbody>
            {data.rows.map(r => (
              <tr key={r.accountId}>
                <Td>{r.code}</Td><Td>{r.name}</Td>
                <Td right>{r.debit > 0 ? formatCurrency(r.debit) : ""}</Td>
                <Td right>{r.credit > 0 ? formatCurrency(r.credit) : ""}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <Td>—</Td><Td>Total</Td><Td right>{formatCurrency(data.totalDebit)}</Td><Td right>{formatCurrency(data.totalCredit)}</Td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Badge variant={data.balanced ? "outline" : "destructive"} className="text-[10px]">{data.balanced ? "Balanced" : "Not balanced — check for a bug"}</Badge>
    </div>
  );
}

function ProfitLossView({ data }: { data: ProfitLoss | undefined }) {
  if (!data) return null;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-semibold text-emerald-600 mb-1.5">Income</div>
        <div className="rounded-lg border border-border divide-y divide-border/50">
          {data.income.length === 0 ? <p className="text-xs text-muted-foreground p-3">None.</p> : data.income.map(r => (
            <div key={r.accountId} className="flex justify-between px-3 py-1.5 text-xs"><span>{r.name}</span><span className="font-medium">{formatCurrency(r.amount)}</span></div>
          ))}
          <div className="flex justify-between px-3 py-1.5 text-xs font-semibold bg-muted/20"><span>Total Income</span><span>{formatCurrency(data.totalIncome)}</span></div>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-red-600 mb-1.5">Expense</div>
        <div className="rounded-lg border border-border divide-y divide-border/50">
          {data.expense.length === 0 ? <p className="text-xs text-muted-foreground p-3">None.</p> : data.expense.map(r => (
            <div key={r.accountId} className="flex justify-between px-3 py-1.5 text-xs"><span>{r.name}</span><span className="font-medium">{formatCurrency(r.amount)}</span></div>
          ))}
          <div className="flex justify-between px-3 py-1.5 text-xs font-semibold bg-muted/20"><span>Total Expense</span><span>{formatCurrency(data.totalExpense)}</span></div>
        </div>
      </div>
      <div className="md:col-span-2 flex justify-between px-3 py-2 rounded-lg border border-border bg-muted/10 text-sm font-bold">
        <span>Net Profit</span>
        <span className={data.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(data.netProfit)}</span>
      </div>
    </div>
  );
}

function BalanceSheetView({ data }: { data: BalanceSheet | undefined }) {
  if (!data) return null;
  const section = (title: string, rows: { accountId: number; name: string; balance: number }[], total: number) => (
    <div>
      <div className="text-xs font-semibold mb-1.5">{title}</div>
      <div className="rounded-lg border border-border divide-y divide-border/50">
        {rows.length === 0 ? <p className="text-xs text-muted-foreground p-3">None.</p> : rows.map(r => (
          <div key={r.accountId} className="flex justify-between px-3 py-1.5 text-xs"><span>{r.name}</span><span className="font-medium">{formatCurrency(r.balance)}</span></div>
        ))}
        <div className="flex justify-between px-3 py-1.5 text-xs font-semibold bg-muted/20"><span>Total</span><span>{formatCurrency(total)}</span></div>
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {section("Assets", data.assets, data.totalAssets)}
        <div className="space-y-4">
          {section("Liabilities", data.liabilities, data.totalLiabilities)}
          {section("Equity", data.equity, data.totalEquity)}
        </div>
      </div>
      <Badge variant={data.balanced ? "outline" : "destructive"} className="text-[10px]">{data.balanced ? "Balanced" : "Not balanced — check for a bug"}</Badge>
    </div>
  );
}

function OutstandingView({ data }: { data: Outstanding | undefined }) {
  if (!data) return null;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-semibold text-amber-600 mb-1.5">Debtors — owed to you ({formatCurrency(data.totalDebtors)})</div>
        {data.debtors.length === 0 ? <p className="text-xs text-muted-foreground py-4">None.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr><Th>Name</Th><Th>Reference</Th><Th right>Amount</Th></tr></thead>
              <tbody>
                {data.debtors.map((r, i) => <tr key={i}><Td>{r.name}</Td><Td>{r.reference}</Td><Td right>{formatCurrency(r.amount)}</Td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div>
        <div className="text-xs font-semibold text-red-600 mb-1.5">Creditors — you owe ({formatCurrency(data.totalCreditors)})</div>
        {data.creditors.length === 0 ? <p className="text-xs text-muted-foreground py-4">None.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr><Th>Name</Th><Th>Reference</Th><Th right>Amount</Th></tr></thead>
              <tbody>
                {data.creditors.map((r, i) => <tr key={i}><Td>{r.name}</Td><Td>{r.reference}</Td><Td right>{formatCurrency(r.amount)}</Td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Gstr3bView({ data }: { data: Record<string, number> | undefined }) {
  if (!data) return null;
  const rows: { label: string; value: number; bold?: boolean }[] = [
    { label: "Outward Taxable Value", value: data.outwardTaxableValue },
    { label: "CGST", value: data.cgst }, { label: "SGST", value: data.sgst }, { label: "IGST", value: data.igst },
    { label: "Output Tax (Total)", value: data.outputTax, bold: true },
    { label: "Input Tax Credit (ITC)", value: data.inputTaxCredit },
    { label: "Net Tax Payable", value: data.netTaxPayable, bold: true },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {rows.map(r => (
        <div key={r.label} className={`p-3 rounded-lg border border-border ${r.bold ? "bg-primary/5" : "bg-muted/10"}`}>
          <div className="text-xs text-muted-foreground">{r.label}</div>
          <div className={`text-lg font-bold ${r.bold ? "text-primary" : ""}`}>{formatCurrency(r.value)}</div>
        </div>
      ))}
    </div>
  );
}

function HsnSummaryView({ data }: { data: { rows: { hsnCode: string; description: string; count: number; taxableValue: number; tax: number }[] } | undefined }) {
  const rows = data?.rows ?? [];
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No transactions in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr><Th>HSN Code</Th><Th>Description</Th><Th right>Count</Th><Th right>Taxable Value</Th><Th right>Tax</Th></tr></thead>
        <tbody>
          {rows.map(r => <tr key={r.hsnCode}><Td>{r.hsnCode}</Td><Td>{r.description}</Td><Td right>{r.count}</Td><Td right>{formatCurrency(r.taxableValue)}</Td><Td right>{formatCurrency(r.tax)}</Td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function PurchaseRegisterView({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No purchases in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr><Th>Invoice</Th><Th>Supplier</Th><Th>HSN</Th><Th right>Taxable</Th><Th right>GST</Th><Th right>Total</Th><Th>Date</Th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={r.cancelled ? "opacity-50" : ""}>
              <Td>{r.invoiceNumber}</Td><Td>{r.supplierName}</Td><Td>{r.hsnCode}</Td>
              <Td right>{formatCurrency(r.taxableValue)}</Td><Td right>{r.gstAmount > 0 ? formatCurrency(r.gstAmount) : "—"}</Td>
              <Td right>{formatCurrency(r.totalAmount)}</Td><Td>{new Date(r.purchaseDate).toLocaleDateString("en-IN")}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalesRegisterView({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No sales in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr><Th>Invoice</Th><Th>Customer</Th><Th>B2B/B2C</Th><Th right>Taxable</Th><Th right>CGST</Th><Th right>SGST</Th><Th right>IGST</Th><Th right>Total</Th><Th>Date</Th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={r.status === "returned" ? "opacity-50" : ""}>
              <Td>{r.invoiceNumber}</Td><Td>{r.customerName}</Td><Td>{r.isB2B ? `B2B (${r.customerGstin})` : "B2C"}</Td>
              <Td right>{formatCurrency(r.taxableValue)}</Td><Td right>{r.cgst > 0 ? formatCurrency(r.cgst) : "—"}</Td>
              <Td right>{r.sgst > 0 ? formatCurrency(r.sgst) : "—"}</Td><Td right>{r.igst > 0 ? formatCurrency(r.igst) : "—"}</Td>
              <Td right>{formatCurrency(r.totalAmount)}</Td><Td>{new Date(r.saleDate).toLocaleDateString("en-IN")}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CashComplianceView({ data }: { data: { limit: number; flagged: { customerName: string; date: string; total: number }[] } | undefined }) {
  if (!data) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Flags same-day cash receipts per customer above ₹{data.limit?.toLocaleString("en-IN")} (Section 269ST / TCS awareness — not a hard block, review for compliance).</p>
      {data.flagged.length === 0 ? (
        <p className="text-sm text-emerald-600 py-4 text-center">No flagged cash transactions in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><Th>Customer</Th><Th>Date</Th><Th right>Total Cash Received</Th></tr></thead>
            <tbody>
              {data.flagged.map((f, i) => (
                <tr key={i} className="bg-amber-50/50">
                  <Td>{f.customerName}</Td><Td>{f.date}</Td><Td right>{formatCurrency(f.total)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
