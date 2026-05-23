import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Banknote, AlertTriangle, CheckCircle2, Clock, TrendingDown,
  Plus, RefreshCw, XCircle, ChevronDown, ChevronUp, Eye, Calendar
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

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(url);
      setData(await r.json());
    } finally { setLoading(false); }
  };
  return { data, loading, load };
}

export default function Girvi() {
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [calendarMode, setCalendarMode] = useState<"en" | "hi">("en");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [actionLoan, setActionLoan] = useState<Loan | null>(null);
  const [actionType, setActionType] = useState<"redeem" | "forfeit" | null>(null);
  const [goldSaleValue, setGoldSaleValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    const [loansRes, sumRes] = await Promise.all([
      fetch(`${API}${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
      fetch(`${API}/stats/summary`),
    ]);
    setLoans(await loansRes.json());
    setSummary(await sumRes.json());
    setLoaded(true);
  };

  if (!loaded) { loadAll(); }

  const formatDateDisplay = (iso: string) => {
    const d = new Date(iso);
    return calendarMode === "hi" ? toVikramSamvat(d) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const handleAction = async () => {
    if (!actionLoan || !actionType) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { status: actionType === "redeem" ? "redeemed" : "forfeited" };
      if (actionType === "forfeit" && goldSaleValue) body.goldSaleValue = parseFloat(goldSaleValue);
      const r = await fetch(`${API}/${actionLoan.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast({ title: actionType === "redeem" ? "Loan redeemed!" : "Loan forfeited & loss recorded" });
      setActionLoan(null);
      setActionType(null);
      setGoldSaleValue("");
      loadAll();
    } catch {
      toast({ title: "Failed to update loan", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const filtered = statusFilter === "all" ? loans : loans.filter(l => l.status === statusFilter);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" />
            Girvi — Money Lending
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gold collateral loans with auto interest recalculation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCalendarMode(c => c === "en" ? "hi" : "en")} className="gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {calendarMode === "en" ? "हिंदी तिथि" : "English Date"}
          </Button>
          <Button variant="outline" size="sm" onClick={loadAll} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Recalculate All
          </Button>
          <Button size="sm" onClick={() => setShowNewLoan(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Girvi
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: "Active Loans", value: (summary?.totalActive ?? 0).toString(), icon: Banknote, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Lent", value: formatCurrency(summary?.totalLent ?? 0), icon: TrendingDown, color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "Interest Accrued", value: formatCurrency(summary?.totalInterestAccrued ?? 0), icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
          { label: "Overdue", value: (summary?.overdueCount ?? 0).toString(), icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-400/10" },
          { label: "Total Loss", value: formatCurrency(summary?.totalLoss ?? 0), icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
        ].map(card => (
          <Card key={card.label} className="border-border">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="text-lg font-bold">{card.value}</div>
              <div className="text-xs text-muted-foreground">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + list */}
      <Card className="border-border">
        <CardHeader className="pb-3 flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base font-semibold">Girvi Vouchers</CardTitle>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setLoaded(false); }}>
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
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No girvi vouchers yet. Click "New Girvi" to create the first loan.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(loan => (
                <div key={loan.id} className="px-4 py-3">
                  <div
                    className="flex items-center justify-between gap-4 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === loan.id ? null : loan.id)}
                  >
                    {/* Left: customer + loan # */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{loan.customerName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{loan.loanNumber}</span>
                        <Badge
                          variant={loan.status === "active" ? (loan.isOverdue ? "destructive" : "default") : loan.status === "redeemed" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {loan.isOverdue ? "OVERDUE" : loan.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {loan.metalType.toUpperCase()} {loan.purity} • {loan.grossWeight.toFixed(3)}g •{" "}
                        {loan.interestRate}% {loan.interestPeriod} • Start: {formatDateDisplay(loan.startDate)}
                      </div>
                    </div>

                    {/* Right: amounts */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-primary">{formatCurrency(loan.totalDue)}</div>
                      <div className="text-xs text-muted-foreground">
                        Principal {formatCurrency(loan.loanAmount)} + {formatCurrency(loan.accruedInterest)} int
                      </div>
                    </div>

                    <div className="text-muted-foreground">
                      {expandedId === loan.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === loan.id && (
                    <div className="mt-4 p-4 rounded-xl bg-muted/20 border border-border space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground mb-1">Gold Details</div>
                          <div className="font-medium">{loan.metalType.toUpperCase()} {loan.purity}</div>
                          <div>Gross: {loan.grossWeight.toFixed(3)}g | Net: {loan.netWeight.toFixed(3)}g</div>
                          <div>Est. Value: {formatCurrency(loan.estimatedValue)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Loan Terms</div>
                          <div className="font-medium">{formatCurrency(loan.loanAmount)} principal</div>
                          <div>{loan.interestRate}% per {loan.interestPeriod}</div>
                          <div>Due: {formatDateDisplay(loan.dueDate)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Interest (Auto)</div>
                          <div className="font-medium text-green-400">{formatCurrency(loan.accruedInterest)}</div>
                          <div>{calcDaysElapsed(loan.startDate)} days elapsed</div>
                          <div className={loan.isOverdue ? "text-destructive font-medium" : ""}>
                            {loan.daysRemaining >= 0 ? `${loan.daysRemaining} days left` : `${Math.abs(loan.daysRemaining)} days overdue`}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">KYC</div>
                          <div className="font-medium">{loan.kycDocType ? loan.kycDocType.toUpperCase() : "—"}</div>
                          <div>{loan.kycDocNumber ?? "Not recorded"}</div>
                          <div className="text-muted-foreground">{loan.customerMobile}</div>
                        </div>
                      </div>

                      {loan.status === "active" && (
                        <div className="flex gap-2 flex-wrap pt-1">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-green-600 hover:bg-green-700"
                            onClick={() => { setActionLoan(loan); setActionType("redeem"); }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Redeem ({formatCurrency(loan.totalDue)})
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5"
                            onClick={() => { setActionLoan(loan); setActionType("forfeit"); setGoldSaleValue(loan.estimatedValue.toString()); }}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Forfeit Gold
                          </Button>
                        </div>
                      )}

                      {loan.status === "forfeited" && loan.lossAmount !== null && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                          <TrendingDown className="w-4 h-4 text-destructive flex-shrink-0" />
                          <span>Gold sold for {formatCurrency(loan.goldSaleValue ?? 0)} • Total due was {formatCurrency((loan.loanAmount ?? 0) + (loan.accruedInterest ?? 0))} • <strong className="text-destructive">Loss: {formatCurrency(loan.lossAmount)}</strong></span>
                        </div>
                      )}

                      {loan.status === "redeemed" && (
                        <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span>Redeemed on {loan.redeemedDate ? formatDateDisplay(loan.redeemedDate) : "—"} • Collected {formatCurrency(loan.redeemedAmount ?? 0)}</span>
                        </div>
                      )}

                      {loan.notes && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2">{loan.notes}</p>
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

      {/* Action Dialog (Redeem / Forfeit) */}
      <Dialog open={!!actionLoan} onOpenChange={() => { setActionLoan(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === "redeem" ? "Redeem Girvi Loan" : "Forfeit Gold (Record Loss)"}</DialogTitle>
          </DialogHeader>
          {actionLoan && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm space-y-1">
                <div><span className="text-muted-foreground">Customer:</span> <strong>{actionLoan.customerName}</strong></div>
                <div><span className="text-muted-foreground">Loan #:</span> {actionLoan.loanNumber}</div>
                <div><span className="text-muted-foreground">Principal:</span> {formatCurrency(actionLoan.loanAmount)}</div>
                <div><span className="text-muted-foreground">Interest Accrued:</span> {formatCurrency(actionLoan.accruedInterest)}</div>
                <div className="font-semibold text-primary">Total Due: {formatCurrency(actionLoan.totalDue)}</div>
              </div>

              {actionType === "forfeit" && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Gold sale value (₹)</label>
                  <input
                    type="number"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                    value={goldSaleValue}
                    onChange={e => setGoldSaleValue(e.target.value)}
                    placeholder="Enter amount received from gold sale"
                  />
                  {goldSaleValue && (
                    <p className={`text-xs mt-1 ${parseFloat(goldSaleValue) < actionLoan.totalDue ? "text-destructive" : "text-green-400"}`}>
                      {parseFloat(goldSaleValue) < actionLoan.totalDue
                        ? `Loss: ${formatCurrency(actionLoan.totalDue - parseFloat(goldSaleValue))}`
                        : `Gain: ${formatCurrency(parseFloat(goldSaleValue) - actionLoan.totalDue)}`}
                    </p>
                  )}
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
                  {submitting ? "Processing..." : actionType === "redeem" ? `Confirm Redemption` : "Forfeit & Record Loss"}
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

  const handleSubmit = async () => {
    if (!form.customerName || !form.customerMobile || !form.grossWeight || !form.loanAmount) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
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
  const label = "text-xs text-muted-foreground block mb-1";

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Customer Name *</label>
                <input className={inp} value={form.customerName} onChange={e => set("customerName", e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className={label}>Mobile *</label>
                <input className={inp} value={form.customerMobile} onChange={e => set("customerMobile", e.target.value)} placeholder="+91 XXXXX XXXXX" />
              </div>
              <div>
                <label className={label}>KYC Document Type</label>
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
                <label className={label}>Document Number</label>
                <input className={inp} value={form.kycDocNumber} onChange={e => set("kycDocNumber", e.target.value)} placeholder="Document number" />
              </div>
            </div>
          </div>

          {/* Gold details */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gold / Silver Collateral</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Metal Type</label>
                <Select value={form.metalType} onValueChange={v => set("metalType", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={label}>Purity</label>
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
                <label className={label}>Gross Weight (g) *</label>
                <input className={inp} type="number" step="0.001" value={form.grossWeight} onChange={e => set("grossWeight", e.target.value)} placeholder="0.000" />
              </div>
              <div>
                <label className={label}>Net Weight (g)</label>
                <input className={inp} type="number" step="0.001" value={form.netWeight} onChange={e => set("netWeight", e.target.value)} placeholder="After stone deduction" />
              </div>
              <div className="col-span-2">
                <label className={label}>Estimated Gold Value (₹)</label>
                <input className={inp} type="number" value={form.estimatedValue} onChange={e => set("estimatedValue", e.target.value)} placeholder="Current market value of gold" />
              </div>
            </div>
          </div>

          {/* Loan terms */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Loan Terms</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Loan Amount (₹) *</label>
                <input className={inp} type="number" value={form.loanAmount} onChange={e => set("loanAmount", e.target.value)} placeholder="Principal amount" />
              </div>
              <div>
                <label className={label}>Interest Rate (%)</label>
                <input className={inp} type="number" step="0.1" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} placeholder="e.g. 2" />
              </div>
              <div>
                <label className={label}>Interest Period</label>
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
                <label className={label}>Due Date *</label>
                <input className={inp} type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={label}>Notes</label>
                <input className={inp} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optional notes about the item" />
              </div>
            </div>
          </div>

          {/* Preview */}
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
                    <span className="font-medium">Total due: {formatCurrency(parseFloat(form.loanAmount || "0") + interest)}</span>
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
