import { useState, useEffect, useCallback } from "react";
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

export default function ReportsTab() {
  const { toast } = useToast();
  const [active, setActive] = useState<ReportKey>("pledge");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
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
      const r = await fetch(`${API}${endpoint[active]}`, { headers: authHeader() });
      if (r.ok) setData(await r.json());
      else { toast({ title: "Failed to load report", variant: "destructive" }); setData(null); }
    } catch {
      toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally { setLoading(false); }
  }, [active, from, to]);

  useEffect(() => { load(); }, [load]);

  const doExport = () => {
    let rows: Record<string, unknown>[] = [];
    if (active === "pledge") rows = data ?? [];
    else if (active === "maturity") rows = [...(data?.overdue ?? []), ...(data?.dueThisWeek ?? []), ...(data?.upcoming ?? [])];
    else if (active === "returns") rows = data ?? [];
    else if (active === "transfers") rows = data ?? [];
    else if (active === "financial") rows = data ? [data] : [];
    else if (active === "cash") rows = data?.flagged ?? [];
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
            <PledgeRegisterTable rows={data ?? []} />
          ) : active === "maturity" ? (
            <MaturityView data={data} />
          ) : active === "returns" ? (
            <ReturnsTable rows={data ?? []} />
          ) : active === "transfers" ? (
            <TransfersTable rows={data ?? []} />
          ) : active === "financial" ? (
            <FinancialSummaryView data={data} />
          ) : (
            <CashComplianceView data={data} />
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
  return <>{section("Overdue", data.overdue ?? [], "text-red-600")}{section("Due This Week", data.dueThisWeek ?? [], "text-amber-600")}{section("Upcoming (8–30 days)", data.upcoming ?? [], "text-muted-foreground")}</>;
}

function ReturnsTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No returns in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr><Th>Return Voucher #</Th><Th>Loan #</Th><Th>Customer</Th><Th>Status</Th><Th>Date</Th><Th>Amount</Th><Th>Loss</Th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td>{r.returnVoucherNumber}</Td><Td>{r.loanNumber}</Td><Td>{r.customerName}</Td><Td>{r.status}</Td>
              <Td>{r.redeemedDate ? new Date(r.redeemedDate).toLocaleDateString("en-IN") : "—"}</Td>
              <Td right>{formatCurrency(r.redeemedAmount ?? 0)}</Td>
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
  const rows: { label: string; value: number; color?: string }[] = [
    { label: "Principal Disbursed", value: data.principalDisbursed },
    { label: "Principal Collected", value: data.principalCollected },
    { label: "Interest Income (cash basis)", value: data.interestIncome, color: "text-emerald-600" },
    { label: "Processing Fee Income", value: data.processingFeeIncome, color: "text-emerald-600" },
    { label: "Forfeiture Loss", value: data.forfeitureLoss, color: "text-red-600" },
    { label: "Closing Outstanding Principal", value: data.closingOutstandingPrincipal },
    { label: "Closing Outstanding Interest", value: data.closingOutstandingInterest },
    { label: "Stock Value at Cost (all active pledges)", value: data.stockValueAtCost },
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
        <div className="text-sm font-semibold">{data.goldWeightInCustody}g Au · {data.silverWeightInCustody}g Ag</div>
      </div>
    </div>
  );
}

function CashComplianceView({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Flags same-day cash receipts per customer above ₹{data.limit?.toLocaleString("en-IN")} (Section 269ST awareness — not a hard block, review for compliance).</p>
      {(!data.flagged || data.flagged.length === 0) ? (
        <p className="text-sm text-emerald-600 py-4 text-center">No flagged cash transactions in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><Th>Customer</Th><Th>Date</Th><Th>Total Cash Received</Th></tr></thead>
            <tbody>
              {data.flagged.map((f: any, i: number) => (
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
