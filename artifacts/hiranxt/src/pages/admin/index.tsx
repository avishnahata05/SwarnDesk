import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Users, TrendingUp, IndianRupee, Clock, AlertTriangle, CheckCircle2,
  Search, RefreshCw, Trash2, CalendarClock, ShieldOff, ShieldCheck,
  XCircle, BarChart3, MessageCircle, StickyNote, History, Download, Key, Copy, Check, Pencil,
} from "lucide-react";

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
  planId: string | null;
  durationDays: number | null;
  utrNumber: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  processedAt: string | null;
  userName: string;
  userEmail: string;
  shopName: string;
}

const PLAN_LABELS: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" };

interface AdminStats {
  totalUsers: number;
  trialUsers: number;
  activeUsers: number;
  expiredUsers: number;
  pendingPayments: number;
}

interface Revenue {
  totalRevenue: number;
  approvedCount: number;
  mrr: number;
  monthly: { month: string; revenue: number }[];
}

interface ExpiringUser {
  id: number;
  name: string;
  email: string;
  shopName: string;
  mobile: string | null;
  plan: string;
  trialEndsAt: string;
  subscriptionEndsAt: string | null;
}

interface ActivityLogEntry {
  id: number;
  adminEmailSnapshot: string;
  action: string;
  targetLabelSnapshot: string | null;
  details: string | null;
  createdAt: string;
}

interface UserNote {
  id: number;
  note: string;
  adminEmailSnapshot: string;
  createdAt: string;
}

function actionLabel(action: string) {
  switch (action) {
    case "approve_payment": return "Approved payment";
    case "reject_payment": return "Rejected payment";
    case "plan_change": return "Changed plan";
    case "delete_user": return "Deleted user";
    default: return action;
  }
}

/** Opens a prefilled WhatsApp chat with the user reminding them their trial/subscription is ending soon. */
function sendRenewalReminder(u: { name: string; mobile: string | null; plan: string; trialEndsAt: string; subscriptionEndsAt: string | null }) {
  if (!u.mobile) return;
  const endsAt = u.plan === "trial" ? u.trialEndsAt : u.subscriptionEndsAt;
  const daysLeft = endsAt ? Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000) : 0;
  const timing = daysLeft > 0 ? `expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : "has expired";
  const msg = `Hi ${u.name}, your SwarnDesk ${u.plan === "trial" ? "free trial" : "subscription"} ${timing}. Renew now to keep your billing, inventory, and customer data running without interruption. Reply here if you'd like help renewing!`;
  const digits = u.mobile.replace(/\D/g, "");
  const fullMobile = digits.length === 10 ? `91${digits}` : digits;
  window.open(`https://wa.me/${fullMobile}?text=${encodeURIComponent(msg)}`, "_blank");
}

