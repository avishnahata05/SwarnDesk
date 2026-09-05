import { useState } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { usePartnerAuth } from "@/contexts/PartnerAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSEO } from "@/lib/seo";

export default function PartnerLoginPage() {
  useSEO({ title: "Partner Sign In", description: "Sign in to your SwarnDesk partner dashboard.", path: "/partner/login", noindex: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, partner } = usePartnerAuth();
  const [, navigate] = useLocation();

  if (partner) return <Redirect to="/partner/dashboard" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/partner/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-sidebar flex items-center justify-center shadow-md overflow-hidden">
              <img src="/logo.png" alt="SwarnDesk" className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">SwarnDesk Partners</h1>
          <p className="text-sm text-muted-foreground">Sign in to your referral dashboard</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Partner Sign In</CardTitle>
            <CardDescription>Track referrals and commission</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Not a partner yet?{" "}
              <Link href="/partner/signup" className="text-primary font-medium hover:underline">
                Apply here
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
