import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AdminUser {
  id: number;
  email: string;
  name: string;
  shopName: string;
  mobile: string | null;
  role: string;
  plan: string;
  trialEndsAt: string;
  subscriptionEndsAt: string | null;
  createdAt: string;
}

interface PaymentRequest {
  id: number;
  userId: number;
  amount: number;
  utrNumber: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  processedAt: string | null;
  userName: string;
  userEmail: string;
  shopName: string;
}

interface AdminStats {
  totalUsers: number;
  trialUsers: number;
  activeUsers: number;
  expiredUsers: number;
  pendingPayments: number;
}

function planBadge(plan: string, trialEndsAt: string) {
  if (plan === "active") return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (plan === "trial") {
    const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
    if (daysLeft > 0) return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Trial ({daysLeft}d)</Badge>;
    return <Badge variant="destructive">Trial Expired</Badge>;
  }
  return <Badge variant="destructive">Expired</Badge>;
}

function statusBadge(status: string) {
  if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  return <Badge variant="destructive">Rejected</Badge>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const getHeaders = () => {
    const token = localStorage.getItem("swarndesk_token");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = getHeaders();
      const [s, u, p] = await Promise.all([
        fetch("/api/admin/stats", { headers }).then(r => r.json()),
        fetch("/api/admin/users", { headers }).then(r => r.json()),
        fetch("/api/admin/payment-requests", { headers }).then(r => r.json()),
      ]);
      setStats(s);
      setUsers(Array.isArray(u) ? u : []);
      setPayments(Array.isArray(p) ? p : []);
    } catch {
      setError("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Guard: only admin — must use Redirect, not navigate(), to avoid render-phase side effects
  // Placed after all hooks to satisfy Rules of Hooks
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Redirect to="/app/dashboard" />;

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/payment-requests/${id}/approve`, { method: "PATCH", headers: getHeaders() });
      await fetchAll();
    } catch {
      setError("Failed to approve payment");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/payment-requests/${id}/reject`, { method: "PATCH", headers: getHeaders() });
      await fetchAll();
    } catch {
      setError("Failed to reject payment");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingPayments = payments.filter(p => p.status === "pending");

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-4 shadow-xs">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-full bg-sidebar flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="SwarnDesk" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <span className="font-bold text-foreground">SwarnDesk Admin</span>
        </div>
        <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
        <Button variant="outline" size="sm" onClick={logout}>Sign Out</Button>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage users and subscriptions</p>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : (
          <>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: "Total Users", value: stats.totalUsers, color: "text-foreground" },
                  { label: "Trial", value: stats.trialUsers, color: "text-blue-600" },
                  { label: "Active", value: stats.activeUsers, color: "text-green-600" },
                  { label: "Expired", value: stats.expiredUsers, color: "text-red-600" },
                  { label: "Pending Payments", value: stats.pendingPayments, color: "text-amber-600" },
                ].map(({ label, value, color }) => (
                  <Card key={label}>
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className={`text-3xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pending Payment Requests */}
            {pendingPayments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Pending Payment Approvals ({pendingPayments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-2 font-medium text-muted-foreground">User / Shop</th>
                          <th className="pb-2 font-medium text-muted-foreground">UTR Number</th>
                          <th className="pb-2 font-medium text-muted-foreground">Amount</th>
                          <th className="pb-2 font-medium text-muted-foreground">Date</th>
                          <th className="pb-2 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {pendingPayments.map(pr => (
                          <tr key={pr.id}>
                            <td className="py-3 pr-4">
                              <div className="font-medium text-foreground">{pr.userName}</div>
                              <div className="text-xs text-muted-foreground">{pr.shopName}</div>
                              <div className="text-xs text-muted-foreground">{pr.userEmail}</div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{pr.utrNumber ?? "—"}</span>
                            </td>
                            <td className="py-3 pr-4 font-semibold">₹{pr.amount.toLocaleString("en-IN")}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{formatDate(pr.createdAt)}</td>
                            <td className="py-3">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                                  onClick={() => handleApprove(pr.id)}
                                  disabled={actionLoading === pr.id}
                                >
                                  {actionLoading === pr.id ? "..." : "Approve"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  onClick={() => handleReject(pr.id)}
                                  disabled={actionLoading === pr.id}
                                >
                                  Reject
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Payments History */}
            {payments.filter(p => p.status !== "pending").length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-2 font-medium text-muted-foreground">User / Shop</th>
                          <th className="pb-2 font-medium text-muted-foreground">UTR</th>
                          <th className="pb-2 font-medium text-muted-foreground">Amount</th>
                          <th className="pb-2 font-medium text-muted-foreground">Status</th>
                          <th className="pb-2 font-medium text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {payments.filter(p => p.status !== "pending").map(pr => (
                          <tr key={pr.id}>
                            <td className="py-3 pr-4">
                              <div className="font-medium text-foreground">{pr.userName}</div>
                              <div className="text-xs text-muted-foreground">{pr.shopName}</div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="font-mono text-xs">{pr.utrNumber ?? "—"}</span>
                            </td>
                            <td className="py-3 pr-4">₹{pr.amount.toLocaleString("en-IN")}</td>
                            <td className="py-3 pr-4">{statusBadge(pr.status)}</td>
                            <td className="py-3 text-muted-foreground">{formatDate(pr.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Users ({users.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No users registered yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-2 font-medium text-muted-foreground">Name / Shop</th>
                          <th className="pb-2 font-medium text-muted-foreground">Email</th>
                          <th className="pb-2 font-medium text-muted-foreground">Mobile</th>
                          <th className="pb-2 font-medium text-muted-foreground">Plan</th>
                          <th className="pb-2 font-medium text-muted-foreground">Trial Ends</th>
                          <th className="pb-2 font-medium text-muted-foreground">Sub Ends</th>
                          <th className="pb-2 font-medium text-muted-foreground">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {users.map(u => (
                          <tr key={u.id}>
                            <td className="py-3 pr-4">
                              <div className="font-medium text-foreground">{u.name}</div>
                              <div className="text-xs text-muted-foreground">{u.shopName}</div>
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">{u.email}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{u.mobile ?? "—"}</td>
                            <td className="py-3 pr-4">{planBadge(u.plan, u.trialEndsAt)}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{formatDate(u.trialEndsAt)}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{u.subscriptionEndsAt ? formatDate(u.subscriptionEndsAt) : "—"}</td>
                            <td className="py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
