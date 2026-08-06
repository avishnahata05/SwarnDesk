import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, MessageCircle, XCircle, Clock, Check } from "lucide-react";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";

const UPI_VPA = "akshatnahata05@ibl";
const WHATSAPP_SUPPORT_URL = "https://wa.me/919424575918?text=Hello+SwarnDesk+Support";

interface MyPaymentRequest {
  id: number;
  status: string;
  notes: string | null;
  createdAt: string;
  planId?: PlanId | null;
}

export default function PaymentPage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [utrNumber, setUtrNumber] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [latestRequest, setLatestRequest] = useState<MyPaymentRequest | null>(null);
  const plan = PLANS[selectedPlan];

  useEffect(() => {
    const token = localStorage.getItem("swarndesk_token");
    if (!token) return;
    fetch("/api/auth/payment-requests/mine", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : []))
      .then((rows: MyPaymentRequest[]) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        setLatestRequest(rows[0]);
        // Pre-select whatever plan they last tried to pay for (e.g. a rejected
        // request being corrected and resubmitted) instead of resetting to Monthly.
        if (rows[0].planId && rows[0].planId in PLANS) setSelectedPlan(rows[0].planId);
      })
      .catch(() => {});
  }, []);

  const handleBack = () => {
    logout();
    navigate("/login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      setError("Please enter your UTR / transaction reference number");
      return;
    }
    if (!user) {
      setError("You must be logged in");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const token = localStorage.getItem("swarndesk_token");
      const res = await fetch("/api/auth/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ utrNumber: utrNumber.trim(), planId: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="text-5xl">🕐</div>
            <h2 className="text-xl font-bold text-foreground">Payment Submitted!</h2>
            <p className="text-muted-foreground">
              Your {plan.label} plan (₹{plan.amount.toLocaleString("en-IN")}) payment reference has been received. Our team will verify and activate your subscription within <strong>24 hours</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              You'll receive confirmation once your account is activated.
            </p>
            <Button variant="outline" onClick={handleBack} className="mt-4">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-sidebar flex items-center justify-center shadow-md overflow-hidden">
              <img src="/logo.png" alt="SwarnDesk" className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">SwarnDesk</h1>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Activate Subscription</CardTitle>
              <Badge variant="destructive">Trial Expired</Badge>
            </div>
            <CardDescription>
              {user ? `Hi ${user.name}, your 7-day free trial has ended.` : "Your 7-day free trial has ended."} Please pay to continue using SwarnDesk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Latest payment request status */}
            {latestRequest?.status === "rejected" && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <XCircle className="w-4 h-4" />
                  Your last payment request was rejected
                </div>
                <p className="text-xs text-destructive/90">
                  {latestRequest.notes || "No reason was provided."} Please double-check your UTR number and submit again, or contact support below.
                </p>
              </div>
            )}
            {latestRequest?.status === "pending" && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-center gap-1.5 text-sm text-amber-800">
                <Clock className="w-4 h-4" />
                You already have a payment reference under review — verification usually completes within 24 hours.
              </div>
            )}

            {/* Price options — click one to select it; the UPI amount below updates to match */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Choose a plan</div>
              {PLAN_ORDER.map(id => {
                const opt = PLANS[id];
                const selected = selectedPlan === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedPlan(id)}
                    aria-pressed={selected}
                    className={`w-full text-left rounded-xl border p-3 flex items-center justify-between transition-colors ${selected ? "bg-amber-50 border-amber-400 ring-1 ring-amber-400" : "bg-muted/30 border-border hover:border-amber-300"}`}
                  >
                    <span className={`flex items-center gap-2 text-sm font-medium ${selected ? "text-amber-800" : "text-foreground"}`}>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${selected ? "bg-amber-500 border-amber-500" : "border-muted-foreground/40"}`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </span>
                      {opt.label}
                    </span>
                    <div className="text-right">
                      <span className={`font-bold ${selected ? "text-amber-800" : "text-foreground"}`}>₹{opt.amount.toLocaleString("en-IN")}</span>
                      <span className="text-xs text-muted-foreground ml-1">{opt.periodLabel}{opt.savingLabel ? ` · ${opt.savingLabel}` : ""}</span>
                    </div>
                  </button>
                );
              })}
              <a
                href={WHATSAPP_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-green-700 hover:text-green-800 underline"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Contact WhatsApp Support
              </a>
            </div>

            {/* UPI Payment Details — amount tracks whichever plan is selected above */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="text-sm font-semibold text-foreground">Pay via UPI</div>
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                <span className="text-xs text-muted-foreground">UPI ID / VPA</span>
                <span className="font-mono font-semibold text-foreground text-sm">{UPI_VPA}</span>
              </div>
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                <span className="text-xs text-muted-foreground">Amount ({plan.label})</span>
                <span className="font-semibold text-foreground">₹{plan.amount.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Open any UPI app (GPay, PhonePe, Paytm, BHIM) and pay to the VPA above. Keep the UTR / transaction reference number handy.
              </p>
              <p className="text-xs text-muted-foreground">
                UTR = the reference number shown in your bank/UPI app after making the payment.
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">Steps:</div>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Open your UPI app and pay <strong className="text-foreground">₹{plan.amount.toLocaleString("en-IN")}</strong> to <strong className="text-foreground font-mono">{UPI_VPA}</strong></li>
                <li>Copy the UTR / transaction reference from your payment app</li>
                <li>Paste it below and submit</li>
                <li>We'll verify and activate your {plan.label.toLowerCase()} plan within 24 hours</li>
              </ol>
            </div>

            {/* UTR Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">UTR / Transaction Reference Number</label>
                <Input
                  placeholder="e.g. 403214567890"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Payment Reference"}
              </Button>
            </form>

            <div className="text-center">
              <button
                onClick={handleBack}
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                Sign out
              </button>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-[10px] text-muted-foreground/40">
          SwarnDesk by <a href="https://www.tirthontech.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground hover:underline underline-offset-2">TirthonTech</a>
        </p>
      </div>
    </div>
  );
}
