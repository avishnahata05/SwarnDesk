import { useState, useEffect, useCallback } from "react";
import { Redirect } from "wouter";
import { usePartnerAuth } from "@/contexts/PartnerAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Copy, Check, LogOut, Clock, ShieldOff, Users, UserCheck, IndianRupee,
  TrendingUp, Percent,
} from "lucide-react";

interface PartnerStats {
  referralCode: string;
  commissionPercent: number;
  totalReferred: number;
  totalPaid: number;
  activeCount: number;
  trialCount: number;
  expiredCount: number;
  totalRevenue: number;
  commissionOwed: number;
}

interface PartnerClient {
  id: number;
  name: string;
  shopName: string;
  email: string;
  plan: string;
  isExpired: boolean;
  hasPaid: boolean;
  totalPaid: number;
  joinedAt: string;
}

function fmtMoney(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function CopyPill({ label, value, testId }: { label: string; value: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <button
        onClick={copy}
        data-testid={testId}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/70 transition-colors"
      >
        <span className="font-mono text-sm font-semibold text-foreground truncate">{value}</span>
        {copied ? <Check className="w-4 h-4 text-green-600 flex-shrink-0" /> : <Copy className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
    </div>
  );
}

function planBadge(client: PartnerClient) {
  if (client.isExpired) return <Badge variant="destructive">Expired</Badge>;
  if (client.plan === "active") return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (client.plan === "trial") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Trial</Badge>;
  return <Badge variant="outline">{client.plan}</Badge>;
}

export default function PartnerDashboardPage() {
  const { partner, token, logout, refresh } = usePartnerAuth();
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [clients, setClients] = useState<PartnerClient[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");

  // Refresh status from the server on load — an admin may have approved/deactivated
  // this partner since their last login, and that must take effect immediately.
  useEffect(() => {
    refresh().finally(() => setCheckingStatus(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setDataLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, clientsRes] = await Promise.all([
        fetch("/api/partner/stats", { headers }),
        fetch("/api/partner/clients", { headers }),
      ]);
      if (!statsRes.ok || !clientsRes.ok) throw new Error("Failed to load dashboard data");
      setStats(await statsRes.json());
      setClients(await clientsRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setDataLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!checkingStatus && partner?.status === "active") fetchData();
  }, [checkingStatus, partner?.status, fetchData]);

  if (!checkingStatus && !partner) return <Redirect to="/partner/login" />;

  if (checkingStatus || !partner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (partner.status === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock className="w-7 h-7 text-amber-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">Application Under Review</h2>
            <p className="text-muted-foreground text-sm">
              Hi {partner.name}, thanks for applying! Our team is reviewing your partner application. You'll be able to see your referral code and dashboard once approved.
            </p>
            <Button variant="outline" onClick={logout} className="gap-1.5">
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (partner.status === "inactive") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <ShieldOff className="w-7 h-7 text-red-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground">Account Deactivated</h2>
            <p className="text-muted-foreground text-sm">
              Your SwarnDesk partner account has been deactivated. Contact SwarnDesk support if you believe this is a mistake.
            </p>
            <Button variant="outline" onClick={logout} className="gap-1.5">
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/register?ref=${partner.referralCode}`;
  const conversionPct = stats && stats.totalReferred > 0 ? Math.round((stats.totalPaid / stats.totalReferred) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 md:px-8 gap-3">
        <img src="/logo.png" alt="SwarnDesk" className="w-7 h-7 object-contain" />
        <div className="text-sm font-bold text-foreground">SwarnDesk Partners</div>
        <div className="flex-1" />
        <div className="text-sm text-muted-foreground hidden sm:block">{partner.name}</div>
        <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </Button>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Your Referral Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Share your link, track signups, and see commission earned.</p>
        </div>

        <Card>
          <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CopyPill label="Your Referral Code" value={partner.referralCode} testId="pill-referral-code" />
            <CopyPill label="Shareable Signup Link" value={referralLink} testId="pill-referral-link" />
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2">{error}</div>
        )}

        {dataLoading ? (
          <p className="text-sm text-muted-foreground">Loading stats...</p>
        ) : stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <Card className="border-card-border shadow-xs">
                <CardContent className="p-4 md:p-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3"><Users className="w-5 h-5 text-blue-600" /></div>
                  <div className="text-xl font-bold tracking-tight">{stats.totalReferred}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium">Shops Referred</div>
                </CardContent>
              </Card>
              <Card className="border-card-border shadow-xs">
                <CardContent className="p-4 md:p-5">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3"><UserCheck className="w-5 h-5 text-green-600" /></div>
                  <div className="text-xl font-bold tracking-tight">{stats.totalPaid}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium">Have Paid ({conversionPct}% conversion)</div>
                </CardContent>
              </Card>
              <Card className="border-card-border shadow-xs">
                <CardContent className="p-4 md:p-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3"><IndianRupee className="w-5 h-5 text-emerald-600" /></div>
                  <div className="text-xl font-bold tracking-tight">{fmtMoney(stats.totalRevenue)}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium">Revenue From Your Referrals</div>
                </CardContent>
              </Card>
              <Card className="border-card-border shadow-xs">
                <CardContent className="p-4 md:p-5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3"><TrendingUp className="w-5 h-5 text-amber-600" /></div>
                  <div className="text-xl font-bold tracking-tight">{fmtMoney(stats.commissionOwed)}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
                    Commission Earned <span className="inline-flex items-center gap-0.5 text-[10px]"><Percent className="w-2.5 h-2.5" />{stats.commissionPercent}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Referred Shops — Status Breakdown</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Active: <strong>{stats.activeCount}</strong></div>
                <div className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Trial: <strong>{stats.trialCount}</strong></div>
                <div className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Expired: <strong>{stats.expiredCount}</strong></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Your Referred Clients</CardTitle></CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No referrals yet — share your link to get started.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shop</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Total Paid</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map(c => (
                        <TableRow key={c.id} data-testid={`row-client-${c.id}`}>
                          <TableCell>
                            <div className="font-medium">{c.shopName}</div>
                            <div className="text-xs text-muted-foreground">{c.name}</div>
                          </TableCell>
                          <TableCell>{planBadge(c)}</TableCell>
                          <TableCell>{c.hasPaid ? <Badge className="bg-green-100 text-green-800 border-green-200">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                          <TableCell>{fmtMoney(c.totalPaid)}</TableCell>
                          <TableCell className="text-muted-foreground">{fmtDate(c.joinedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
