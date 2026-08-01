import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileBarChart, Download, RefreshCw } from "lucide-react";
import { API, authHeader } from "./api";
import { exportToCsv } from "@/lib/csv";

type ReportKey = "pledge" | "maturity" | "returns" | "transfers" | "financial" | "cash";

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: "pledge", label: "Pledge Register" },
  { key: "maturity", label: "Interest Due / Maturity" },
  { key: "returns", label: "Returns Register" },
  { key: "transfers", label: "Transfers Register" },
  { key: "financial", label: "Financial Summary" },
  { key: "cash", label: "Cash Compliance" },
];

const needsDateRange: Record<ReportKey, boolean> = { pledge: false, maturity: false, returns: true, transfers: true, financial: true, cash: true };

// Each report's response has a different shape (some are arrays, some are
// objects like { overdue, dueThisWeek, upcoming }). Sharing one "data" slot
// across all six caused a crash: switching tabs updates `active` before the
// new fetch resolves, so for one render a table expecting an array could
// receive the previous report's object (or vice versa) and call `.map` on
// it. Keeping a separate cache slot per report key means a tab can only ever
// render the shape its own endpoint returns.
type ReportCache = Partial<Record<ReportKey, unknown>>;

export default function ReportsTab() {
  const { toast } = useToast();
  const [active, setActive] = useState<ReportKey>("pledge");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [cache, setCache] = useState<ReportCache>({});
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const key = active;
    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const endpoint: Record<ReportKey, string> = {
        pledge: "/reports/pledge-register",
        maturity: "/reports/maturity",
        returns: `/reports/returns?from=${from}&to=${to}`,
        transfers: `/reports/transfers?from=${from}&to=${to}`,
        financial: `/reports/financial-summary?from=${from}&to=${to}`,
        cash: `/reports/cash-compliance?from=${from}&to=${to}`,
      };
      const r = await fetch(`${API}${endpoint[key]}`, { headers: authHeader() });
      const json = r.ok ? await r.json() : null;
      if (requestIdRef.current !== myRequestId) return; // a newer request has since started — ignore this stale response
      if (r.ok) setCache(prev => ({ ...prev, [key]: json }));
      else { toast({ title: "Failed to load report", variant: "destructive" }); setCache(prev => ({ ...prev, [key]: null })); }
    } catch {
      if (requestIdRef.current === myRequestId) toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally {
      if (requestIdRef.current === myRequestId) setLoading(false);
    }
  }, [active, from, to]);

  useEffect(() => { load(); }, [load]);

  const data = cache[active];
  const arr = (v: unknown): any[] => Array.isArray(v) ? v : [];

  const doExport = () => {
    let rows: Record<string, unknown>[] = [];
    const d = data as any;
    if (active === "pledge") rows = arr(d);
    else if (active === "maturity") rows = [...arr(d?.overdue), ...arr(d?.dueThisWeek), ...arr(d?.upcoming)];
    else if (active === "returns") rows = arr(d);
    else if (active === "transfers") rows = arr(d);
    else if (active === "financial") {
      // `period` is a nested { from, to } object — CSV cells are just
      // String(value), which for an object produces the literal text
      // "[object Object]". Flatten it into its own from/to columns instead.
      if (d) {
        const { period, ...rest } = d;
        rows = [{ periodFrom: period?.from ?? "", periodTo: period?.to ?? "", ...rest }];
      }
    }
    else if (active === "cash") rows = arr(d?.flagged);
    const ok = exportToCsv(`girvi-${active}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    if (!ok) toast({ title: "No data to export", variant: "destructive" });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileBarChart className="w-6 h-6 text-primary" />
          Girvi Reports
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Statutory registers, maturity tracking, and a CA-facing financial overview</p>
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
            {needsDateRange[active] && (
              <>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-xs w-36" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs w-36" />
              </>
            )}
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
          ) : active === "pledge" ? (
            <PledgeRegisterTable rows={arr(data)} />
          ) : active === "maturity" ? (
            <MaturityView data={data as any} />
          ) : active === "returns" ? (
            <ReturnsTable rows={arr(data)} />
          ) : active === "transfers" ? (
            <TransfersTable rows={arr(data)} />
          ) : active === "financial" ? (
            <FinancialSummaryView data={data as any} />
          ) : (
            <CashComplianceView data={data as any} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-2 py-1.5 font-medium text-muted-foreground border-b border-border">{children}</th>;
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-2 py-1.5 border-b border-border/50 ${right ? "text-right" : ""}`}>{children}</td>;
}

function PledgeRegisterTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No active pledges.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr>
          <Th>Loan #</Th><Th>Branch</Th><Th>Customer</Th><Th>Items</Th><Th>Amount</Th><Th>Rate</Th><Th>Start</Th><Th>Due</Th><Th>Total Due</Th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.isOverdue ? "bg-red-50/50" : ""}>
              <Td>{r.loanNumber}</Td><Td>{r.branch}</Td><Td>{r.customerName}</Td><Td>{r.itemDescription}</Td>
              <Td right>{formatCurrency(r.loanAmount)}</Td><Td>{r.interestRate}%/{r.interestPeriod}</Td>
              <Td>{new Date(r.startDate).toLocaleDateString("en-IN")}</Td><Td>{new Date(r.dueDate).toLocaleDateString("en-IN")}</Td>
              <Td right>{formatCurrency(r.totalDue)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaturityView({ data }: { data: any }) {
  if (!data) return null;
  const section = (title: string, rows: any[], colorClass: string) => (
    <div className="mb-4">
      <div className={`text-xs font-semibold mb-1.5 ${colorClass}`}>{title} ({rows.length})</div>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : (
        <div className="rounded-lg border border-border divide-y divide-border/50">
          {rows.map((l: any) => (
            <div key={l.id} className="flex items-center justify-between px-3 py-2 text-xs">
              <span>{l.loanNumber} · {l.customerName}</span>
              <span className="font-semibold">{formatCurrency(l.totalDue)} · {l.daysRemaining < 0 ? `${Math.abs(l.daysRemaining)}d overdue` : `${l.daysRemaining}d left`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  const safeArr = (v: unknown): any[] => Array.isArray(v) ? v : [];
  return <>{section("Overdue", safeArr(data.overdue), "text-red-600")}{section("Due This Week", safeArr(data.dueThisWeek), "text-amber-600")}{section("Upcoming (8–30 days)", safeArr(data.upcoming), "text-muted-foreground")}</>;
}

const RETURN_TYPE_LABEL: Record<string, string> = { redeemed: "Redeemed", forfeited: "Forfeited", partial_release: "Partial Release" };

function ReturnsTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No returns in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr><Th>Voucher #</Th><Th>Loan #</Th><Th>Type</Th><Th>Customer / Items</Th><Th>Date</Th><Th>Amount</Th><Th>Loss</Th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.type === "partial_release" ? "bg-teal-50/40" : ""}>
              <Td>{r.voucherNumber ?? "—"}</Td><Td>{r.loanNumber}</Td>
              <Td>{RETURN_TYPE_LABEL[r.type] ?? r.type}</Td>
              <Td>{r.type === "partial_release" ? r.itemsDescription : r.customerName}</Td>
              <Td>{r.date ? new Date(r.date).toLocaleDateString("en-IN") : "—"}</Td>
              <Td right>{formatCurrency(r.amount ?? 0)}</Td>
              <Td right>{r.lossAmount ? formatCurrency(r.lossAmount) : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransfersTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No transfers in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr><Th>Transfer #</Th><Th>Loan #</Th><Th>From</Th><Th>To</Th><Th>Date</Th><Th>Status</Th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td>{r.transferNumber}</Td><Td>{r.loanNumber}</Td><Td>{r.fromBranch}</Td><Td>{r.toBranch}</Td>
              <Td>{new Date(r.transferDate).toLocaleDateString("en-IN")}</Td>
              <Td>{r.isReturned ? `Returned (${r.returnVoucherNumber})` : "Active"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinancialSummaryView({ data }: { data: any }) {
  if (!data) return null;
  const num = (v: unknown): number => typeof v === "number" && isFinite(v) ? v : 0;
  const rows: { label: string; value: number; color?: string }[] = [
    { label: "Principal Disbursed", value: num(data.principalDisbursed) },
    { label: "Principal Collected", value: num(data.principalCollected) },
    { label: "Interest Income (cash basis)", value: num(data.interestIncome), color: "text-emerald-600" },
    { label: "Interest Waived", value: num(data.interestWaived), color: "text-blue-600" },
    { label: "Processing Fee Income", value: num(data.processingFeeIncome), color: "text-emerald-600" },
    { label: "Forfeiture Loss", value: num(data.forfeitureLoss), color: "text-red-600" },
    { label: "Closing Outstanding Principal", value: num(data.closingOutstandingPrincipal) },
    { label: "Closing Outstanding Interest", value: num(data.closingOutstandingInterest) },
    { label: "Stock Value at Cost (all active pledges)", value: num(data.stockValueAtCost) },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {rows.map(r => (
        <div key={r.label} className="p-3 rounded-lg border border-border bg-muted/10">
          <div className="text-xs text-muted-foreground">{r.label}</div>
          <div className={`text-lg font-bold ${r.color ?? ""}`}>{formatCurrency(r.value)}</div>
        </div>
      ))}
      <div className="p-3 rounded-lg border border-border bg-muted/10">
        <div className="text-xs text-muted-foreground">Gold / Silver in Custody</div>
        <div className="text-sm font-semibold">{num(data.goldWeightInCustody)}g Au · {num(data.silverWeightInCustody)}g Ag</div>
      </div>
    </div>
  );
}

function CashComplianceView({ data }: { data: any }) {
  if (!data) return null;
  const flagged: any[] = Array.isArray(data.flagged) ? data.flagged : [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Flags same-day cash receipts per customer above ₹{data.limit?.toLocaleString("en-IN")} (Section 269ST awareness — not a hard block, review for compliance).</p>
      {flagged.length === 0 ? (
        <p className="text-sm text-emerald-600 py-4 text-center">No flagged cash transactions in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><Th>Customer</Th><Th>Date</Th><Th>Total Cash Received</Th></tr></thead>
            <tbody>
              {flagged.map((f: any, i: number) => (
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
