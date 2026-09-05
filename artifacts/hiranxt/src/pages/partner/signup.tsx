import { useState } from "react";
import { Link, Redirect } from "wouter";
import { usePartnerAuth } from "@/contexts/PartnerAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSEO } from "@/lib/seo";
import { Clock } from "lucide-react";

export default function PartnerSignupPage() {
  useSEO({ title: "Become a Partner", description: "Refer jewellers to SwarnDesk and earn commission.", path: "/partner/signup", noindex: true });
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", phone: "" });
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { signup, isLoading, partner } = usePartnerAuth();

  if (partner) return <Redirect to="/partner/dashboard" />;

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    try {
      await signup({ name: form.name, email: form.email, password: form.password, phone: form.phone || undefined });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock className="w-7 h-7 text-amber-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">Application Received!</h2>
            <p className="text-muted-foreground text-sm">
              Thanks for applying to become a SwarnDesk partner. Our team will review your application shortly — once approved, you can sign in and start sharing your referral link.
            </p>
            <Link href="/partner/login" className="text-primary font-medium hover:underline text-sm">
              Go to Partner Sign In
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-sidebar flex items-center justify-center shadow-md overflow-hidden">
              <img src="/logo.png" alt="SwarnDesk" className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Become a SwarnDesk Partner</h1>
          <p className="text-sm text-muted-foreground">Refer jewellers, earn commission on every shop you bring in</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Partner Application</CardTitle>
            <CardDescription>We'll review your application before activating your referral code</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Full Name <span className="text-destructive">*</span></label>
                <Input placeholder="Your full name" value={form.name} onChange={handleChange("name")} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email <span className="text-destructive">*</span></label>
                <Input type="email" placeholder="you@example.com" value={form.email} onChange={handleChange("email")} required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Mobile</label>
                <Input type="tel" placeholder="98765 43210" value={form.phone} onChange={handleChange("phone")} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Password <span className="text-destructive">*</span></label>
                  <Input type="password" placeholder="Min. 6 characters" value={form.password} onChange={handleChange("password")} required autoComplete="new-password" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Confirm Password <span className="text-destructive">*</span></label>
                  <Input type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={handleChange("confirmPassword")} required autoComplete="new-password" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Submitting..." : "Apply to Become a Partner"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already a partner?{" "}
              <Link href="/partner/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
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
