import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const UPI_VPA = "akshatnahata05@ibl";
const AMOUNT = 2999;

export default function PaymentPage() {
  const { user, logout } = useAuth();
  const [utrNumber, setUtrNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

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
      const res = await fetch("/api/auth/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, utrNumber: utrNumber.trim() }),
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
              Your payment reference has been received. Our team will verify and activate your subscription within <strong>24 hours</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              You'll receive confirmation once your account is activated.
            </p>
            <Button variant="outline" onClick={logout} className="mt-4">
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
            {/* Price options */}
            <div className="space-y-2">
              {[
                { label: "Monthly", amount: "₹2,999", sub: "/month", highlight: true },
                { label: "Quarterly", amount: "₹7,999", sub: "/quarter · save ₹998" },
                { label: "Annual", amount: "₹29,999", sub: "/year · save ₹5,989" },
              ].map(opt => (
                <div key={opt.label} className={`rounded-xl border p-3 flex items-center justify-between ${opt.highlight ? "bg-amber-50 border-amber-200" : "bg-muted/30 border-border"}`}>
                  <span className={`text-sm font-medium ${opt.highlight ? "text-amber-800" : "text-foreground"}`}>{opt.label}</span>
                  <div className="text-right">
                    <span className={`font-bold ${opt.highlight ? "text-amber-800" : "text-foreground"}`}>{opt.amount}</span>
                    <span className="text-xs text-muted-foreground ml-1">{opt.sub}</span>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-center">All plans include every feature. Contact us to pay for a quarterly or annual plan.</p>
            </div>

            {/* UPI Payment Details */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="text-sm font-semibold text-foreground">Pay via UPI</div>
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                <span className="text-xs text-muted-foreground">UPI ID / VPA</span>
                <span className="font-mono font-semibold text-foreground text-sm">{UPI_VPA}</span>
              </div>
              <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className="font-semibold text-foreground">₹{AMOUNT.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Open any UPI app (GPay, PhonePe, Paytm, BHIM) and pay to the VPA above. Keep the UTR / transaction reference number handy.
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">Steps:</div>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Open your UPI app and pay your chosen plan amount to <strong className="text-foreground font-mono">{UPI_VPA}</strong></li>
                <li>Copy the UTR / transaction reference from your payment app</li>
                <li>Paste it below and submit</li>
                <li>We'll verify and activate your account within 24 hours</li>
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
                onClick={logout}
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                Sign out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