function csvCell(value: string | number | null | undefined) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map(row => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A user is only really "active" if plan is active AND the subscription hasn't lapsed — mirrors App.tsx's isAccessExpired */
function isReallyExpired(u: { plan: string; trialEndsAt: string; subscriptionEndsAt: string | null }) {
  const now = new Date();
  if (u.plan === "expired") return true;
  if (u.plan === "trial") return new Date(u.trialEndsAt) <= now;
  if (u.plan === "active") return !!u.subscriptionEndsAt && new Date(u.subscriptionEndsAt) <= now;
  return false;
}

function planBadge(plan: string, trialEndsAt: string, subscriptionEndsAt: string | null) {
  if (plan === "active") {
    if (subscriptionEndsAt && new Date(subscriptionEndsAt) <= new Date()) return <Badge variant="destructive">Expired</Badge>;
    return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  }
  if (plan === "trial") {
    const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
    if (daysLeft > 0) return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Trial ({daysLeft}d left)</Badge>;
    return <Badge variant="destructive">Trial Expired</Badge>;
  }
  return <Badge variant="destructive">Expired</Badge>;
}

function statusBadge(status: string) {
  if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  return <Badge variant="destructive">Rejected</Badge>;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [expiring, setExpiring] = useState<ExpiringUser[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  // Notes dialog
  const [notesTarget, setNotesTarget] = useState<AdminUser | null>(null);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [newNote, setNewNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Reset user password dialog
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetCustomPassword, setResetCustomPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  // Edit user account details dialog
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editShopName, setEditShopName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Admin's own "change my password" dialog
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePwSaving, setChangePwSaving] = useState(false);
  const [changePwError, setChangePwError] = useState("");
  const [changePwSuccess, setChangePwSuccess] = useState(false);

  // UI state
  const [userSearch, setUserSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null); // "pay-{id}" or "user-{id}"

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<PaymentRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  // Approve-custom dialog
  const [approveTarget, setApproveTarget] = useState<PaymentRequest | null>(null);
  const [approveDays, setApproveDays] = useState("30");
  const [approveNotes, setApproveNotes] = useState("");

  // Delete user dialog
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // User plan action dialog
  const [planTarget, setPlanTarget] = useState<AdminUser | null>(null);
  const [planAction, setPlanAction] = useState<"activate" | "extend_trial" | "expire" | null>(null);
  const [planDays, setPlanDays] = useState("30");

  const getHeaders = () => {
    const token = localStorage.getItem("swarndesk_token");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  };

  /** Fetches and throws with the server's error message on any non-2xx response, instead of silently treating it as success. */
  const apiCall = async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { headers: getHeaders(), ...opts });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    if (res.status === 204) return null;
    return res.json();
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, u, p, r, e, a] = await Promise.all([
        apiCall("/api/admin/stats"),
        apiCall("/api/admin/users"),
        apiCall("/api/admin/payment-requests"),
        apiCall("/api/admin/revenue"),
        apiCall("/api/admin/expiring-soon"),
        apiCall("/api/admin/activity-log?limit=50"),
      ]);
      setStats(s);
      setUsers(Array.isArray(u) ? u : []);
      setPayments(Array.isArray(p) ? p : []);
      setRevenue(r?.totalRevenue !== undefined ? r : null);
      setExpiring(Array.isArray(e) ? e : []);
      setActivityLog(Array.isArray(a) ? a : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!user) return <Redirect to="/login" />;
  if (user.role !== "admin") return <Redirect to="/app/dashboard" />;

  // ── Payment actions ────────────────────────────────────────────────────────

  const handleApproveCustom = async () => {
    if (!approveTarget) return;
    setActionLoading(`pay-${approveTarget.id}`);
    setActionError("");
    try {
      await apiCall(`/api/admin/payment-requests/${approveTarget.id}/approve-custom`, {
        method: "PATCH",
        body: JSON.stringify({ days: parseInt(approveDays) || 30, notes: approveNotes || null }),
      });
      setApproveTarget(null); setApproveNotes(""); setApproveDays("30");
      await fetchAll();
    } catch (err) { setActionError(err instanceof Error ? err.message : "Failed to approve payment"); }
    finally { setActionLoading(null); }
  };

  const handleApproveQuick = async (id: number) => {
    setActionLoading(`pay-${id}`);
    setActionError("");
    try {
      await apiCall(`/api/admin/payment-requests/${id}/approve`, { method: "PATCH" });
      await fetchAll();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to approve payment"); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectNotes.trim()) {
      setActionError("Please enter a reason for rejection — this is shown to the user.");
      return;
    }
    setActionLoading(`pay-${rejectTarget.id}`);
    setActionError("");
    try {
      await apiCall(`/api/admin/payment-requests/${rejectTarget.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ notes: rejectNotes || null }),
      });
      setRejectTarget(null); setRejectNotes("");
      await fetchAll();
    } catch (err) { setActionError(err instanceof Error ? err.message : "Failed to reject payment"); }
    finally { setActionLoading(null); }
  };

  // ── User actions ───────────────────────────────────────────────────────────

  const handlePlanAction = async () => {
    if (!planTarget || !planAction) return;
    setActionLoading(`user-${planTarget.id}`);
    setActionError("");
    try {
      await apiCall(`/api/admin/users/${planTarget.id}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ action: planAction, days: parseInt(planDays) || 30 }),
      });
      setPlanTarget(null); setPlanAction(null); setPlanDays("30");
      await fetchAll();
    } catch (err) { setActionError(err instanceof Error ? err.message : "Failed to update user plan"); }
    finally { setActionLoading(null); }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") return;
    setActionLoading(`user-${deleteTarget.id}`);
    setActionError("");
    try {
      await apiCall(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setDeleteConfirmText("");
      await fetchAll();
    } catch (err) { setActionError(err instanceof Error ? err.message : "Failed to delete user"); }
    finally { setActionLoading(null); }
  };

  // ── Notes ──────────────────────────────────────────────────────────────────

  const openNotes = async (u: AdminUser) => {
    setNotesTarget(u);
    setNotes([]);
    setNewNote("");
    setNotesError("");
    setNotesLoading(true);
    try {
      const data = await apiCall(`/api/admin/users/${u.id}/notes`);
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setNotesLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!notesTarget || !newNote.trim()) return;
    setNoteSaving(true);
    setNotesError("");
    try {
      const created = await apiCall(`/api/admin/users/${notesTarget.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: newNote.trim() }),
      });
      setNotes(prev => [created, ...prev]);
      setNewNote("");
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  };

  // ── Passwords ──────────────────────────────────────────────────────────────

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (resetCustomPassword && resetCustomPassword.length < 8) {
      setResetError("Password must be at least 8 characters");
      return;
    }
    setResetSaving(true);
    setResetError("");
    try {
      const data = await apiCall(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword: resetCustomPassword || undefined }),
      });
      setResetResult(data.newPassword);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setResetSaving(false);
    }
  };

  const openEditDetails = (u: AdminUser) => {
    setEditTarget(u);
    setEditName(u.name);
    setEditShopName(u.shopName);
    setEditMobile(u.mobile ?? "");
    setEditEmail(u.email);
    setEditError("");
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditError("");
    if (!editName.trim() || !editShopName.trim() || !editEmail.trim()) {
      setEditError("Name, shop name, and email are required");
      return;
    }
    setEditSaving(true);
    try {
      await apiCall(`/api/admin/users/${editTarget.id}/details`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim(), shopName: editShopName.trim(), mobile: editMobile.trim() || null, email: editEmail.trim() }),
      });
      setEditTarget(null);
      fetchAll();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  };

  const handleChangeOwnPassword = async () => {
    setChangePwError("");
    if (newPassword.length < 8) { setChangePwError("New password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setChangePwError("New password and confirmation don't match"); return; }
    setChangePwSaving(true);
    try {
      await apiCall("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setChangePwSuccess(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setChangePwError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangePwSaving(false);
    }
  };

  // ── Exports ────────────────────────────────────────────────────────────────

  const exportUsersCsv = () => {
    const header = ["Name", "Shop", "Email", "Mobile", "Plan", "Trial Ends", "Subscription Ends", "Joined"];
    const rows = filteredUsers.map(u => [u.name, u.shopName, u.email, u.mobile ?? "", u.plan, fmt(u.trialEndsAt), u.subscriptionEndsAt ? fmt(u.subscriptionEndsAt) : "", fmt(u.createdAt)]);
    downloadCsv(`swarndesk-users-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  const exportPaymentsCsv = () => {
    const header = ["User", "Shop", "Email", "UTR", "Plan", "Amount", "Status", "Notes", "Requested", "Processed"];
    const rows = payments.map(p => [p.userName, p.shopName, p.userEmail, p.utrNumber ?? "", p.planId ? (PLAN_LABELS[p.planId] ?? p.planId) : "", p.amount, p.status, p.notes ?? "", fmt(p.createdAt), p.processedAt ? fmt(p.processedAt) : ""]);
    downloadCsv(`swarndesk-payments-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const pendingPayments = payments.filter(p => p.status === "pending");
  const historyPayments = payments.filter(p => p.status !== "pending");

  const filteredUsers = users.filter(u => {
    const matchesPlan =
      planFilter === "all" ? true :
      planFilter === "active" ? (u.plan === "active" && !isReallyExpired(u)) :
      planFilter === "trial" ? (u.plan === "trial" && !isReallyExpired(u)) :
      planFilter === "expired" ? isReallyExpired(u) :
      true;
    const q = userSearch.toLowerCase();
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.shopName.toLowerCase().includes(q) || (u.mobile ?? "").includes(q);
    return matchesPlan && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-full bg-sidebar flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="SwarnDesk" className="w-6 h-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <span className="font-bold text-foreground">SwarnDesk Admin</span>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5 text-muted-foreground">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => { setChangePwOpen(true); setChangePwError(""); setChangePwSuccess(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
        >
          <Key className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Change Password</span>
        </Button>
        <Button variant="outline" size="sm" onClick={logout}>Sign Out</Button>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage users, subscriptions, and revenue</p>
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
            {/* ── Stats + Revenue row ───────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {stats && [
                { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-foreground" },
                { label: "Trial", value: stats.trialUsers, icon: Clock, color: "text-blue-600" },
                { label: "Active", value: stats.activeUsers, icon: CheckCircle2, color: "text-green-600" },
                { label: "Expired", value: stats.expiredUsers, icon: XCircle, color: "text-red-500" },
                { label: "Pending", value: stats.pendingPayments, icon: AlertTriangle, color: "text-amber-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="pt-4 pb-3 px-3">
                    <Icon className={`w-4 h-4 ${color} mb-1`} />
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </CardContent>
                </Card>
              ))}
              {revenue && (
                <>
                  <Card className="border-green-200 bg-green-50/40">
                    <CardContent className="pt-4 pb-3 px-3">
                      <IndianRupee className="w-4 h-4 text-green-600 mb-1" />
                      <div className="text-2xl font-bold text-green-700">{fmtMoney(revenue.mrr)}</div>
                      <div className="text-xs text-muted-foreground">This Month</div>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200 bg-green-50/40">
                    <CardContent className="pt-4 pb-3 px-3">
                      <TrendingUp className="w-4 h-4 text-green-600 mb-1" />
                      <div className="text-2xl font-bold text-green-700">{fmtMoney(revenue.totalRevenue)}</div>
                      <div className="text-xs text-muted-foreground">Total Revenue</div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* ── Expiring Soon Alert ───────────────────────────────────── */}
            {expiring.length > 0 && (
              <Card className="border-amber-300 bg-amber-50/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Expiring Soon — {expiring.length} user{expiring.length !== 1 ? "s" : ""} (within 7 days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {expiring.map(u => {
                      const endsAt = u.plan === "trial" ? u.trialEndsAt : u.subscriptionEndsAt;
                      const daysLeft = endsAt ? Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000) : 0;
                      return (
                        <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white border border-amber-200 text-sm flex-wrap">
                          <div>
                            <div className="font-medium text-foreground">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.shopName} · {u.email}</div>
                            {u.mobile && <div className="text-xs text-muted-foreground">{u.mobile}</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${daysLeft <= 2 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                              {u.plan === "trial" ? "Trial" : "Subscription"} — {daysLeft}d left
                            </span>
                            {u.mobile && (
                              <button
                                onClick={() => sendRenewalReminder(u)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-green-400/50 text-green-700 hover:bg-green-50 transition-colors"
                                title="Send a WhatsApp renewal reminder"
                              >
                                <MessageCircle className="w-3 h-3" />
                                Remind
                              </button>
                            )}
                            <button
                              onClick={() => { setPlanTarget(u as unknown as AdminUser); setPlanAction("activate"); setPlanDays("30"); setActionError(""); }}
                              className="text-xs px-2 py-1 rounded border border-green-400/50 text-green-700 hover:bg-green-50 transition-colors"
                            >
                              Extend
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Revenue monthly chart ─────────────────────────────────── */}
            {revenue && revenue.monthly.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Monthly Revenue (last 6 months)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-24">
                    {revenue.monthly.map(({ month, revenue: rev }) => {
                      const max = Math.max(...revenue.monthly.map(m => m.revenue), 1);
                      const pct = Math.round((rev / max) * 100);
                      return (
                        <div key={month} className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {fmtMoney(rev)}
                          </div>
                          <div
                            className="w-full bg-primary/80 rounded-t-sm transition-all"
                            style={{ height: `${Math.max(pct, 4)}%`, minHeight: 4 }}
                          />
                          <div className="text-[9px] text-muted-foreground">{fmtMonth(month)}</div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {revenue.approvedCount} approved payment{revenue.approvedCount !== 1 ? "s" : ""} · hover bars for amount
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ── Pending Payment Approvals ─────────────────────────────── */}
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
                          <th className="pb-2 font-medium text-muted-foreground">UTR</th>
                          <th className="pb-2 font-medium text-muted-foreground">Plan</th>
                          <th className="pb-2 font-medium text-muted-foreground">Amount</th>
                          <th className="pb-2 font-medium text-muted-foreground">Date</th>
                          <th className="pb-2 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {pendingPayments.map(pr => {
                          const days = pr.durationDays ?? 30;
                          return (
                          <tr key={pr.id}>
                            <td className="py-3 pr-4">
                              <div className="font-medium text-foreground">{pr.userName}</div>
                              <div className="text-xs text-muted-foreground">{pr.shopName}</div>
                              <div className="text-xs text-muted-foreground">{pr.userEmail}</div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{pr.utrNumber ?? "—"}</span>
                            </td>
                            <td className="py-3 pr-4">
                              {pr.planId ? <Badge variant="outline" className="text-xs">{PLAN_LABELS[pr.planId] ?? pr.planId}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="py-3 pr-4 font-semibold">{fmtMoney(pr.amount)}</td>
                            <td className="py-3 pr-4 text-muted-foreground text-xs">{fmt(pr.createdAt)}</td>
                            <td className="py-3">
                              <div className="flex gap-1.5 flex-wrap">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                                  onClick={() => handleApproveQuick(pr.id)}
                                  disabled={actionLoading === `pay-${pr.id}`}
                                  title={`Approve for ${days} days`}
                                >
                                  {actionLoading === `pay-${pr.id}` ? "..." : `Quick Approve (${days} days)`}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-green-500/50 text-green-700 hover:bg-green-50"
                                  onClick={() => { setApproveTarget(pr); setApproveDays(String(days)); setApproveNotes(""); setActionError(""); }}
                                  disabled={actionLoading === `pay-${pr.id}`}
                                  title="Approve with custom duration"
                                >
                                  Custom Duration...
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  onClick={() => { setRejectTarget(pr); setRejectNotes(""); setActionError(""); }}
                                  disabled={actionLoading === `pay-${pr.id}`}
                                >
                                  Reject
                                </Button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Payment History ───────────────────────────────────────── */}
            {historyPayments.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="text-sm">Payment History ({historyPayments.length})</CardTitle>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={exportPaymentsCsv}>
                      <Download className="w-3 h-3" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-2 font-medium text-muted-foreground">User / Shop</th>
                          <th className="pb-2 font-medium text-muted-foreground">UTR</th>
                          <th className="pb-2 font-medium text-muted-foreground">Plan</th>
                          <th className="pb-2 font-medium text-muted-foreground">Amount</th>
                          <th className="pb-2 font-medium text-muted-foreground">Status</th>
                          <th className="pb-2 font-medium text-muted-foreground">Notes</th>
                          <th className="pb-2 font-medium text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {historyPayments.map(pr => (
                          <tr key={pr.id}>
                            <td className="py-2 pr-4">
                              <div className="font-medium text-foreground">{pr.userName}</div>
                              <div className="text-xs text-muted-foreground">{pr.shopName}</div>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="font-mono text-xs">{pr.utrNumber ?? "—"}</span>
                            </td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{pr.planId ? (PLAN_LABELS[pr.planId] ?? pr.planId) : "—"}</td>
                            <td className="py-2 pr-4">{fmtMoney(pr.amount)}</td>
                            <td className="py-2 pr-4">{statusBadge(pr.status)}</td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[160px] truncate">{pr.notes ?? "—"}</td>
                            <td className="py-2 text-muted-foreground text-xs">{fmt(pr.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Users Table ───────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-base">All Users ({filteredUsers.length}/{users.length})</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search name, email, shop..."
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        className="pl-8 h-8 text-xs w-52"
                      />
                    </div>
                    <Select value={planFilter} onValueChange={setPlanFilter}>
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Plans</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportUsersCsv} disabled={filteredUsers.length === 0}>
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredUsers.length === 0 ? (
                  <p className="text-muted-foreground text-sm p-6 text-center">No users match the current filter.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Name / Shop</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Email</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Mobile</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Plan</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Trial Ends</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Sub Ends</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Joined</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{u.name}</div>
                              <div className="text-xs text-muted-foreground">{u.shopName}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{u.email}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{u.mobile ?? "—"}</td>
                            <td className="px-4 py-3">{planBadge(u.plan, u.trialEndsAt, u.subscriptionEndsAt)}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{fmt(u.trialEndsAt)}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{u.subscriptionEndsAt ? fmt(u.subscriptionEndsAt) : "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{fmt(u.createdAt)}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 flex-wrap">
                                <button
                                  onClick={() => openEditDetails(u)}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                                  title="Edit name, shop name, mobile, or email"
                                >
                                  <Pencil className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => openNotes(u)}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                                  title="View / add admin notes"
                                >
                                  <StickyNote className="w-3 h-3" />
                                  Notes
                                </button>
                                {u.mobile && (
                                  <button
                                    onClick={() => sendRenewalReminder(u)}
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-green-400/50 text-green-700 hover:bg-green-50 transition-colors"
                                    title="Send a WhatsApp renewal reminder"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    Remind
                                  </button>
                                )}
                                <button
                                  onClick={() => { setResetTarget(u); setResetCustomPassword(""); setResetResult(null); setResetError(""); setResetCopied(false); }}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                                  title="Reset this user's password"
                                >
                                  <Key className="w-3 h-3" />
                                  Reset Password
                                </button>
                                <span className="w-px h-5 bg-border mx-0.5 self-center" aria-hidden="true" />
                                <button
                                  onClick={() => { setPlanTarget(u); setPlanAction("activate"); setPlanDays("30"); setActionError(""); }}
                                  disabled={actionLoading === `user-${u.id}`}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-green-400/50 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-40"
                                  title="Extend active subscription"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  Activate
                                </button>
                                <button
                                  onClick={() => { setPlanTarget(u); setPlanAction("extend_trial"); setPlanDays("7"); setActionError(""); }}
                                  disabled={actionLoading === `user-${u.id}`}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-400/50 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-40"
                                  title="Extend trial period"
                                >
                                  <CalendarClock className="w-3 h-3" />
                                  Trial
                                </button>
                                <span className="w-px h-5 bg-border mx-0.5 self-center" aria-hidden="true" />
                                <button
                                  onClick={() => { setPlanTarget(u); setPlanAction("expire"); setActionError(""); }}
                                  disabled={actionLoading === `user-${u.id}` || isReallyExpired(u)}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-300/60 bg-red-50/50 text-red-600 hover:border-red-400/50 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40"
                                  title="Expire account immediately"
                                >
                                  <ShieldOff className="w-3 h-3" />
                                  Expire Now
                                </button>
                                <button
                                  onClick={() => { setDeleteTarget(u); setActionError(""); }}
                                  disabled={actionLoading === `user-${u.id}`}
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-300/60 bg-red-50/50 text-destructive hover:border-destructive/50 hover:bg-destructive/5 transition-colors disabled:opacity-40"
                                  title="Delete user account"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Recent Admin Activity ─────────────────────────────────── */}
            {activityLog.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    Recent Admin Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {activityLog.map(a => (
                      <div key={a.id} className="flex items-start justify-between gap-3 text-xs border-b border-border/60 pb-2 last:border-0 last:pb-0">
                        <div>
                          <span className="font-medium text-foreground">{actionLabel(a.action)}</span>
                          {a.targetLabelSnapshot && <span className="text-muted-foreground"> — {a.targetLabelSnapshot}</span>}
                          {a.details && <div className="text-muted-foreground mt-0.5">{a.details}</div>}
                        </div>
                        <div className="text-right text-muted-foreground whitespace-nowrap">
                          <div>{a.adminEmailSnapshot}</div>
                          <div>{fmt(a.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* ── Approve-custom dialog ──────────────────────────────────────────── */}
      <Dialog open={!!approveTarget} onOpenChange={v => { if (!v) { setApproveTarget(null); setActionError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Approve Payment
            </DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm space-y-1">
                <div><span className="text-muted-foreground">User:</span> <strong>{approveTarget.userName}</strong></div>
                <div><span className="text-muted-foreground">UTR:</span> <span className="font-mono">{approveTarget.utrNumber ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Plan:</span> <strong>{approveTarget.planId ? (PLAN_LABELS[approveTarget.planId] ?? approveTarget.planId) : "—"}</strong></div>
                <div><span className="text-muted-foreground">Amount:</span> <strong>{fmtMoney(approveTarget.amount)}</strong></div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Subscription duration (days)</label>
                <div className="flex gap-2 mb-2">
                  {["7", "15", "30", "90", "365"].map(d => (
                    <button
                      key={d}
                      onClick={() => setApproveDays(d)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${approveDays === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  value={approveDays}
                  onChange={e => setApproveDays(e.target.value)}
                  className="h-8 text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Admin notes (optional)</label>
                <Input
                  value={approveNotes}
                  onChange={e => setApproveNotes(e.target.value)}
                  placeholder="e.g. Annual plan, verified"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}
          {actionError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">
              {actionError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setApproveTarget(null); setActionError(""); }}>Cancel</Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleApproveCustom} disabled={actionLoading !== null}>
              Approve {approveDays}d
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={v => { if (!v) { setRejectTarget(null); setActionError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Reject Payment
            </DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm space-y-1">
                <div><span className="text-muted-foreground">User:</span> <strong>{rejectTarget.userName}</strong></div>
                <div><span className="text-muted-foreground">UTR:</span> <span className="font-mono">{rejectTarget.utrNumber ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> {fmtMoney(rejectTarget.amount)}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Reason for rejection (shown to user) *</label>
                <textarea
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-destructive resize-none"
                  rows={3}
                  value={rejectNotes}
                  onChange={e => setRejectNotes(e.target.value)}
                  placeholder="e.g. UTR not found, invalid amount..."
                  required
                />
              </div>
            </div>
          )}
          {actionError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">
              {actionError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setRejectTarget(null); setActionError(""); }}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={handleReject} disabled={actionLoading !== null || !rejectNotes.trim()}>
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── User plan action dialog ────────────────────────────────────────── */}
      <Dialog open={!!planTarget && !!planAction} onOpenChange={v => { if (!v) { setPlanTarget(null); setActionError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {planAction === "activate" ? "Activate / Extend Subscription" :
               planAction === "extend_trial" ? "Extend Trial Period" :
               "Expire Account"}
            </DialogTitle>
          </DialogHeader>
          {planTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm">
                <div className="font-medium">{planTarget.name}</div>
                <div className="text-muted-foreground text-xs">{planTarget.shopName} · {planTarget.email}</div>
                <div className="mt-1">{planBadge(planTarget.plan, planTarget.trialEndsAt, planTarget.subscriptionEndsAt)}</div>
              </div>
              {planAction !== "expire" && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {planAction === "activate" ? "Days to add" : "Trial extension (days)"}
                  </label>
                  <div className="flex gap-2 mb-2">
                    {(planAction === "activate" ? ["7", "15", "30", "90", "365"] : ["3", "7", "14", "30"]).map(d => (
                      <button
                        key={d}
                        onClick={() => setPlanDays(d)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${planDays === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    value={planDays}
                    onChange={e => setPlanDays(e.target.value)}
                    className="h-8 text-sm"
                    min="1"
                  />
                </div>
              )}
              {planAction === "expire" && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  This will immediately expire {planTarget.name}'s account. Their account and data are kept — they just lose access until reactivated.
                </div>
              )}
            </div>
          )}
          {actionError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">
              {actionError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setPlanTarget(null); setActionError(""); }}>Cancel</Button>
            <Button
              size="sm"
              variant={planAction === "expire" ? "destructive" : "default"}
              onClick={handlePlanAction}
              disabled={actionLoading !== null}
              className={planAction === "activate" ? "bg-green-600 hover:bg-green-700" : planAction === "extend_trial" ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {planAction === "activate" ? `Activate +${planDays}d` :
               planAction === "extend_trial" ? `Extend Trial +${planDays}d` :
               "Expire Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete user dialog ────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) { setDeleteTarget(null); setActionError(""); setDeleteConfirmText(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete User Account
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm">
                <div className="font-medium">{deleteTarget.name}</div>
                <div className="text-muted-foreground text-xs">{deleteTarget.shopName} · {deleteTarget.email}</div>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <strong>This action is permanent.</strong> The account and its business data will be deleted from the database. Their past payment/revenue records are kept for accounting but will no longer be linked to a live account.
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Type <strong className="text-destructive">DELETE</strong> to confirm
                </label>
                <Input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="h-8 text-sm"
                  autoComplete="off"
                />
              </div>
            </div>
          )}
          {actionError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">
              {actionError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDeleteTarget(null); setActionError(""); setDeleteConfirmText(""); }}>Cancel</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={actionLoading !== null || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Notes dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!notesTarget} onOpenChange={v => { if (!v) { setNotesTarget(null); setNotesError(""); setNewNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-primary" />
              Notes {notesTarget && `— ${notesTarget.name}`}
            </DialogTitle>
          </DialogHeader>
          {notesTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm">
                <div className="font-medium">{notesTarget.name}</div>
                <div className="text-muted-foreground text-xs">{notesTarget.shopName} · {notesTarget.email}</div>
              </div>
              <div className="space-y-2">
                <textarea
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                  rows={2}
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="e.g. Called Aug 1 — said they'll renew next week"
                />
                <Button size="sm" onClick={handleAddNote} disabled={noteSaving || !newNote.trim()}>
                  {noteSaving ? "Saving..." : "Add Note"}
                </Button>
              </div>
              {notesError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">
                  {notesError}
                </div>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notesLoading ? (
                  <p className="text-muted-foreground text-xs text-center py-4">Loading notes...</p>
                ) : notes.length === 0 ? (
                  <p className="text-muted-foreground text-xs text-center py-4">No notes yet.</p>
                ) : (
                  notes.map(n => (
                    <div key={n.id} className="p-2.5 rounded-lg bg-muted/30 border border-border text-xs space-y-1">
                      <p className="text-foreground whitespace-pre-wrap">{n.note}</p>
                      <div className="text-muted-foreground">{n.adminEmailSnapshot} · {fmt(n.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setNotesTarget(null); setNotesError(""); setNewNote(""); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset user password dialog ───────────────────────────────────── */}
      <Dialog open={!!resetTarget} onOpenChange={v => { if (!v) { setResetTarget(null); setResetError(""); setResetResult(null); setResetCustomPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          {resetTarget && !resetResult && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm">
                <div className="font-medium">{resetTarget.name}</div>
                <div className="text-muted-foreground text-xs">{resetTarget.shopName} · {resetTarget.email}</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Passwords can't be viewed — only reset. Leave the field below empty to generate a random temporary password, or set a specific one.
              </p>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">New password (optional, min 8 characters)</label>
                <Input
                  type="text"
                  value={resetCustomPassword}
                  onChange={e => setResetCustomPassword(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="h-8 text-sm font-mono"
                  autoComplete="off"
                />
              </div>
              {resetError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">
                  {resetError}
                </div>
              )}
            </div>
          )}
          {resetResult && (
            <div className="space-y-3">
              <div className="rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs px-3 py-2">
                Password reset. Share this with {resetTarget?.name} — it won't be shown again.
              </div>
              <div className="flex items-center justify-between gap-2 bg-muted/40 border border-border rounded-lg px-3 py-2">
                <span className="font-mono text-sm">{resetResult}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(resetResult); setResetCopied(true); setTimeout(() => setResetCopied(false), 1500); }}
                  className="text-muted-foreground hover:text-foreground"
                  title="Copy to clipboard"
                >
                  {resetCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {resetTarget?.mobile && (
                <button
                  onClick={() => {
                    const digits = resetTarget.mobile!.replace(/\D/g, "");
                    const fullMobile = digits.length === 10 ? `91${digits}` : digits;
                    const msg = `Hi ${resetTarget.name}, your SwarnDesk password has been reset. Your new temporary password is: ${resetResult}\nPlease sign in and change it as soon as possible.`;
                    window.open(`https://wa.me/${fullMobile}?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-green-400/50 text-green-700 hover:bg-green-50 transition-colors w-full justify-center"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Send via WhatsApp
                </button>
              )}
            </div>
          )}
          <DialogFooter>
            {resetResult ? (
              <Button size="sm" onClick={() => { setResetTarget(null); setResetResult(null); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => { setResetTarget(null); setResetError(""); }}>Cancel</Button>
                <Button size="sm" onClick={handleResetPassword} disabled={resetSaving}>
                  {resetSaving ? "Resetting..." : "Reset Password"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit user account details dialog ─────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={v => { if (!v) { setEditTarget(null); setEditError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Edit Account Details
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Email is this tenant's login — changing it takes effect immediately and is recorded in the activity log.
              </p>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Name</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Shop Name</label>
                <Input value={editShopName} onChange={e => setEditShopName(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Mobile</label>
                <Input value={editMobile} onChange={e => setEditMobile(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Email (login credential)</label>
                <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-8 text-sm" />
              </div>
              {editError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">
                  {editError}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setEditTarget(null); setEditError(""); }}>Cancel</Button>
            <Button size="sm" onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Admin's own change-password dialog ───────────────────────────── */}
      <Dialog open={changePwOpen} onOpenChange={v => { if (!v) { setChangePwOpen(false); setChangePwError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Change My Password
            </DialogTitle>
          </DialogHeader>
          {changePwSuccess ? (
            <div className="rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2.5 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Password changed successfully.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Current password</label>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="h-8 text-sm" autoComplete="current-password" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">New password (min 8 characters)</label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-8 text-sm" autoComplete="new-password" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Confirm new password</label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-8 text-sm" autoComplete="new-password" />
              </div>
              {changePwError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2">
                  {changePwError}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {changePwSuccess ? (
              <Button size="sm" onClick={() => setChangePwOpen(false)}>Close</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => { setChangePwOpen(false); setChangePwError(""); }}>Cancel</Button>
                <Button size="sm" onClick={handleChangeOwnPassword} disabled={changePwSaving || !currentPassword || !newPassword || !confirmPassword}>
                  {changePwSaving ? "Saving..." : "Change Password"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
