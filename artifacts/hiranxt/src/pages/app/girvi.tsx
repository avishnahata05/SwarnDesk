import { useState, useEffect, useMemo, useCallback } from "react";
import { useBackClose } from "@/hooks/use-back-close";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings, useGetCurrentRates } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Banknote, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp,
  Plus, RefreshCw, XCircle, ChevronDown, ChevronUp, Calendar,
  MessageCircle, Search, PrinterIcon, Clock, Coins, Scale,
  Receipt, RotateCcw, ArrowUpRight, Flame,
} from "lucide-react";

const API = "/api/girvi";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("swarndesk_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

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

// ─── Print helpers ────────────────────────────────────────────────────────────

function printInterestReceipt(
  payment: Payment,
  loan: Loan,
  shopName: string,
  shopAddress: string,
  shopMobile: string,
) {
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const fmtD = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const typeLabel: Record<string, string> = { interest: "Interest Collection", renewal: "Loan Renewal", penalty: "Penalty Payment" };

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Receipt — ${payment.id}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;font-size:12px;background:#fff}
.page{max-width:360px;margin:0 auto;padding:20px}
.shop{text-align:center;border-bottom:2px solid #1a3e6e;padding-bottom:10px;margin-bottom:12px}
.shop-name{font-size:16px;font-weight:800;color:#1a3e6e}
.shop-sub{font-size:10px;color:#555;margin-top:2px}
.title{text-align:center;font-weight:700;font-size:13px;color:#c0392b;letter-spacing:1px;margin:8px 0;border:1px dashed #c0392b;padding:5px}
.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #eee}
.label{color:#666}
.value{font-weight:600}
.amount-box{text-align:center;margin:14px 0;padding:10px;background:#f0fdf4;border:2px solid #16a34a;border-radius:8px}
.amount-label{font-size:10px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.amount-value{font-size:22px;font-weight:800;color:#15803d;margin-top:4px}
.footer{text-align:center;font-size:10px;color:#999;margin-top:14px;border-top:1px dashed #ddd;padding-top:8px}
.sig-row{display:flex;justify-content:space-between;margin-top:20px}
.sig-box{text-align:center;width:45%}
.sig-line{border-top:1px solid #333;margin-bottom:4px}
.sig-label{font-size:9px;color:#666}
@media print{button{display:none!important}}
</style></head><body><div class="page">
<div style="text-align:right;margin-bottom:12px">
  <button onclick="window.print()" style="background:#1a3e6e;color:#fff;border:none;padding:6px 16px;border-radius:4px;font-size:12px;cursor:pointer">🖨 Print</button>
</div>
<div class="shop">
  <div class="shop-name">${shopName}</div>
  <div class="shop-sub">${shopAddress}${shopMobile ? ` · ${shopMobile}` : ""}</div>
</div>
<div class="title">${typeLabel[payment.paymentType] ?? "Payment Receipt"}</div>
<div class="row"><span class="label">Receipt #</span><span class="value">RCT-${payment.id}</span></div>
<div class="row"><span class="label">Date</span><span class="value">${fmtD(payment.paymentDate)}</span></div>
<div class="row"><span class="label">Loan No.</span><span class="value">${loan.loanNumber}</span></div>
<div class="row"><span class="label">Customer</span><span class="value">${loan.customerName}</span></div>
<div class="row"><span class="label">Mobile</span><span class="value">${loan.customerMobile}</span></div>
<div class="row"><span class="label">Collateral</span><span class="value">${loan.metalType.toUpperCase()} ${loan.purity} · ${loan.grossWeight.toFixed(3)}g</span></div>
${loan.itemDescription ? `<div class="row"><span class="label">Items</span><span class="value" style="max-width:55%;text-align:right;word-break:break-word">${loan.itemDescription}</span></div>` : ""}
<div class="amount-box">
  <div class="amount-label">${typeLabel[payment.paymentType] ?? "Amount Received"}</div>
  <div class="amount-value">${fmt(payment.amount)}</div>
</div>
<div class="row"><span class="label">Principal (Remaining)</span><span class="value">${fmt(loan.loanAmount)}</span></div>
<div class="row"><span class="label">Total Collected So Far</span><span class="value">${fmt(loan.totalInterestCollected)}</span></div>
${payment.notes ? `<div style="margin-top:8px;padding:6px;background:#f8f9fa;border-radius:4px;font-size:11px;color:#555">Note: ${payment.notes}</div>` : ""}
<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Customer Signature</div></div>
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Authorised by ${shopName}</div></div>
</div>
<div class="footer">This is a computer-generated receipt. Powered by SwarnDesk.</div>
</div></body></html>`;

  const w = window.open("", "_blank", "width=420,height=600");
  if (w) { w.document.write(html); w.document.close(); }
}

function openGirviVoucher(loan: Loan, shopName: string, shopAddress: string, shopMobile: string, items?: LoanItem[]) {
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const periodDays = loan.interestPeriod === "weekly" ? 7 : loan.interestPeriod === "yearly" ? 365 : 30;
  const interest3m = Math.round(loan.loanAmount * (loan.interestRate / 100) * (90 / periodDays));
  const interest6m = Math.round(loan.loanAmount * (loan.interestRate / 100) * (180 / periodDays));

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Girvi Voucher — ${loan.loanNumber}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;font-size:12px;background:#fff}
.page{max-width:720px;margin:0 auto;padding:24px 20px}
.shop-header{text-align:center;border-bottom:3px double #1a3e6e;padding-bottom:12px;margin-bottom:14px}
.shop-name{font-size:20px;font-weight:800;color:#1a3e6e}
.shop-sub{font-size:11px;color:#555;margin-top:3px}
.doc-title{font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#c0392b;text-align:center;margin:12px 0 8px;border:1px solid #c0392b;padding:6px;border-radius:4px}
.meta-row{display:flex;justify-content:space-between;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:12px}
.meta-item{text-align:center}
.meta-label{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
.meta-value{font-weight:700;color:#1a3e6e;font-size:13px;margin-top:2px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.section{border:1px solid #dee2e6;border-radius:6px;padding:10px 12px}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#666;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e9ecef}
.field{display:flex;justify-content:space-between;margin-bottom:4px}
.field-label{color:#777}
.field-value{font-weight:600;text-align:right;max-width:55%}
.interest-table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
.interest-table th{background:#1a3e6e;color:#fff;padding:6px 10px;text-align:left}
.interest-table td{padding:5px 10px;border-bottom:1px solid #e9ecef}
.interest-table tr:last-child td{font-weight:700;background:#fff3cd}
.terms{border:1px solid #dee2e6;border-radius:6px;padding:10px 12px;margin-bottom:14px}
.terms ol{padding-left:16px}
.terms li{margin-bottom:3px;color:#444;font-size:11px}
.sig-row{display:flex;justify-content:space-between;margin-top:20px}
.sig-box{text-align:center;width:45%}
.sig-line{border-top:1px solid #333;margin-bottom:4px}
.sig-label{font-size:10px;color:#666}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.no-print{display:none!important}}
</style></head><body><div class="page">
<div class="no-print" style="text-align:right;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1a3e6e;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600">🖨️ Print Voucher</button>
</div>
<div class="shop-header">
  <div class="shop-name">${shopName}</div>
  <div class="shop-sub">${shopAddress}${shopMobile ? ` · ${shopMobile}` : ""}</div>
</div>
<div class="doc-title">Girvi Voucher (Pawn Receipt)</div>
<div class="meta-row">
  <div class="meta-item"><div class="meta-label">Loan Number</div><div class="meta-value">${loan.loanNumber}</div></div>
  <div class="meta-item"><div class="meta-label">Start Date</div><div class="meta-value">${fmtDate(loan.startDate)}</div></div>
  <div class="meta-item"><div class="meta-label">Due Date</div><div class="meta-value">${fmtDate(loan.dueDate)}</div></div>
  <div class="meta-item"><div class="meta-label">Status</div><div class="meta-value">${loan.status.toUpperCase()}</div></div>
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
    <div class="field"><span class="field-label">Total Gross Wt</span><span class="field-value">${loan.grossWeight.toFixed(3)} g</span></div>
    <div class="field"><span class="field-label">Total Net Wt</span><span class="field-value">${loan.netWeight.toFixed(3)} g</span></div>
    <div class="field"><span class="field-label">Est. Market Value</span><span class="field-value">${fmt(loan.estimatedValue)}</span></div>
    ${loan.itemDescription ? `<div class="field" style="margin-top:4px"><span class="field-label">Items</span><span class="field-value" style="max-width:65%;text-align:right;word-break:break-word;font-size:11px">${loan.itemDescription}</span></div>` : ""}
  </div>
</div>
${items && items.length > 0 ? `
<div class="section" style="margin-bottom:12px">
  <div class="section-title">Pledged Items Breakdown</div>
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:#f8f9fa">
      <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #dee2e6">Item</th>
      <th style="text-align:center;padding:4px 6px;border-bottom:1px solid #dee2e6">Qty</th>
      <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #dee2e6">Metal / Purity</th>
      <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #dee2e6">Gross Wt</th>
      <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #dee2e6">Net Wt</th>
      <th style="text-align:right;padding:4px 6px;border-bottom:1px solid #dee2e6">Est. Value</th>
    </tr></thead>
    <tbody>
      ${items.map(it => `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:4px 6px;font-weight:600">${it.itemType}</td>
        <td style="padding:4px 6px;text-align:center">${it.quantity}</td>
        <td style="padding:4px 6px">${it.metalType === "silver" ? "Silver" : "Gold"} ${it.purity}</td>
        <td style="padding:4px 6px;text-align:right">${it.grossWeight.toFixed(3)} g</td>
        <td style="padding:4px 6px;text-align:right">${it.netWeight.toFixed(3)} g</td>
        <td style="padding:4px 6px;text-align:right">${fmt(it.estimatedValue)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>` : ""}
<div class="section" style="margin-bottom:12px">
  <div class="section-title">Loan Terms</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
    <div class="field" style="flex-direction:column;gap:2px"><span class="field-label">Principal Amount</span><span style="font-size:16px;font-weight:800;color:#1a3e6e">${fmt(loan.loanAmount)}</span></div>
    <div class="field" style="flex-direction:column;gap:2px"><span class="field-label">Interest Rate</span><span style="font-weight:700">${loan.interestRate}% per ${loan.interestPeriod}${loan.penaltyRate > 0 ? ` (+${loan.penaltyRate}% penalty if overdue)` : ""}</span></div>
    <div class="field" style="flex-direction:column;gap:2px"><span class="field-label">Duration</span><span style="font-weight:700">${Math.ceil((new Date(loan.dueDate).getTime() - new Date(loan.startDate).getTime()) / 86400000)} days</span></div>
  </div>
</div>
<table class="interest-table">
  <thead><tr><th>Period</th><th>Interest Accrued</th><th>Total Due</th></tr></thead>
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
${loan.notes ? `<div style="font-size:11px;color:#666;margin-bottom:12px;padding:8px;background:#f8f9fa;border-radius:4px;border-left:3px solid #1a3e6e">Notes: ${loan.notes}</div>` : ""}
<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Customer Signature</div><div style="font-size:10px;color:#999;margin-top:2px">${loan.customerName}</div></div>
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Authorised Signatory</div><div style="font-size:10px;color:#999;margin-top:2px">${shopName}</div></div>
</div>
<div style="text-align:center;font-size:10px;color:#aaa;margin-top:20px;border-top:1px dashed #ddd;padding-top:8px">This is a computer-generated Girvi voucher. Powered by SwarnDesk.</div>
</div></body></html>`;

  const w = window.open("", "_blank", "width=800,height=700");
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Payment = {
  id: number;
  loanId: number;
  loanNumber: string;
  customerName: string;
  amount: number;
  paymentType: string;
  paymentDate: string;
  notes: string | null;
};

type Loan = {
  id: number;
  loanNumber: string;
  customerName: string;
  customerMobile: string;
  kycDocType: string | null;
  kycDocNumber: string | null;
  itemDescription: string | null;
  metalType: string;
  purity: string;
  grossWeight: number;
  netWeight: number;
  estimatedValue: number;
  loanAmount: number;       // original loan amount
  principalPaid: number;    // cumulative principal repaid
  currentPrincipal: number; // loanAmount - principalPaid (what interest accrues on)
  interestRate: number;
  penaltyRate: number;
  interestPeriod: string;
  periodDays: number;
  dailyRate: number;
  startDate: string;
  dueDate: string;
  status: string;
  normalInterest: number;
  penaltyInterest: number;
  accruedInterest: number;
  totalInterestCollected: number;
  collectedSinceReset: number;
  outstandingInterest: number;
  totalDue: number;
  daysRemaining: number;
  isOverdue: boolean;
  redeemedDate: string | null;
  redeemedAmount: number | null;
  goldSaleValue: number | null;
  lossAmount: number | null;
  notes: string | null;
};

type LoanItem = {
  id: number;
  itemType: string;
  quantity: number;
  metalType: string;
  purity: string;
  grossWeight: number;
  netWeight: number;
  estimatedValue: number;
};

type Summary = {
  totalActive: number;
  totalLent: number;
  totalInterestAccrued: number;
  totalInterestCollected: number;
  overdueCount: number;
  dueSoonCount: number;
  totalLoss: number;
  totalLoans: number;
  totalGoldWeight: number;
  totalSilverWeight: number;
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function Girvi() {
  const { toast } = useToast();
  const { data: settings } = useGetSettings();
  const { data: rates } = useGetCurrentRates();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [dueFilter, setDueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [calendarMode, setCalendarMode] = useState<"en" | "hi">("en");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loanPayments, setLoanPayments] = useState<Record<number, Payment[]>>({});
  const [loanItems, setLoanItems] = useState<Record<number, LoanItem[]>>({});

  // Dialog state
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [actionLoan, setActionLoan] = useState<Loan | null>(null);
  const [actionType, setActionType] = useState<"redeem" | "forfeit" | "extend" | "collect" | "renew" | null>(null);
  const [goldSaleValue, setGoldSaleValue] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [collectAmount, setCollectAmount] = useState("");
  const [collectType, setCollectType] = useState("auto");
  const [collectNotes, setCollectNotes] = useState("");
  const [renewInterestPaid, setRenewInterestPaid] = useState("");
  const [renewNewDueDate, setRenewNewDueDate] = useState("");
  const [renewNotes, setRenewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);

  const closeNewLoan = useCallback(() => setShowNewLoan(false), []);
  const closeActionDialog = useCallback(() => { setActionLoan(null); setActionType(null); }, []);
  useBackClose(showNewLoan, closeNewLoan);
  useBackClose(!!actionLoan, closeActionDialog);

  // Auto-dismiss the print receipt toast after 10 seconds
  useEffect(() => {
    if (!lastPayment) return;
    const t = setTimeout(() => setLastPayment(null), 10000);
    return () => clearTimeout(t);
  }, [lastPayment]);

  const shopName = settings?.businessName ?? "SwarnDesk Jewellers";
  const shopAddress = settings?.address ?? "";
  const shopMobile = settings?.mobile ?? "";

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dueFilter !== "all") params.set("due", dueFilter);
      const headers = { Authorization: `Bearer ${localStorage.getItem("swarndesk_token")}` };
      const [loansRes, sumRes] = await Promise.all([
        fetch(`${API}?${params}`, { headers }),
        fetch(`${API}/stats/summary`, { headers }),
      ]);
      if (loansRes.ok) setLoans(await loansRes.json());
      else if (loansRes.status !== 401) toast({ title: "Failed to load loans", variant: "destructive" });
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch {
      toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dueFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadPayments = async (loanId: number) => {
    if (loanPayments[loanId]) return;
    try {
      const r = await fetch(`${API}/${loanId}/payments`, { headers: { Authorization: `Bearer ${localStorage.getItem("swarndesk_token")}` } });
      if (r.ok) { const data = await r.json(); setLoanPayments(prev => ({ ...prev, [loanId]: data })); }
    } catch { /* silent */ }
  };

  const loadItems = async (loanId: number) => {
    if (loanItems[loanId]) return;
    try {
      const r = await fetch(`${API}/${loanId}/items`, { headers: { Authorization: `Bearer ${localStorage.getItem("swarndesk_token")}` } });
      if (r.ok) { const data = await r.json(); setLoanItems(prev => ({ ...prev, [loanId]: data })); }
    } catch { /* silent */ }
  };

  const handleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
    if (expandedId !== id) { loadPayments(id); loadItems(id); }
  };

  const filteredLoans = useMemo(() => {
    if (!search.trim()) return loans;
    const q = search.toLowerCase();
    return loans.filter(l =>
      l.customerName.toLowerCase().includes(q) ||
      l.loanNumber.toLowerCase().includes(q) ||
      l.customerMobile.includes(q) ||
      (l.itemDescription ?? "").toLowerCase().includes(q)
    );
  }, [loans, search]);

  // Group by customer for exposure view
  const customerExposure = useMemo(() => {
    const map: Record<string, { name: string; mobile: string; loans: Loan[]; totalDue: number }> = {};
    filteredLoans.filter(l => l.status === "active" || l.status === "extended").forEach(l => {
      const key = l.customerMobile;
      if (!map[key]) map[key] = { name: l.customerName, mobile: l.customerMobile, loans: [], totalDue: 0 };
      map[key].loans.push(l);
      map[key].totalDue += l.totalDue;
    });
    return Object.values(map).filter(c => c.loans.length > 1).sort((a, b) => b.totalDue - a.totalDue);
  }, [filteredLoans]);

  const formatDateDisplay = (iso: string) => {
    const d = new Date(iso);
    return calendarMode === "hi" ? toVikramSamvat(d) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleAction = async () => {
    if (!actionLoan || !actionType) return;
    setSubmitting(true);
    try {
      let url = `${API}/${actionLoan.id}`;
      let method = "PATCH";
      let body: Record<string, unknown> = {};

      if (actionType === "collect") {
        url = `${API}/${actionLoan.id}/collect-interest`;
        method = "POST";
        const amt = parseFloat(collectAmount);
        if (!isFinite(amt) || amt <= 0) { toast({ title: "Enter a valid positive amount", variant: "destructive" }); setSubmitting(false); return; }
        body = { amount: amt, paymentType: collectType, notes: collectNotes.trim() || null };
      } else if (actionType === "renew") {
        url = `${API}/${actionLoan.id}/renew`;
        method = "POST";
        const paid = parseFloat(renewInterestPaid);
        body = {
          interestPaid: isFinite(paid) && paid >= 0 ? paid : 0,
          newDueDate: renewNewDueDate ? new Date(renewNewDueDate).toISOString() : null,
          notes: renewNotes.trim() || null,
        };
      } else if (actionType === "redeem") {
        body = { status: "redeemed" };
      } else if (actionType === "forfeit") {
        const saleVal = parseFloat(goldSaleValue);
        if (!isFinite(saleVal) || saleVal < 0) { toast({ title: "Enter a valid gold sale value (0 or more)", variant: "destructive" }); setSubmitting(false); return; }
        body = { status: "forfeited", goldSaleValue: saleVal };
      } else if (actionType === "extend") {
        if (!newDueDate) { toast({ title: "Select a new due date", variant: "destructive" }); setSubmitting(false); return; }
        const nd = new Date(newDueDate);
        if (isNaN(nd.getTime())) { toast({ title: "Invalid due date", variant: "destructive" }); setSubmitting(false); return; }
        body = { status: "extended", newDueDate: nd.toISOString() };
      }

      const r = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");

      if (actionType === "collect") {
        const updatedLoan: Loan = await r.json();
        // Invalidate cache then refetch fresh payment list
        setLoanPayments(prev => { const n = { ...prev }; delete n[actionLoan.id]; return n; });
        const pRes = await fetch(`${API}/${actionLoan.id}/payments`, { headers: { Authorization: `Bearer ${localStorage.getItem("swarndesk_token")}` } });
        if (pRes.ok) {
          const payments: Payment[] = await pRes.json();
          setLoanPayments(prev => ({ ...prev, [actionLoan.id]: payments }));
          if (payments.length > 0) setLastPayment(payments[0]);
        }
        setLoans(prev => prev.map(l => l.id === actionLoan.id ? updatedLoan : l));
        const amt = parseFloat(collectAmount);
        toast({ title: `₹${isFinite(amt) ? amt.toLocaleString("en-IN") : "0"} collected. Print receipt below.` });
      } else if (actionType === "renew") {
        const updatedLoan: Loan = await r.json();
        setLoanPayments(prev => { const n = { ...prev }; delete n[actionLoan.id]; return n; });
        const pRes = await fetch(`${API}/${actionLoan.id}/payments`, { headers: { Authorization: `Bearer ${localStorage.getItem("swarndesk_token")}` } });
        if (pRes.ok) {
          const payments: Payment[] = await pRes.json();
          setLoanPayments(prev => ({ ...prev, [actionLoan.id]: payments }));
          if (payments.length > 0) setLastPayment(payments[0]);
        }
        setLoans(prev => prev.map(l => l.id === actionLoan.id ? updatedLoan : l));
        toast({ title: "Loan renewed — interest clock reset!" });
      } else {
        const msgs: Record<string, string> = {
          redeem: "Loan redeemed successfully!",
          forfeit: "Loan forfeited & loss recorded",
          extend: "Loan extended to new due date",
        };
        toast({ title: msgs[actionType] });
        loadAll();
      }

      setActionLoan(null); setActionType(null);
      setGoldSaleValue(""); setNewDueDate("");
      setCollectAmount(""); setCollectNotes(""); setCollectType("auto");
      setRenewInterestPaid(""); setRenewNewDueDate(""); setRenewNotes("");
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const sendWaReminder = (loan: Loan, type: "due" | "overdue") => {
    const dueText = type === "overdue"
      ? `is OVERDUE by ${Math.abs(loan.daysRemaining)} days`
      : `is due in ${loan.daysRemaining} days`;
    const msg = `Namaskar ${loan.customerName} ji,\n\nYour Girvi loan ${loan.loanNumber} ${dueText}.\n\nPrincipal: ${formatCurrency(loan.currentPrincipal)} | Interest due: ${formatCurrency(loan.outstandingInterest)} | Total due: ${formatCurrency(loan.totalDue)}\n\nKindly visit our store to redeem your ${loan.metalType} (${loan.purity}) at your earliest convenience.\n\n— ${shopName}`;
    window.open(`https://wa.me/91${loan.customerMobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const sendBulkOverdueReminders = () => {
    const overdue = loans.filter(l => l.isOverdue);
    if (overdue.length === 0) { toast({ title: "No overdue loans" }); return; }
    overdue.forEach(loan => sendWaReminder(loan, "overdue"));
    toast({ title: `WhatsApp opened for ${overdue.length} overdue customer${overdue.length !== 1 ? "s" : ""}` });
  };

  // ─── Filter tabs ─────────────────────────────────────────────────────────────

  const FILTER_TABS = [
    { key: "active|all", label: "Active", count: summary?.totalActive },
    { key: "active|overdue", label: "Overdue", count: summary?.overdueCount, urgent: true },
    { key: "active|week", label: "Due This Week", count: summary?.dueSoonCount },
    { key: "extended|all", label: "Extended", count: undefined },
    { key: "redeemed|all", label: "Redeemed", count: undefined },
    { key: "forfeited|all", label: "Forfeited", count: undefined },
    { key: "all|all", label: "All", count: summary?.totalLoans },
  ];

  const activeTabKey = `${statusFilter}|${dueFilter}`;

  const setTab = (key: string) => {
    const [s, d] = key.split("|");
    setStatusFilter(s);
    setDueFilter(d);
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" />
            Girvi — Money Lending
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gold & silver collateral loans with live interest</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(summary?.overdueCount ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={sendBulkOverdueReminders} className="gap-1.5 border-orange-400/40 text-orange-600 hover:bg-orange-50">
              <MessageCircle className="w-3.5 h-3.5" />Remind {summary!.overdueCount} Overdue
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setCalendarMode(c => c === "en" ? "hi" : "en")} className="gap-1.5">
            <Calendar className="w-3.5 h-3.5" />{calendarMode === "en" ? "हिंदी तिथि" : "English Date"}
          </Button>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Recalculate
          </Button>
          <Button size="sm" onClick={() => setShowNewLoan(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />New Girvi
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Active Loans", value: (summary?.totalActive ?? 0).toString(), icon: Banknote, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Lent", value: formatCurrency(summary?.totalLent ?? 0), icon: TrendingDown, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Interest Accrued", value: formatCurrency(summary?.totalInterestAccrued ?? 0), icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
          { label: "Collected", value: formatCurrency(summary?.totalInterestCollected ?? 0), icon: Coins, color: "text-emerald-600", bg: "bg-emerald-500/10" },
          { label: "Overdue", value: (summary?.overdueCount ?? 0).toString(), icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "Total Loss", value: formatCurrency(summary?.totalLoss ?? 0), icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
        ].map(card => (
          <Card key={card.label} className="border-border">
            <CardContent className="p-3">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="text-base font-bold">{card.value}</div>
              <div className="text-xs text-muted-foreground">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weight summary */}
      {((summary?.totalGoldWeight ?? 0) > 0 || (summary?.totalSilverWeight ?? 0) > 0) && (
        <div className="flex gap-3 flex-wrap">
          {(summary?.totalGoldWeight ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              <Scale className="w-3.5 h-3.5" />
              Gold in custody: {summary!.totalGoldWeight.toFixed(3)} g
            </div>
          )}
          {(summary?.totalSilverWeight ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium">
              <Scale className="w-3.5 h-3.5" />
              Silver in custody: {summary!.totalSilverWeight.toFixed(3)} g
            </div>
          )}
        </div>
      )}

      {/* Multi-loan customer alerts */}
      {customerExposure.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              High-Exposure Customers — multiple active loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {customerExposure.map(c => (
                <div key={c.mobile} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-amber-200 text-sm">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.loans.length} loans · Total due: <strong className="text-amber-800">{formatCurrency(c.totalDue)}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter tabs + search */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setTab(tab.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    activeTabKey === tab.key
                      ? tab.urgent ? "bg-orange-500 text-white border-orange-500" : "bg-primary text-primary-foreground border-primary"
                      : tab.urgent && (tab.count ?? 0) > 0 ? "border-orange-300 text-orange-600 hover:bg-orange-50" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ""}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, loan number, mobile, or item..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
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
              {search ? `No loans found for "${search}"` : "No loans in this category."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLoans.map(loan => (
                <LoanRow
                  key={loan.id}
                  loan={loan}
                  expanded={expandedId === loan.id}
                  payments={loanPayments[loan.id]}
                  items={loanItems[loan.id]}
                  calendarMode={calendarMode}
                  formatDateDisplay={formatDateDisplay}
                  shopName={shopName}
                  shopAddress={shopAddress}
                  shopMobile={shopMobile}
                  onExpand={() => handleExpand(loan.id)}
                  onAction={(type) => {
                    setActionLoan(loan);
                    setActionType(type);
                    if (type === "extend") {
                      const d = new Date(loan.dueDate); d.setDate(d.getDate() + 30);
                      setNewDueDate(d.toISOString().split("T")[0]);
                    }
                    if (type === "collect") setCollectAmount(String(Math.round(loan.outstandingInterest)));
                    if (type === "renew") {
                      setRenewInterestPaid(String(Math.round(loan.outstandingInterest)));
                      const d = new Date(); d.setDate(d.getDate() + 90);
                      setRenewNewDueDate(d.toISOString().split("T")[0]);
                    }
                    if (type === "forfeit") setGoldSaleValue(String(Math.round(loan.estimatedValue)));
                  }}
                  onWaReminder={sendWaReminder}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Loan */}
      <NewLoanDialog
        open={showNewLoan}
        onClose={() => setShowNewLoan(false)}
        onCreated={() => { setShowNewLoan(false); loadAll(); }}
        rates={rates}
      />

      {/* Action Dialog */}
      <Dialog open={!!actionLoan} onOpenChange={v => { if (!v) { setActionLoan(null); setActionType(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "collect" && <><Coins className="w-4 h-4 text-emerald-600" />Collect Interest (Byaj Vasuli)</>}
              {actionType === "renew" && <><RotateCcw className="w-4 h-4 text-blue-500" />Renew Loan</>}
              {actionType === "redeem" && <><CheckCircle2 className="w-4 h-4 text-green-600" />Confirm Redemption</>}
              {actionType === "forfeit" && <><XCircle className="w-4 h-4 text-destructive" />Forfeit Gold</>}
              {actionType === "extend" && <><Clock className="w-4 h-4" />Extend Due Date</>}
            </DialogTitle>
          </DialogHeader>
          {actionLoan && (
            <div className="space-y-4">
              {/* Loan summary */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><strong>{actionLoan.customerName}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Loan #</span><span className="font-mono">{actionLoan.loanNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Collateral</span><span>{actionLoan.metalType.toUpperCase()} {actionLoan.purity} · {actionLoan.grossWeight.toFixed(3)}g</span></div>
                {actionLoan.itemDescription && <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span className="text-right max-w-[55%]">{actionLoan.itemDescription}</span></div>}
                <div className="flex justify-between border-t border-border pt-1"><span className="text-muted-foreground">Original loan</span><span>{formatCurrency(actionLoan.loanAmount)}</span></div>
                {actionLoan.principalPaid > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Principal repaid</span><span className="text-emerald-600">−{formatCurrency(actionLoan.principalPaid)}</span></div>}
                <div className="flex justify-between font-medium"><span className="text-muted-foreground">Current principal</span><span>{formatCurrency(actionLoan.currentPrincipal)}</span></div>
                <div className="flex justify-between border-t border-border pt-1"><span className="text-muted-foreground">Interest accrued</span><span>{formatCurrency(actionLoan.accruedInterest)}</span></div>
                {actionLoan.penaltyInterest > 0 && <div className="flex justify-between text-orange-600"><span>Penalty interest</span><span>{formatCurrency(actionLoan.penaltyInterest)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Collected (this cycle)</span><span className="text-emerald-600">−{formatCurrency(actionLoan.collectedSinceReset)}</span></div>
                <div className="flex justify-between font-semibold text-sm"><span>Outstanding interest</span><span className="text-primary">{formatCurrency(actionLoan.outstandingInterest)}</span></div>
                <div className="flex justify-between font-bold text-sm text-primary border-t border-border pt-1"><span>Total due (principal + int.)</span><span>{formatCurrency(actionLoan.totalDue)}</span></div>
                <div className="text-[10px] text-muted-foreground pt-0.5">
                  Rate: {actionLoan.interestRate}% per {actionLoan.interestPeriod} · ≈ {(actionLoan.dailyRate * 100).toFixed(4)}%/day · ≈ {formatCurrency(Math.round(actionLoan.currentPrincipal * actionLoan.dailyRate))}/day
                </div>
              </div>

              {/* Collect payment — smart allocation */}
              {actionType === "collect" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Amount received (₹)</label>
                    <Input type="number" value={collectAmount} onChange={e => setCollectAmount(e.target.value)} placeholder="Any amount, any time" className="h-9" autoFocus />
                  </div>

                  {/* Smart allocation preview */}
                  {collectAmount !== "" && parseFloat(collectAmount) > 0 && collectType === "auto" && (() => {
                    const amt = parseFloat(collectAmount);
                    const outstanding = actionLoan.outstandingInterest;
                    const principal = actionLoan.currentPrincipal;
                    if (amt <= outstanding) {
                      return (
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-0.5">
                          <div className="font-medium text-emerald-800">Interest payment</div>
                          <div className="text-emerald-700">₹{amt.toLocaleString("en-IN")} → reduces outstanding interest</div>
                          <div className="text-emerald-600">After payment: {formatCurrency(outstanding - amt)} interest remaining</div>
                        </div>
                      );
                    } else {
                      const interestPortion = outstanding;
                      const principalPortion = amt - interestPortion;
                      const newPrincipal = principal - principalPortion;
                      const fullySettled = newPrincipal <= 0;
                      return (
                        <div className={`p-2 rounded-lg border text-xs space-y-1 ${fullySettled ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-200"}`}>
                          <div className={`font-medium ${fullySettled ? "text-green-800" : "text-blue-800"}`}>
                            {fullySettled ? "Loan fully settled!" : "Auto-allocation"}
                          </div>
                          {interestPortion > 0 && <div className="text-blue-700">₹{interestPortion.toLocaleString("en-IN")} → settles outstanding interest</div>}
                          <div className={fullySettled ? "text-green-700 font-semibold" : "text-blue-700"}>
                            ₹{principalPortion.toLocaleString("en-IN")} → reduces principal ({formatCurrency(principal)} → {formatCurrency(Math.max(0, newPrincipal))})
                          </div>
                          {!fullySettled && <div className="text-muted-foreground text-[10px]">Interest clock resets on new principal of {formatCurrency(Math.max(0, newPrincipal))}</div>}
                          {fullySettled && <div className="text-green-700 font-medium">Gold can be returned to customer</div>}
                        </div>
                      );
                    }
                  })()}

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Payment mode</label>
                    <Select value={collectType} onValueChange={setCollectType}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-allocate (interest first, then principal)</SelectItem>
                        <SelectItem value="interest">Interest only (Byaj)</SelectItem>
                        <SelectItem value="penalty">Penalty / Overdue charge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Notes (optional)</label>
                    <Input value={collectNotes} onChange={e => setCollectNotes(e.target.value)} placeholder="e.g. Cash paid, hand receipt" className="h-9" />
                  </div>
                  {collectType !== "auto" && (
                    <p className="text-xs text-muted-foreground">Interest-only or penalty payments do not change the principal or reset the clock.</p>
                  )}
                </div>
              )}

              {/* Renew */}
              {actionType === "renew" && (
                <div className="space-y-3">
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                    Renewing resets the interest clock to today. Collect the interest due now, then the loan runs fresh from today.
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Interest collected today (₹)</label>
                    <Input type="number" value={renewInterestPaid} onChange={e => setRenewInterestPaid(e.target.value)} placeholder="0 if nothing collected now" className="h-9" autoFocus />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">New due date</label>
                    <Input type="date" value={renewNewDueDate} onChange={e => setRenewNewDueDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="h-9" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Notes (optional)</label>
                    <Input value={renewNotes} onChange={e => setRenewNotes(e.target.value)} placeholder="e.g. Customer renewed verbally" className="h-9" />
                  </div>
                </div>
              )}

              {/* Redeem */}
              {actionType === "redeem" && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800 space-y-1">
                  <div>Collect <strong>{formatCurrency(actionLoan.totalDue)}</strong> from the customer and return the pledged {actionLoan.metalType} ornament(s).</div>
                  <div className="text-[10px] space-y-0.5">
                    <div>Principal: {formatCurrency(actionLoan.currentPrincipal)}</div>
                    <div>Interest due: {formatCurrency(actionLoan.outstandingInterest)}</div>
                  </div>
                  {actionLoan.itemDescription && <div className="mt-1 font-medium">Items: {actionLoan.itemDescription}</div>}
                </div>
              )}

              {/* Forfeit */}
              {actionType === "forfeit" && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground block">Amount received from selling the gold (₹)</label>
                  <Input type="number" value={goldSaleValue} onChange={e => setGoldSaleValue(e.target.value)} className="h-9" />
                  {goldSaleValue && !isNaN(parseFloat(goldSaleValue)) && (
                    <p className={`text-xs p-2 rounded border ${parseFloat(goldSaleValue) < actionLoan.totalDue ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                      {parseFloat(goldSaleValue) < actionLoan.totalDue
                        ? `⚠ Net loss: ${formatCurrency(actionLoan.totalDue - parseFloat(goldSaleValue))}`
                        : `✓ Net gain: ${formatCurrency(parseFloat(goldSaleValue) - actionLoan.totalDue)}`}
                    </p>
                  )}
                </div>
              )}

              {/* Extend */}
              {actionType === "extend" && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground block">Current due: {formatDateDisplay(actionLoan.dueDate)}</label>
                  <Input type="date" value={newDueDate} min={new Date().toISOString().split("T")[0]} onChange={e => setNewDueDate(e.target.value)} className="h-9" />
                  <p className="text-xs text-muted-foreground">Interest continues from original start date. Consider collecting outstanding interest first.</p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setActionLoan(null); setActionType(null); }}>Cancel</Button>
                <Button
                  size="sm"
                  variant={actionType === "forfeit" ? "destructive" : "default"}
                  className={actionType === "collect" || actionType === "renew" ? "bg-emerald-600 hover:bg-emerald-700" : actionType === "redeem" ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={handleAction}
                  disabled={submitting}
                >
                  {submitting ? "Processing..." :
                   actionType === "collect" ? `Collect ₹${parseFloat(collectAmount || "0").toLocaleString("en-IN")}` :
                   actionType === "renew" ? "Renew Loan" :
                   actionType === "redeem" ? "Confirm Redemption" :
                   actionType === "forfeit" ? "Forfeit & Record" :
                   "Extend Due Date"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print receipt after collect/renew */}
      {lastPayment && actionLoan === null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Payment recorded
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1"
            onClick={() => {
              const loan = loans.find(l => l.id === lastPayment.loanId);
              if (loan) {
                printInterestReceipt(lastPayment, loan, shopName, shopAddress, shopMobile);
              } else {
                toast({ title: "Loan data not available for printing" });
              }
              setLastPayment(null);
            }}
          >
            <Receipt className="w-3 h-3" />Print Receipt
          </Button>
          <button onClick={() => setLastPayment(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
    </div>
  );
}

// ─── Loan row component ───────────────────────────────────────────────────────

function LoanRow({
  loan, expanded, payments, items, calendarMode, formatDateDisplay,
  shopName, shopAddress, shopMobile,
  onExpand, onAction, onWaReminder,
}: {
  loan: Loan;
  expanded: boolean;
  payments?: Payment[];
  items?: LoanItem[];
  calendarMode: "en" | "hi";
  formatDateDisplay: (iso: string) => string;
  shopName: string;
  shopAddress: string;
  shopMobile: string;
  onExpand: () => void;
  onAction: (type: "redeem" | "forfeit" | "extend" | "collect" | "renew") => void;
  onWaReminder: (loan: Loan, type: "due" | "overdue") => void;
}) {
  const isActive = loan.status === "active" || loan.status === "extended";
  const paymentTypeLabel: Record<string, string> = { interest: "Byaj", renewal: "Renewal", penalty: "Penalty", principal: "Principal" };

  return (
    <div className={`px-3 md:px-4 py-3 ${loan.isOverdue ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
      {/* Summary row — click to expand */}
      <div className="flex items-center justify-between gap-2 md:gap-4 cursor-pointer" onClick={onExpand}>
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
            {loan.isOverdue && <Flame className="w-3.5 h-3.5 text-orange-500" />}
            {loan.estimatedValue > 0 && isActive && (
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
            {loan.interestRate}%/{loan.interestPeriod}{loan.penaltyRate > 0 ? `+${loan.penaltyRate}%OD` : ""}
            {loan.principalPaid > 0 && <span className="text-emerald-600"> · bal {formatCurrency(loan.currentPrincipal)}</span>}
            {loan.itemDescription && <span className="hidden md:inline"> · {loan.itemDescription}</span>}
            <span className="hidden sm:inline"> · Due: {formatDateDisplay(loan.dueDate)}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-primary">{formatCurrency(loan.totalDue)}</div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            {formatCurrency(loan.loanAmount)} + {formatCurrency(loan.outstandingInterest)} int.
          </div>
          {loan.totalInterestCollected > 0 && (
            <div className="text-[10px] text-emerald-600">✓ {formatCurrency(loan.totalInterestCollected)} coll.</div>
          )}
        </div>
        <div className="text-muted-foreground flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Detail grid */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground mb-1 font-medium">Collateral</div>
              <div className="font-medium">{loan.metalType.toUpperCase()} {loan.purity}</div>
              <div>Gross: {loan.grossWeight.toFixed(3)}g</div>
              <div>Net: {loan.netWeight.toFixed(3)}g</div>
              <div>Est. Value: {formatCurrency(loan.estimatedValue)}</div>
              {loan.itemDescription && <div className="mt-1 text-muted-foreground italic">{loan.itemDescription}</div>}
              {items && items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {items.map(it => (
                    <div key={it.id} className="text-[10px] text-muted-foreground">
                      {it.quantity}× {it.itemType} ({it.metalType === "silver" ? "Ag" : "Au"} {it.purity}) · {it.grossWeight.toFixed(3)}g · {formatCurrency(it.estimatedValue)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-muted-foreground mb-1 font-medium">Loan Terms</div>
              <div className="font-medium">{formatCurrency(loan.loanAmount)} original</div>
              {loan.principalPaid > 0 && <div className="text-emerald-600">−{formatCurrency(loan.principalPaid)} repaid</div>}
              {loan.principalPaid > 0 && <div className="font-semibold text-primary">{formatCurrency(loan.currentPrincipal)} current principal</div>}
              <div className="mt-1">{loan.interestRate}%/{loan.interestPeriod}{loan.penaltyRate > 0 ? ` +${loan.penaltyRate}% OD` : ""}</div>
              <div className="text-[10px] text-muted-foreground">{(loan.dailyRate * 100).toFixed(4)}%/day · {formatCurrency(Math.round(loan.currentPrincipal * loan.dailyRate))}/day</div>
              <div className="mt-1">Start: {formatDateDisplay(loan.startDate)}</div>
              <div>Due: {formatDateDisplay(loan.dueDate)}</div>
              <div className="mt-1 text-[10px]">KYC: {loan.kycDocType ? loan.kycDocType.replace(/_/g, " ").toUpperCase() : "—"} {loan.kycDocNumber ?? ""}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1 font-medium">Interest Breakdown</div>
              <div>Normal int.: {formatCurrency(loan.normalInterest)}</div>
              {loan.penaltyInterest > 0 && <div className="text-orange-600">Penalty int.: {formatCurrency(loan.penaltyInterest)}</div>}
              <div>Total accrued: {formatCurrency(loan.accruedInterest)}</div>
              <div className="text-emerald-600">Collected (cycle): −{formatCurrency(loan.collectedSinceReset)}</div>
              <div className={`font-semibold mt-1 ${loan.isOverdue ? "text-destructive" : "text-primary"}`}>
                Outstanding: {formatCurrency(loan.outstandingInterest)}
              </div>
              <div className="text-muted-foreground">
                {loan.daysRemaining >= 0
                  ? `${loan.daysRemaining} days remaining`
                  : <span className="text-destructive font-medium">{Math.abs(loan.daysRemaining)} days OVERDUE</span>}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1 font-medium">Days Elapsed</div>
              <div className="font-bold text-lg">{calcDaysElapsed(loan.startDate)}</div>
              <div className="text-muted-foreground">days from start</div>
              <div className="mt-2 font-bold text-primary">{formatCurrency(loan.totalDue)}</div>
              <div className="text-muted-foreground text-[10px]">Total due today</div>
            </div>
          </div>

          {/* Action buttons for active loans */}
          {isActive && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onAction("collect")}>
                <Coins className="w-3.5 h-3.5" />Collect Interest
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-blue-400/50 text-blue-700 hover:bg-blue-50" onClick={() => onAction("renew")}>
                <RotateCcw className="w-3.5 h-3.5" />Renew Loan
              </Button>
              <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => onAction("redeem")}>
                <CheckCircle2 className="w-3.5 h-3.5" />Redeem
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onAction("extend")}>
                <Clock className="w-3.5 h-3.5" />Extend Due Date
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => onAction("forfeit")}>
                <XCircle className="w-3.5 h-3.5" />Forfeit Gold
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openGirviVoucher(loan, shopName, shopAddress, shopMobile, items)}>
                <PrinterIcon className="w-3.5 h-3.5" />Voucher
              </Button>
              <button
                onClick={() => onWaReminder(loan, loan.isOverdue ? "overdue" : "due")}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-green-500/40 text-green-600 hover:bg-green-50 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {loan.isOverdue ? "Overdue Reminder" : "Due Reminder"}
              </button>
            </div>
          )}

          {/* Print voucher for closed loans */}
          {!isActive && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openGirviVoucher(loan, shopName, shopAddress, shopMobile, items)}>
                <PrinterIcon className="w-3.5 h-3.5" />Print Voucher
              </Button>
            </div>
          )}

          {/* Forfeited / redeemed summary */}
          {loan.status === "forfeited" && loan.lossAmount !== null && (
            <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <TrendingDown className="w-4 h-4 text-destructive flex-shrink-0" />
              Sold for {formatCurrency(loan.goldSaleValue ?? 0)} · Due was {formatCurrency(loan.loanAmount + loan.accruedInterest)} ·{" "}
              <strong className="text-destructive">Loss: {formatCurrency(loan.lossAmount)}</strong>
            </div>
          )}
          {loan.status === "redeemed" && (
            <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              Redeemed on {loan.redeemedDate ? formatDateDisplay(loan.redeemedDate) : "—"} · Collected {formatCurrency(loan.redeemedAmount ?? 0)}
            </div>
          )}

          {/* Payment history */}
          {payments && payments.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Payment History ({payments.length} record{payments.length !== 1 ? "s" : ""} · Interest collected: {formatCurrency(loan.totalInterestCollected)}{loan.principalPaid > 0 ? ` · Principal repaid: ${formatCurrency(loan.principalPaid)}` : ""})
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-xs border-b border-border/50 last:border-0 hover:bg-muted/10">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        p.paymentType === "renewal" ? "bg-blue-100 text-blue-700" :
                        p.paymentType === "penalty" ? "bg-orange-100 text-orange-700" :
                        p.paymentType === "principal" ? "bg-purple-100 text-purple-700" :
                        "bg-emerald-100 text-emerald-700"
                      }`}>{paymentTypeLabel[p.paymentType] ?? p.paymentType}</span>
                      <span className="text-muted-foreground">{new Date(p.paymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      {p.notes && <span className="text-muted-foreground italic hidden sm:inline">— {p.notes}</span>}
                    </div>
                    <div className="font-semibold text-emerald-600">{formatCurrency(p.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {payments && payments.length === 0 && isActive && (
            <p className="text-xs text-muted-foreground">No interest collected yet on this loan.</p>
          )}

          {loan.notes && (
            <p className="text-xs text-muted-foreground border-t border-border pt-2 italic">Note: {loan.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Loan Dialog ──────────────────────────────────────────────────────────

type ItemRow = {
  key: string;
  itemType: string;
  quantity: number;
  metalType: string;
  purity: string;
  grossWeight: string;
  netWeight: string;
  estimatedValue: string;
};

const ITEM_TYPES = ["Necklace","Bangle","Ring","Chain","Earring","Pendant","Bracelet","Mangalsutra","Payal","Tikka","Nose Ring","Other"];

function makeItem(): ItemRow {
  return { key: Math.random().toString(36).slice(2), itemType: "Necklace", quantity: 1, metalType: "gold", purity: "22K", grossWeight: "", netWeight: "", estimatedValue: "" };
}

function getItemRate(metalType: string, purity: string, rates?: { gold22k: number; gold24k: number; gold18k: number; silver: number }) {
  if (metalType === "silver") return rates?.silver ?? 95;
  const map: Record<string, number> = {
    "24K": rates?.gold24k ?? 7950,
    "22K": rates?.gold22k ?? 7250,
    "18K": rates?.gold18k ?? 5940,
    "14K": Math.round((rates?.gold18k ?? 5940) * 14 / 18),
    "925": rates?.silver ?? 95,
  };
  return map[purity] ?? rates?.gold22k ?? 7250;
}

function NewLoanDialog({ open, onClose, onCreated, rates }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  rates?: { gold22k: number; gold24k: number; gold18k: number; silver: number };
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    customerName: "", customerMobile: "",
    kycDocType: "aadhaar", kycDocNumber: "",
    loanAmount: "", interestRate: "2", penaltyRate: "1", interestPeriod: "monthly",
    dueDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    notes: "",
  });
  const [items, setItems] = useState<ItemRow[]>([makeItem()]);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const updateItem = useCallback((key: string, field: keyof ItemRow, value: string | number) => {
    setItems(prev => prev.map(it => {
      if (it.key !== key) return it;
      const updated = { ...it, [field]: value };
      if (field === "grossWeight" || field === "netWeight" || field === "metalType" || field === "purity") {
        const wt = parseFloat(String(field === "netWeight" ? value : (updated.netWeight || (field === "grossWeight" ? value : updated.grossWeight))) || "0");
        if (wt > 0) {
          const mt = field === "metalType" ? String(value) : updated.metalType;
          const pu = field === "purity" ? String(value) : updated.purity;
          updated.estimatedValue = String(Math.round(wt * getItemRate(mt, pu, rates)));
        }
      }
      return updated;
    }));
  }, [rates]);

  const addItem = () => setItems(prev => [...prev, makeItem()]);
  const removeItem = (key: string) => setItems(prev => prev.length > 1 ? prev.filter(it => it.key !== key) : prev);

  const totalGross = items.reduce((s, it) => s + (parseFloat(it.grossWeight) || 0) * it.quantity, 0);
  const totalNet = items.reduce((s, it) => s + (parseFloat(it.netWeight || it.grossWeight) || 0) * it.quantity, 0);
  const totalEst = items.reduce((s, it) => s + (parseFloat(it.estimatedValue) || 0) * it.quantity, 0);

  const loanAmt = parseFloat(form.loanAmount || "0");
  const ltv = totalEst > 0 ? (loanAmt / totalEst) * 100 : 0;

  const handleSubmit = async () => {
    if (!form.customerName.trim()) { toast({ title: "Customer name is required", variant: "destructive" }); return; }
    if (!form.customerMobile.trim()) { toast({ title: "Customer mobile is required", variant: "destructive" }); return; }
    for (const it of items) {
      const gw = parseFloat(it.grossWeight);
      if (!isFinite(gw) || gw <= 0) { toast({ title: `Enter gross weight for ${it.itemType}`, variant: "destructive" }); return; }
    }
    const la = parseFloat(form.loanAmount);
    if (!isFinite(la) || la <= 0) { toast({ title: "Loan amount must be a positive number", variant: "destructive" }); return; }
    const ir = parseFloat(form.interestRate);
    if (!isFinite(ir) || ir < 0 || ir > 100) { toast({ title: "Interest rate must be between 0 and 100", variant: "destructive" }); return; }
    if (!form.dueDate) { toast({ title: "Due date is required", variant: "destructive" }); return; }
    const dueD = new Date(form.dueDate);
    if (isNaN(dueD.getTime())) { toast({ title: "Invalid due date", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const r = await fetch(API, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({
          customerName: form.customerName,
          customerMobile: form.customerMobile,
          kycDocType: form.kycDocType || null,
          kycDocNumber: form.kycDocNumber.trim() || null,
          loanAmount: la,
          interestRate: ir,
          penaltyRate: parseFloat(form.penaltyRate) || 0,
          interestPeriod: form.interestPeriod,
          dueDate: dueD.toISOString(),
          notes: form.notes.trim() || null,
          items: items.map(it => ({
            itemType: it.itemType,
            quantity: it.quantity,
            metalType: it.metalType,
            purity: it.purity,
            grossWeight: parseFloat(it.grossWeight),
            netWeight: parseFloat(it.netWeight || it.grossWeight) || parseFloat(it.grossWeight),
            estimatedValue: parseFloat(it.estimatedValue) || 0,
          })),
        }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({ error: "Failed" }));
        throw new Error(errData.error ?? "Failed");
      }
      toast({ title: "Girvi loan created!" });
      onCreated();
      setForm({ customerName: "", customerMobile: "", kycDocType: "aadhaar", kycDocNumber: "", loanAmount: "", interestRate: "2", penaltyRate: "1", interestPeriod: "monthly", dueDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0], notes: "" });
      setItems([makeItem()]);
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to create loan", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Girvi Loan</DialogTitle></DialogHeader>
        <div className="space-y-4">

          {/* Customer */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer & KYC</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Customer Name *</label><input className={inp} value={form.customerName} onChange={e => set("customerName", e.target.value)} placeholder="Full name" /></div>
              <div><label className={lbl}>Mobile *</label><input className={inp} value={form.customerMobile} onChange={e => set("customerMobile", e.target.value)} placeholder="+91 XXXXX XXXXX" /></div>
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
              <div><label className={lbl}>Document Number</label><input className={inp} value={form.kycDocNumber} onChange={e => set("kycDocNumber", e.target.value)} placeholder="Document number" /></div>
            </div>
          </div>

          {/* Pledged Items */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pledged Items</div>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addItem}>
                <Plus className="w-3 h-3" />Add Item
              </Button>
            </div>

            {items.map((it, idx) => (
              <div key={it.key} className="p-3 rounded-lg bg-background border border-border space-y-2 relative">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove item"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <div className="text-xs font-medium text-muted-foreground">Item {idx + 1}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-1">
                    <label className={lbl}>Type</label>
                    <Select value={it.itemType} onValueChange={v => updateItem(it.key, "itemType", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={lbl}>Qty</label>
                    <input className={inp} type="number" min="1" value={it.quantity}
                      onChange={e => updateItem(it.key, "quantity", Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <div>
                    <label className={lbl}>Metal</label>
                    <Select value={it.metalType} onValueChange={v => updateItem(it.key, "metalType", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={lbl}>Purity</label>
                    <Select value={it.purity} onValueChange={v => updateItem(it.key, "purity", v)}>
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
                    <label className={lbl}>Gross Wt (g/pc) *</label>
                    <input className={inp} type="number" step="0.001" value={it.grossWeight}
                      onChange={e => updateItem(it.key, "grossWeight", e.target.value)} placeholder="0.000" />
                  </div>
                  <div>
                    <label className={lbl}>Net Wt (g/pc)</label>
                    <input className={inp} type="number" step="0.001" value={it.netWeight}
                      onChange={e => updateItem(it.key, "netWeight", e.target.value)} placeholder="Same as gross" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Est. Value (₹) <span className="text-muted-foreground/60">auto · editable</span></label>
                    <input className={inp} type="number" value={it.estimatedValue}
                      onChange={e => updateItem(it.key, "estimatedValue", e.target.value)} placeholder="0" />
                  </div>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="flex flex-wrap gap-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
              <div><span className="text-muted-foreground">Total Gross: </span><strong>{totalGross.toFixed(3)} g</strong></div>
              <div><span className="text-muted-foreground">Total Net: </span><strong>{totalNet.toFixed(3)} g</strong></div>
              <div><span className="text-muted-foreground">Total Est. Value: </span><strong className="text-primary">{formatCurrency(totalEst)}</strong></div>
            </div>
          </div>

          {/* Loan terms */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Loan Terms</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Loan Amount (₹) *</label><input className={inp} type="number" value={form.loanAmount} onChange={e => set("loanAmount", e.target.value)} /></div>
              <div>
                <label className={lbl}>Interest Period</label>
                <Select value={form.interestPeriod} onValueChange={v => set("interestPeriod", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Per Day</SelectItem>
                    <SelectItem value="weekly">Per Week</SelectItem>
                    <SelectItem value="monthly">Per Month</SelectItem>
                    <SelectItem value="yearly">Per Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className={lbl}>Interest Rate (%) per period</label><input className={inp} type="number" step="0.1" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} /></div>
              <div>
                <label className={lbl}>Penalty Rate (%) <span className="text-muted-foreground/60">extra if overdue</span></label>
                <input className={inp} type="number" step="0.1" value={form.penaltyRate} onChange={e => set("penaltyRate", e.target.value)} placeholder="e.g. 1" />
              </div>
              <div><label className={lbl}>Due Date *</label><input className={inp} type="date" value={form.dueDate} min={new Date().toISOString().split("T")[0]} onChange={e => set("dueDate", e.target.value)} /></div>
              <div><label className={lbl}>Notes</label><input className={inp} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Remarks, conditions, etc." /></div>
            </div>
          </div>

          {/* LTV warning */}
          {loanAmt > 0 && totalEst > 0 && (
            <div className={`p-3 rounded-xl border text-xs ${ltv > 80 ? "bg-red-50 border-red-200 text-red-700" : ltv > 60 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-green-50 border-green-200 text-green-700"}`}>
              <strong>LTV: {ltv.toFixed(0)}%</strong> — {ltv > 80 ? "⚠ High risk" : ltv > 60 ? "Moderate risk" : "Good — comfortable margin"}
            </div>
          )}

          {/* Interest preview */}
          {form.loanAmount && form.interestRate && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
              <div className="font-semibold text-primary mb-1">Interest Preview</div>
              {(() => {
                const principal = parseFloat(form.loanAmount || "0");
                const rate = parseFloat(form.interestRate || "0");
                const pd = form.interestPeriod === "daily" ? 1 : form.interestPeriod === "weekly" ? 7 : form.interestPeriod === "yearly" ? 365 : 30;
                const dailyRate = (rate / 100) / pd;
                return (
                  <>
                    <div className="text-muted-foreground mb-1">
                      {rate}% per {form.interestPeriod} = <strong>{(dailyRate * 100).toFixed(4)}%/day</strong> = {formatCurrency(Math.round(principal * dailyRate))}/day
                    </div>
                    {[{ label: "1 month (30d)", days: 30 }, { label: "3 months (90d)", days: 90 }, { label: "6 months (180d)", days: 180 }].map(({ label, days }) => {
                      const interest = Math.round(principal * (rate / 100) * (days / pd));
                      return (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span>Interest: {formatCurrency(interest)} · Total: {formatCurrency(principal + interest)}</span>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>{submitting ? "Creating..." : "Create Girvi Loan"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
