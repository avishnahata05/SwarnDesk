import { useState } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isLoading, user } = useAuth();
  const [, navigate] = useLocation();

  // If already logged in, redirect appropriately
  if (user) {
    if (user.plan === "expired") return <Redirect to="/payment" />;
    if (user.role === "admin") return <Redirect to="/admin" />;
    return <Redirect to="/app/dashboard" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      // After login, check plan
      const stored = localStorage.getItem("swarndesk_user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u.plan === "expired") {
          navigate("/payment");
        } else if (u.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/app/dashboard");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-sidebar flex items-center justify-center shadow-md overflow-hidden">
              <img src="/logo.png" alt="SwarnDesk" className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">SwarnDesk</h1>
          <p className="text-sm text-muted-foreground">Jewellery ERP — Sign in to your account</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your store</CardDescription>
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
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Start free trial
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          7-day free trial — no credit card required
        </p>
      </div>
    </div>
  );
}
