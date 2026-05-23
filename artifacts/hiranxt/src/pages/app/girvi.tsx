import { useState, useEffect, useMemo } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Banknote, AlertTriangle, CheckCircle2, TrendingDown,
  Plus, RefreshCw, XCircle, ChevronDown, ChevronUp, Calendar,
  MessageCircle, Search, PrinterIcon, Edit2, Clock,
} from "lucide-react";

const API = "/api/girvi";

function toVikramSamvat(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const vsYear = year + (month >= 3 ? 57 : 56);
  const hindiMonths = ["चैत्र","वैशाख","ज्येष्ठ","आषाढ़","श्रावण","भाद्रपद","आश्विन","कार्तिक","मार्गशीर्ष","पौष","माघ","फाल्गुन"];
  const vsMonth = hindiMonths[(month + 9) % 12];
  return `${day} ${vsMonth}, वि.सं. ${vsYear}`;
}

function calcDaysElapsed(startDate: string) {
  return Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000);
}

function openGirviVoucher(loan: Loan, shopName: string, shopAddress: string, shopMobile: string) {
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const periodDays = loan.interestPeriod === "weekly" ? 7 : loan.interestPeriod === "yearly" ? 365 : 30;
  const interest3m = Math.round(loan.loanAmount * (loan.interestRate / 100) * (90 / periodDays));
  const interest6m = Math.round(loan.loanAmount * (loan.interestRate / 100) * (180 / periodDays));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Girvi Voucher — ${loan.loanNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; font-size: 12px; background: #fff; }
  .page { max-width: 720px; margin: 0 auto; padding: 24px 20px; }

  /* Header */
  .shop-header { text-align: center; border-bottom: 3px double #1a3e6e; padding-bottom: 12px; margin-bottom: 14px; }
  .shop-name { font-size: 20px; font-weight: 800; color: #1a3e6e; }
  .shop-sub { font-size: 11px; color: #555; margin-top: 3px; }
  .doc-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #c0392b;
    text-align: center; margin: 12px 0 8px; border: 1px solid #c0392b; padding: 6px; border-radius: 4px; }

  /* Loan meta */
  .meta-row { display: flex; justify-content: space-between; background: #f8f9fa; border: 1px solid #dee2e6;
    border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; font-size: 12px; }
  .meta-item { text-align: center; }
  .meta-label { color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-value { font-weight: 700; color: #1a3e6e; font-size: 13px; margin-top: 2px; }

  /* Sections */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .section { border: 1px solid #dee2e6; border-radius: 6px; padding: 10px 12px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
    color: #666; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e9ecef; }
  .field { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .field-label { color: #777; }
  .field-value { font-weight: 600; text-align: right; max-width: 55%; }

  /* Interest preview */
  .interest-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
  .interest-table th { background: #1a3e6e; color: white; padding: 6px 10px; text-align: left; }
  .interest-table td { padding: 5px 10px; border-bottom: 1px solid #e9ecef; }
  .interest-table tr:last-child td { font-weight: 700; background: #fff3cd; }

  /* Terms */
  .terms { border: 1px solid #dee2e6; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
  .terms ol { padding-left: 16px; }
  .terms li { margin-bottom: 3px; color: #444; font-size: 11px; }

  /* Signatures */
  .sig-row { display: flex; justify-content: space-between; margin-top: 20px; }
  .sig-box { text-align: center; width: 45%; }
  .sig-line { border-top: 1px solid #333; margin-bottom: 4px; }
  .sig-label { font-size: 10px; color: #666; }

  /* LTV badge */
  .ltv-badge { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 700; }
  .ltv-ok { background: #d4edda; color: #155724; }
  .ltv-warn { background: #fff3cd; color: #856404; }
  .ltv-high { background: #f8d7da; color: #721c24; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="no-print" style="text-align:right;margin-bottom:16px;">
    <button onclick="window.print()" style="background:#1a3e6e;color:white;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">
      🖨️ Print Voucher
    </button>
  </div>

  <div class="shop-header">
    <div class="shop-name">${shopName}</div>
    <div class="shop-sub">${shopAddress}${shopMobile ? ` · ${shopMobile}` : ""}</div>
  </div>

  <div class="doc-title">Girvi Voucher (Pawn Receipt)</div>

  <div class="meta-row">
    <div class="meta-item">
      <div class="meta-label">Loan Number</div>
      <div class="meta-value">${loan.loanNumber}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Start Date</div>
      <div class="meta-value">${fmtDate(loan.startDate)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Due Date</div>
      <div class="meta-value">${fmtDate(loan.dueDate)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Status</div>
      <div class="meta-value">${loan.status.toUpperCase()}</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="section">
      <div class="section-title">Customer Details</div>
      <div class="field"><span class="field-label">Name</span><span class="field-value">${loan.customerName}</span></div>
      <div class="field"><span class="field-label">Mobile</span><span class="field-value">${loan.customerMobile}</span></div>
      ${loan.kycDocType ? `<div class="field"><span class="field-label">${loan.kycDocType.replace(/_/g," ").toUpperCase()}</span><span class="field-value">${loan.kycDocNumber ?? "—"}</span></div>` : ""}
    </div>
    <div class="section">
      <div class="section-title">Collateral Details</div>
      <div class="field"><span class="field-label">Metal</span><span class="field-value">${loan.metalType.toUpperCase()} ${loan.purity}</span></div>
      <div class="field"><span class="field-label">Gross Weight</span><span class="field-value">${loan.grossWeight.toFixed(3)} g</span></div>
      <div class="field"><span class="field-label">Net Weight</span><span class="field-value">${loan.netWeight.toFixed(3)} g</span></div>
      <div class="field"><span class="field-label">Est. Market Value</span><span class="field-value">${fmt(loan.estimatedValue)}</span></div>
      <div class="field"><span class="field-label">LTV Ratio</span><span class="field-value">${loan.estimatedValue > 0 ? `${((loan.loanAmount / loan.estimatedValue) * 100).toFixed(0)}%` : "—"}</span></div>
    </div>
  </div>

  <div class="section" style="margin-bottom:12px;">
    <div class="section-title">Loan Terms</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
      <div class="field" style="flex-direction:column;gap:2px;">
        <span class="field-label">Principal Amount</span>
        <span style="font-size:16px;font-weight:800;color:#1a3e6e;">${fmt(loan.loanAmount)}</span>
      </div>
      <div class="field" style="flex-direction:column;gap:2px;">
        <span class="field-label">Interest Rate</span>
        <span style="font-weight:700;">${loan.interestRate}% per ${loan.interestPeriod}</span>
      </div>
      <div class="field" style="flex-direction:column;gap:2px;">
        <span class="field-label">Duration</span>
        <span style="font-weight:700;">${Math.ceil((new Date(loan.dueDate).getTime() - new Date(loan.startDate).getTime()) / 86400000)} days</span>
      </div>
    </div>
  </div>

  <table class="interest-table">
    <thead>
      <tr><th>Period</th><th>Interest Accrued</th><th>Total Due</th></tr>
    </thead>
    <tbody>
      <tr><td>1 Month</td><td>${fmt(Math.round(loan.loanAmount * (loan.interestRate / 100) * (30 / periodDays)))}</td><td>${fmt(loan.loanAmount + Math.round(loan.loanAmount * (loan.interestRate / 100) * (30 / periodDays)))}</td></tr>
      <tr><td>3 Months</td><td>${fmt(interest3m)}</td><td>${fmt(loan.loanAmount + interest3m)}</td></tr>
      <tr><td>6 Months (Due Date)</td><td>${fmt(interest6m)}</td><td>${fmt(loan.loanAmount + interest6m)}</td></tr>
    </tbody>
  </table>

  <div class="terms">
    <div class="section-title">Terms &amp; Conditions</div>
    <ol>
      <li>The pledged ${loan.metalType} ornament(s) will be safely kept by the shop until redemption.</li>
      <li>The customer must present this original voucher at the time of redemption.</li>
      <li>Original KYC document (${loan.kycDocType ? loan.kycDocType.replace(/_/g," ") : "ID proof"}) must be brought for redemption.</li>
      <li>Interest will be charged from the start date until the date of redemption.</li>
      <li>If not redeemed by the due date (${fmtDate(loan.dueDate)}), the shop reserves the right to sell the pledged item.</li>
      <li>Loan extension is available on request, subject to interest payment.</li>
      <li>The shop is not responsible for any damage due to fire, theft, or natural calamities.</li>
    </ol>
  </div>

  ${loan.notes ? `<div style="font-size:11px;color:#666;margin-bottom:12px;padding:8px;background:#f8f9fa;border-radius:4px;border-left:3px solid #1a3e6e;">Notes: ${loan.notes}</div>` : ""}

  <div class="sig-row">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Customer Signature</div>
      <div style="font-size:10px;color:#999;margin-top:2px;">${loan.customerName}</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Authorised Signatory</div>
      <div style="font-size:10px;color:#999;margin-top:2px;">${shopName}</div>
    </div>
  </div>

  <div style="text-align:center;font-size:10px;color:#aaa;margin-top:20px;border-top:1px dashed #ddd;padding-top:8px;">
    This is a computer-generated Girvi voucher. Powered by SwarnDesk.
  </div>
</div>
</body>
</html>`;

  const w = window.open("", "_blank", "width=800,height=700");
  if (w) { w.document.write(html); w.document.close(); }
}

type Loan = {
  id: number;
  loanNumber: string;
  customerName: string;
  customerMobile: string;
  kycDocType: string | null;
  kycDocNumber: string | null;
  metalType: string;
  purity: string;
  grossWeight: number;
  netWeight: number;
  estimatedValue: number;
  loanAmount: number;
  interestRate: number;
  interestPeriod: string;
  startDate: string;
  dueDate: string;
  status: string;
  accruedInterest: number;
  totalDue: number;
  daysRemaining: number;
  isOverdue: boolean;
  redeemedDate: string | null;
  redeemedAmount: number | null;
  goldSaleValue: number | null;
  lossAmount: number | null;
  notes: string | null;
};

type Summary = {
  totalActive: number;
  totalLent: number;
  totalInterestAccrued: number;
  overdueCount: number;
  totalLoss: number;
  totalLoans: number;
};

export default function Girvi() {
  const { toast } = useToast();
  const { data: settings } = useGetSettings();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [calendarMode, setCalendarMode] = useState<"en" | "hi">("en");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [actionLoan, setActionLoan] = useState<Loan | null>(null);
  const [actionType, setActionType] = useState<"redeem" | "forfeit" | "extend" | null>(null);
  const [goldSaleValue, setGoldSaleValue] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const shopName = settings?.businessName ?? "SwarnDesk Jewellers";
  const shopAddress = settings?.address ?? "";
  const shopMobile = settings?.mobile ?? "";

  const loadAll = async () => {
    setLoading(true);
    try {
      const [loansRes, sumRes] = await Promise.all([
        fetch(`${API}${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
        fetch(`${API}/stats/summary`),
      ]);
      if (loansRes.ok && sumRes.ok) {
        setLoans(await loansRes.json());
        setSummary(await sumRes.json());
      }
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [statusFilter]);

  const filteredLoans = useMemo(() => {
    if (!search.trim()) return loans;
    const q = search.toLowerCase();
    return loans.filter(l =>
      l.customerName.toLowerCase().includes(q) ||
      l.loanNumber.toLowerCase().includes(q) ||
      l.customerMobile.includes(q)
    );
  }, [loans, search]);

  const formatDateDisplay = (iso: string) => {
    const d = new Date(iso);
    return calendarMode === "hi" ? toVikramSamvat(d) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const handleAction = async () => {
    if (!actionLoan || !actionType) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (actionType === "redeem") {
        body.status = "redeemed";
      } else if (actionType === "forfeit") {
        const saleVal = parseFloat(goldSaleValue);
        if (isNaN(saleVal) || saleVal < 0) {
          toast({ title: "Enter a valid gold sale value", variant: "destructive" });
          setSubmitting(false); return;
        }
        body.status = "forfeited";
        body.goldSaleValue = saleVal;
      } else if (actionType === "extend") {
        if (!newDueDate) {
          toast({ title: "Select a new due date", variant: "destructive" });
          setSubmitting(false); return;
        }
        body.status = "extended";
        body.newDueDate = new Date(newDueDate).toISOString();
      }
      const r = await fetch(`${API}/${actionLoan.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      const msgs: Record<string, string> = {
        redeem: "Loan redeemed successfully!",
        forfeit: "Loan forfeited & loss recorded",
        extend: "Loan extended to new due date",
      };
      toast({ title: msgs[actionType] });
      setActionLoan(null); setActionType(null);
      setGoldSaleValue(""); setNewDueDate("");
      loadAll();
    } catch {
      toast({ title: "Failed to update loan", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const sendBulkOverdueReminders = () => {
    const overdue = loans.filter(l => l.isOverdue);
    if (overdue.length === 0) { toast({ title: "No overdue loans to remind" }); return; }
    overdue.forEach(loan => {
      const msg = `Namaskar ${loan.customerName} ji,\n\nYour Girvi loan ${loan.loanNumber} is OVERDUE by ${Math.abs(loan.daysRemaining)} days.\n\nLoan: ${formatCurrency(loan.loanAmount)} | Interest: ${formatCurrency(loan.accruedInterest)} | Total due: ${formatCurrency(loan.totalDue)}\n\nKindly visit our store at the earliest to redeem your ${loan.metalType} (${loan.purity}).\n\nThank you — ${shopName}`;
      window.open(`https://wa.me/91${loan.customerMobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
    });
    toast({ title: `WhatsApp opened for ${overdue.length} overdue customer${overdue.length > 1 ? "s" : ""}` });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" />
            Girvi — Money Lending
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gold collateral loans with auto interest recalculation</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(summary?.overdueCount ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={sendBulkOverdueReminders} className="gap-1.5 border-orange-400/40 text-orange-600 hover:bg-orange-50">
              <MessageCircle className="w-3.5 h-3.5" />
              Remind {summary!.overdueCount} Overdue
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setCalendarMode(c => c === "en" ? "hi" : "en")} className="gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {calendarMode === "en" ? "हिंदी तिथि" : "English Date"}
          </Button>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Recalculate
          </Button>
          <Button size="sm" onClick={() => setShowNewLoan(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Girvi
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
        {[
          { label: "Active Loans", value: (summary?.totalActive ?? 0).toString(), icon: Banknote, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Lent", value: formatCurrency(summary?.totalLent ?? 0), icon: TrendingDown, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Interest Accrued", value: formatCurrency(summary?.totalInterestAccrued ?? 0), icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
          { label: "Overdue", value: (summary?.overdueCount ?? 0).toString(), icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "Total Loss", value: formatCurrency(summary?.totalLoss ?? 0), icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
        ].map(card => (
          <Card key={card.label} className="border-border">
            <CardContent className="p-3 md:p-4">
              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="text-base md:text-lg font-bold">{card.value}</div>
              <div className="text-xs text-muted-foreground">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + search + list */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, mobile, or loan number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="redeemed">Redeemed</SelectItem>
                <SelectItem value="forfeited">Forfeited</SelectItem>
                <SelectItem value="extended">Extended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {search && (
            <p className="text-xs text-muted-foreground mt-1">
              {filteredLoans.length} result{filteredLoans.length !== 1 ? "s" : ""} for "{search}"
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading && loans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading loans...</div>
          ) : filteredLoans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search ? `No loans found for "${search}"` : "No girvi vouchers yet. Click \"New Girvi\" to create the first loan."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLoans.map(loan => (
                <div key={loan.id} className={`px-3 md:px-4 py-3 ${loan.isOverdue ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                  <div
                    className="flex items-center justify-between gap-2 md:gap-4 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === loan.id ? null : loan.id)}
                  >
                    {/* Left */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{loan.customerName}</span>
                        <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{loan.loanNumber}</span>
                        <Badge
                          variant={loan.status === "active" ? (loan.isOverdue ? "destructive" : "default") : loan.status === "redeemed" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {loan.isOverdue ? "OVERDUE" : loan.status.toUpperCase()}
                        </Badge>
                        {loan.estimatedValue > 0 && loan.status === "active" && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            loan.loanAmount / loan.estimatedValue > 0.8 ? "bg-red-100 text-red-700" :
                            loan.loanAmount / loan.estimatedValue > 0.6 ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            LTV {((loan.loanAmount / loan.estimatedValue) * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {loan.metalType.toUpperCase()} {loan.purity} · {loan.grossWeight.toFixed(3)}g ·{" "}
                        {loan.interestRate}% {loan.interestPeriod}
                        <span className="hidden sm:inline"> · Due: {formatDateDisplay(loan.dueDate)}</span>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-primary">{formatCurrency(loan.totalDue)}</div>
                      <div className="text-xs text-muted-foreground hidden sm:block">
                        {formatCurrency(loan.loanAmount)} + {formatCurrency(loan.accruedInterest)} int.
                      </div>
                    </div>

                    <div className="text-muted-foreground flex-shrink-0">
                      {expandedId === loan.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === loan.id && (
                    <div className="mt-4 p-3 md:p-4 rounded-xl bg-muted/20 border border-border space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground mb-1 font-medium">Gold Details</div>
                          <div className="font-medium">{loan.metalType.toUpperCase()} {loan.purity}</div>
                          <div>Gross: {loan.grossWeight.toFixed(3)}g</div>
                          <div>Net: {loan.netWeight.toFixed(3)}g</div>
                          <div>Est. Value: {formatCurrency(loan.estimatedValue)}</div>
                          {loan.estimatedValue > 0 && (
                            <div className="mt-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                loan.loanAmount / loan.estimatedValue > 0.8 ? "bg-red-100 text-red-700" :
                                loan.loanAmount / loan.estimatedValue > 0.6 ? "bg-amber-100 text-amber-700" :
                                "bg-green-100 text-green-700"
                              }`}>
                                LTV: {((loan.loanAmount / loan.estimatedValue) * 100).toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1 font-medium">Loan Terms</div>
                          <div className="font-medium">{formatCurrency(loan.loanAmount)} principal</div>
                          <div>{loan.interestRate}% per {loan.interestPeriod}</div>
                          <div>Start: {formatDateDisplay(loan.startDate)}</div>
                          <div>Due: {formatDateDisplay(loan.dueDate)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1 font-medium">Interest (Live)</div>
                          <div className="font-medium text-green-600">{formatCurrency(loan.accruedInterest)}</div>
                          <div>{calcDaysElapsed(loan.startDate)} days elapsed</div>
                          <div className={loan.isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {loan.daysRemaining >= 0
                              ? `${loan.daysRemaining} days remaining`
                              : `${Math.abs(loan.daysRemaining)} days overdue`}
                          </div>
                          <div className="font-semibold mt-1">Total Due: {formatCurrency(loan.totalDue)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1 font-medium">KYC / ID</div>
                          <div className="font-medium">{loan.kycDocType ? loan.kycDocType.replace(/_/g, " ").toUpperCase() : "—"}</div>
                          <div className="break-all">{loan.kycDocNumber ?? "Not recorded"}</div>
                          <div className="text-muted-foreground mt-1">{loan.customerMobile}</div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {loan.status === "active" && (
                        <div className="flex gap-2 flex-wrap pt-1">
                          <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"
                            onClick={() => { setActionLoan(loan); setActionType("redeem"); }}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Redeem ({formatCurrency(loan.totalDue)})
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1.5"
                            onClick={() => { setActionLoan(loan); setActionType("forfeit"); setGoldSaleValue(loan.estimatedValue.toString()); }}>
                            <XCircle className="w-3.5 h-3.5" />
                            Forfeit Gold
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => {
                              const defaultExt = new Date(loan.dueDate);
                              defaultExt.setDate(defaultExt.getDate() + 30);
                              setNewDueDate(defaultExt.toISOString().split("T")[0]);
                              setActionLoan(loan); setActionType("extend");
                            }}>
                            <Clock className="w-3.5 h-3.5" />
                            Extend Loan
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => openGirviVoucher(loan, shopName, shopAddress, shopMobile)}>
                            <PrinterIcon className="w-3.5 h-3.5" />
                            Print Voucher
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 border-green-500/40 text-green-600 hover:bg-green-50"
                            onClick={() => {
                              const dueText = loan.isOverdue
                                ? `is OVERDUE by ${Math.abs(loan.daysRemaining)} days`
                                : `is due in ${loan.daysRemaining} days`;
                              const msg = `Namaskar ${loan.customerName} ji,\n\nYour Girvi loan ${loan.loanNumber} ${dueText}.\n\nPrincipal: ${formatCurrency(loan.loanAmount)} | Interest: ${formatCurrency(loan.accruedInterest)} | Total due: ${formatCurrency(loan.totalDue)}\n\nKindly visit our store to redeem your ${loan.metalType} (${loan.purity}) at your earliest convenience.\n\n— ${shopName}`;
                              window.open(`https://wa.me/91${loan.customerMobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                            }}>
                            <MessageCircle className="w-3.5 h-3.5" />
                            {loan.isOverdue ? "Overdue Reminder" : "Due Reminder"}
                          </Button>
                        </div>
                      )}

                      {/* Print for non-active loans */}
                      {loan.status !== "active" && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => openGirviVoucher(loan, shopName, shopAddress, shopMobile)}>
                            <PrinterIcon className="w-3.5 h-3.5" />
                            Print Voucher
                          </Button>
                        </div>
                      )}

                      {loan.status === "forfeited" && loan.lossAmount !== null && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                          <TrendingDown className="w-4 h-4 text-destructive flex-shrink-0" />
                          <span>
                            Sold for {formatCurrency(loan.goldSaleValue ?? 0)} ·
                            Due was {formatCurrency((loan.loanAmount ?? 0) + (loan.accruedInterest ?? 0))} ·{" "}
                            <strong className="text-destructive">Loss: {formatCurrency(loan.lossAmount)}</strong>
                          </span>
                        </div>
                      )}

                      {loan.status === "redeemed" && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>
                            Redeemed on {loan.redeemedDate ? formatDateDisplay(loan.redeemedDate) : "—"} ·
                            Collected {formatCurrency(loan.redeemedAmount ?? 0)}
                          </span>
                        </div>
                      )}

                      {loan.status === "extended" && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span>Loan extended · New due date: {formatDateDisplay(loan.dueDate)}</span>
                        </div>
                      )}

                      {loan.notes && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2 italic">
                          Note: {loan.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Loan Dialog */}
      <NewLoanDialog
        open={showNewLoan}
        onClose={() => setShowNewLoan(false)}
        onCreated={() => { setShowNewLoan(false); loadAll(); }}
      />

      {/* Action Dialog (Redeem / Forfeit / Extend) */}
      <Dialog open={!!actionLoan} onOpenChange={() => { setActionLoan(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "redeem" ? "Confirm Loan Redemption" :
               actionType === "forfeit" ? "Forfeit Gold — Record Loss" :
               "Extend Loan Due Date"}
            </DialogTitle>
          </DialogHeader>
          {actionLoan && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm space-y-1">
                <div><span className="text-muted-foreground">Customer:</span> <strong>{actionLoan.customerName}</strong></div>
                <div><span className="text-muted-foreground">Loan #:</span> {actionLoan.loanNumber}</div>
                <div><span className="text-muted-foreground">Collateral:</span> {actionLoan.metalType.toUpperCase()} {actionLoan.purity} · {actionLoan.grossWeight.toFixed(3)}g</div>
                <div><span className="text-muted-foreground">Principal:</span> {formatCurrency(actionLoan.loanAmount)}</div>
                <div><span className="text-muted-foreground">Interest Accrued:</span> {formatCurrency(actionLoan.accruedInterest)}</div>
                <div className="font-semibold text-primary pt-1">Total Due: {formatCurrency(actionLoan.totalDue)}</div>
              </div>

              {actionType === "redeem" && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                  Collect <strong>{formatCurrency(actionLoan.totalDue)}</strong> from the customer and return the pledged {actionLoan.metalType} to them.
                </div>
              )}

              {actionType === "forfeit" && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Amount received from selling the gold (₹)</label>
                  <input
                    type="number"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    value={goldSaleValue}
                    onChange={e => setGoldSaleValue(e.target.value)}
                    placeholder="Enter amount received"
                  />
                  {goldSaleValue && !isNaN(parseFloat(goldSaleValue)) && (
                    <p className={`text-xs mt-2 p-2 rounded ${parseFloat(goldSaleValue) < actionLoan.totalDue ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                      {parseFloat(goldSaleValue) < actionLoan.totalDue
                        ? `⚠ Net loss: ${formatCurrency(actionLoan.totalDue - parseFloat(goldSaleValue))} (gold value less than total due)`
                        : `✓ Net gain: ${formatCurrency(parseFloat(goldSaleValue) - actionLoan.totalDue)}`}
                    </p>
                  )}
                </div>
              )}

              {actionType === "extend" && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Current due date: {new Date(actionLoan.dueDate).toLocaleDateString("en-IN")}</label>
                  <label className="text-xs text-muted-foreground block mb-1">New due date *</label>
                  <input
                    type="date"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    value={newDueDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => setNewDueDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Interest continues to accrue from the original start date. Consider collecting the interest due so far.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setActionLoan(null); setActionType(null); }}>Cancel</Button>
                <Button
                  size="sm"
                  variant={actionType === "forfeit" ? "destructive" : "default"}
                  onClick={handleAction}
                  disabled={submitting}
                >
                  {submitting ? "Processing..." :
                   actionType === "redeem" ? "Confirm Redemption" :
                   actionType === "forfeit" ? "Forfeit & Record Loss" :
                   "Extend Due Date"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewLoanDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    customerName: "", customerMobile: "",
    kycDocType: "aadhaar", kycDocNumber: "",
    metalType: "gold", purity: "22K",
    grossWeight: "", netWeight: "", estimatedValue: "",
    loanAmount: "", interestRate: "2", interestPeriod: "monthly",
    dueDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const loanAmt = parseFloat(form.loanAmount || "0");
  const estVal = parseFloat(form.estimatedValue || "0");
  const ltv = estVal > 0 ? (loanAmt / estVal) * 100 : 0;

  const handleSubmit = async () => {
    if (!form.customerName.trim()) { toast({ title: "Customer name is required", variant: "destructive" }); return; }
    if (!form.customerMobile.trim()) { toast({ title: "Customer mobile is required", variant: "destructive" }); return; }
    if (!form.grossWeight || parseFloat(form.grossWeight) <= 0) { toast({ title: "Gross weight is required", variant: "destructive" }); return; }
    if (!form.loanAmount || parseFloat(form.loanAmount) <= 0) { toast({ title: "Loan amount is required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/girvi", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          grossWeight: parseFloat(form.grossWeight),
          netWeight: parseFloat(form.netWeight || form.grossWeight),
          estimatedValue: parseFloat(form.estimatedValue || "0"),
          loanAmount: parseFloat(form.loanAmount),
          interestRate: parseFloat(form.interestRate),
          dueDate: new Date(form.dueDate).toISOString(),
        }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Girvi loan created successfully!" });
      onCreated();
    } catch {
      toast({ title: "Failed to create loan", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Girvi Loan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">

          {/* Customer */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer & KYC</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Customer Name *</label>
                <input className={inp} value={form.customerName} onChange={e => set("customerName", e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className={lbl}>Mobile *</label>
                <input className={inp} value={form.customerMobile} onChange={e => set("customerMobile", e.target.value)} placeholder="+91 XXXXX XXXXX" />
              </div>
              <div>
                <label className={lbl}>KYC Document Type</label>
                <Select value={form.kycDocType} onValueChange={v => set("kycDocType", v)}>
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
              <div>
                <label className={lbl}>Document Number</label>
                <input className={inp} value={form.kycDocNumber} onChange={e => set("kycDocNumber", e.target.value)} placeholder="Document number" />
              </div>
            </div>
          </div>

          {/* Gold details */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gold / Silver Collateral</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Metal Type</label>
                <Select value={form.metalType} onValueChange={v => set("metalType", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={lbl}>Purity</label>
                <Select value={form.purity} onValueChange={v => set("purity", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24K">24K</SelectItem>
                    <SelectItem value="22K">22K</SelectItem>
                    <SelectItem value="18K">18K</SelectItem>
                    <SelectItem value="14K">14K</SelectItem>
                    <SelectItem value="925">Silver 925</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={lbl}>Gross Weight (g) *</label>
                <input className={inp} type="number" step="0.001" value={form.grossWeight} onChange={e => set("grossWeight", e.target.value)} placeholder="0.000" />
              </div>
              <div>
                <label className={lbl}>Net Weight (g) <span className="text-muted-foreground/60">after stone deduction</span></label>
                <input className={inp} type="number" step="0.001" value={form.netWeight} onChange={e => set("netWeight", e.target.value)} placeholder="Leave blank if same as gross" />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Estimated Market Value (₹) <span className="text-muted-foreground/60">at today's gold rate</span></label>
                <input className={inp} type="number" value={form.estimatedValue} onChange={e => set("estimatedValue", e.target.value)} placeholder="Current market value of the gold" />
              </div>
            </div>
          </div>

          {/* Loan terms */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Loan Terms</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Loan Amount (₹) *</label>
                <input className={inp} type="number" value={form.loanAmount} onChange={e => set("loanAmount", e.target.value)} placeholder="Principal amount to disburse" />
              </div>
              <div>
                <label className={lbl}>Interest Rate (%)</label>
                <input className={inp} type="number" step="0.1" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} placeholder="e.g. 2" />
              </div>
              <div>
                <label className={lbl}>Interest Period</label>
                <Select value={form.interestPeriod} onValueChange={v => set("interestPeriod", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Per Week (7 days)</SelectItem>
                    <SelectItem value="monthly">Per Month (30 days)</SelectItem>
                    <SelectItem value="yearly">Per Year (365 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={lbl}>Due Date *</label>
                <input className={inp} type="date" value={form.dueDate} min={new Date().toISOString().split("T")[0]} onChange={e => set("dueDate", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Notes (optional)</label>
                <input className={inp} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="e.g. item description, condition, landmarks" />
              </div>
            </div>
          </div>

          {/* LTV warning */}
          {loanAmt > 0 && estVal > 0 && (
            <div className={`p-3 rounded-xl border text-xs ${
              ltv > 80 ? "bg-red-50 border-red-200 text-red-700" :
              ltv > 60 ? "bg-amber-50 border-amber-200 text-amber-700" :
              "bg-green-50 border-green-200 text-green-700"
            }`}>
              <strong>LTV Ratio: {ltv.toFixed(0)}%</strong> — Loan amount is {ltv.toFixed(0)}% of estimated gold value.
              {ltv > 80 ? " ⚠ High risk — consider reducing the loan amount." :
               ltv > 60 ? " Moderate risk — within acceptable range." :
               " Good — comfortable margin."}
            </div>
          )}

          {/* Interest preview */}
          {form.loanAmount && form.interestRate && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
              <div className="font-semibold text-primary mb-2">Interest Preview</div>
              {[
                { label: "After 1 month", days: 30 },
                { label: "After 3 months", days: 90 },
                { label: "After 6 months", days: 180 },
              ].map(({ label, days }) => {
                const periodDays = form.interestPeriod === "weekly" ? 7 : form.interestPeriod === "yearly" ? 365 : 30;
                const interest = Math.round(parseFloat(form.loanAmount || "0") * (parseFloat(form.interestRate || "0") / 100) * (days / periodDays));
                return (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">
                      Interest: {formatCurrency(interest)} · Total: {formatCurrency(parseFloat(form.loanAmount || "0") + interest)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating..." : "Create Girvi Loan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
