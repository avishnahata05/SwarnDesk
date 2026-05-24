import { useEffect, useState } from "react";
import { useGetSettings, useUpdateSettings, useGetCurrentRates, useUpdateRates, getGetSettingsQueryKey, getGetCurrentRatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { Settings as SettingsIcon, Building2, Percent, GitBranch, MessageCircle, CheckCircle2, AlertCircle, Coins, Download, FileSpreadsheet, CreditCard, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("swarndesk_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface SettingsForm {
  businessName: string; gstin: string; address: string;
  mobile: string; email: string; gstRate: number; defaultBranch: string;
}

interface WaConfig {
  enabled: boolean;
  phoneNumberId: string;
  accessToken: string;
}

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { register, handleSubmit, reset } = useForm<SettingsForm>();

  const { data: currentRates } = useGetCurrentRates();
  const updateRates = useUpdateRates();
  const [rateForm, setRateForm] = useState({ gold22k: "", gold24k: "", gold18k: "", silver: "" });
  const [ratesSaving, setRatesSaving] = useState(false);

  const [waConfig, setWaConfig] = useState<WaConfig>({ enabled: false, phoneNumberId: "", accessToken: "" });
  const [waSaving, setWaSaving] = useState(false);
  const [waTestStatus, setWaTestStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    if (currentRates) {
      setRateForm({
        gold22k: String(Math.round(currentRates.gold22k * 10)),
        gold24k: String(Math.round(currentRates.gold24k * 10)),
        gold18k: String(Math.round(currentRates.gold18k * 10)),
        silver: String(Math.round(currentRates.silver * 1000)),
      });
    }
  }, [currentRates]);

  useEffect(() => {
    if (settings) {
      reset({
        businessName: settings.businessName,
        gstin: settings.gstin,
        address: settings.address,
        mobile: settings.mobile,
        email: settings.email ?? "",
        gstRate: settings.gstRate,
        defaultBranch: settings.defaultBranch,
      });
      setWaConfig({
        enabled: (settings as unknown as { whatsappApiEnabled?: boolean }).whatsappApiEnabled ?? false,
        phoneNumberId: (settings as unknown as { whatsappPhoneNumberId?: string }).whatsappPhoneNumberId ?? "",
        accessToken: (settings as unknown as { whatsappAccessToken?: string }).whatsappAccessToken ?? "",
      });
    }
  }, [settings, reset]);

  const saveRates = () => {
    const payload: Record<string, number> = {};
    if (rateForm.gold22k) payload.gold22k = parseFloat(rateForm.gold22k) / 10;
    if (rateForm.gold24k) payload.gold24k = parseFloat(rateForm.gold24k) / 10;
    if (rateForm.gold18k) payload.gold18k = parseFloat(rateForm.gold18k) / 10;
    if (rateForm.silver) payload.silver = parseFloat(rateForm.silver) / 1000;
    setRatesSaving(true);
    updateRates.mutate({ data: payload }, {
      onSuccess: (updated) => {
        localStorage.setItem("sd_gold22k", updated.gold22k.toString());
        localStorage.setItem("sd_silver", updated.silver.toString());
        queryClient.invalidateQueries({ queryKey: getGetCurrentRatesQueryKey() });
        toast({ title: "Metal rates updated successfully" });
        setRatesSaving(false);
      },
      onError: () => {
        toast({ title: "Failed to update rates", variant: "destructive" });
        setRatesSaving(false);
      },
    });
  };

  const onSubmit = (data: SettingsForm) => {
    updateSettings.mutate({
      data: {
        businessName: data.businessName,
        gstin: data.gstin,
        address: data.address,
        mobile: data.mobile,
        email: data.email || null,
        gstRate: parseFloat(String(data.gstRate)),
        defaultBranch: data.defaultBranch,
        branches: [data.defaultBranch],
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved" });
      },
      onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
    });
  };

  const saveWaConfig = async () => {
    setWaSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          whatsappApiEnabled: waConfig.enabled,
          whatsappPhoneNumberId: waConfig.phoneNumberId,
          whatsappAccessToken: waConfig.accessToken || undefined,
        }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "WhatsApp API settings saved" });
      setWaTestStatus("idle");
    } catch {
      toast({ title: "Failed to save WhatsApp settings", variant: "destructive" });
    } finally {
      setWaSaving(false);
    }
  };

  const exportToCsv = (filename: string, data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) {
      toast({ title: "No data to export", variant: "destructive" }); return;
    }
    const headers = Object.keys(data[0]);
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    };
    const rows = [headers.join(","), ...data.map(r => headers.map(h => escape(r[h])).join(","))];
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 200);
  };

  const EXPORT_PARAMS: Record<string, string> = {
    inventory: "?limit=2000",
    sales: "?limit=5000",
  };

  const exportModule = async (endpoint: string, label: string) => {
    setExporting(endpoint);
    try {
      const token = localStorage.getItem("swarndesk_token");
      const params = EXPORT_PARAMS[endpoint] ?? "";
      const r = await fetch(`/api/${endpoint}${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
      }
      const data = await r.json();
      if (!Array.isArray(data) || data.length === 0) {
        toast({ title: `No ${label} data to export`, description: "Add some records first.", variant: "destructive" }); return;
      }
      const date = new Date().toISOString().split("T")[0];
      exportToCsv(`swarndesk-${endpoint}-${date}.csv`, data);
      toast({ title: `${label} exported`, description: `${data.length} records saved as CSV` });
    } catch (err) {
      toast({ title: `Failed to export ${label}`, description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const testWaConfig = async () => {
    if (!waConfig.phoneNumberId || !waConfig.accessToken) {
      toast({ title: "Enter Phone Number ID and Access Token first", variant: "destructive" }); return;
    }
    try {
      const r = await fetch(
        `https://graph.facebook.com/v18.0/${waConfig.phoneNumberId}`,
        { headers: { Authorization: `Bearer ${waConfig.accessToken}` } }
      );
      setWaTestStatus(r.ok ? "ok" : "fail");
      toast({ title: r.ok ? "Connection successful!" : "Invalid credentials — check your Phone Number ID and token", variant: r.ok ? "default" : "destructive" });
    } catch {
      setWaTestStatus("fail");
      toast({ title: "Could not reach WhatsApp API", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  // Compute subscription status for the card
  const subStatus = (() => {
    if (!user || user.role === "admin") return null;
    const now = Date.now();
    if (user.plan === "trial") {
      const daysLeft = Math.ceil((new Date(user.trialEndsAt).getTime() - now) / 86400000);
      return { type: "trial" as const, daysLeft, endsAt: user.trialEndsAt };
    }
    if (user.plan === "active" && user.subscriptionEndsAt) {
      const daysLeft = Math.ceil((new Date(user.subscriptionEndsAt).getTime() - now) / 86400000);
      return { type: "active" as const, daysLeft, endsAt: user.subscriptionEndsAt };
    }
    if (user.plan === "expired") {
      return { type: "expired" as const, daysLeft: 0, endsAt: null };
    }
    return null;
  })();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Configure your business profile</p>
      </div>

      {/* Subscription Status Card */}
      {subStatus && (
        <Card className={`border-2 ${
          subStatus.type === "expired" ? "border-destructive/50 bg-destructive/5" :
          subStatus.daysLeft <= 7 ? "border-amber-400/50 bg-amber-50/50" :
          "border-green-400/30 bg-green-50/30"
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {subStatus.type === "expired" ? (
                  <Badge variant="destructive">Expired</Badge>
                ) : subStatus.type === "trial" ? (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">Free Trial</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                )}
                {subStatus.endsAt && (
                  <span className="text-xs text-muted-foreground">
                    {subStatus.type === "trial" ? "Trial ends:" : "Renews/expires:"}{" "}
                    <strong>{new Date(subStatus.endsAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong>
                  </span>
                )}
              </div>
              {subStatus.type !== "expired" && subStatus.daysLeft > 0 && (
                <div className={`flex items-center gap-1.5 text-sm font-semibold ${
                  subStatus.daysLeft <= 3 ? "text-red-600" :
                  subStatus.daysLeft <= 7 ? "text-amber-700" : "text-green-700"
                }`}>
                  {subStatus.daysLeft <= 7 ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {subStatus.daysLeft} day{subStatus.daysLeft !== 1 ? "s" : ""} remaining
                </div>
              )}
            </div>
            {(subStatus.type === "expired" || subStatus.daysLeft <= 7) && (
              <div className={`p-3 rounded-lg text-xs ${subStatus.type === "expired" || subStatus.daysLeft <= 3 ? "bg-red-50 border border-red-200 text-red-700" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
                {subStatus.type === "expired"
                  ? "Your access has expired. Pay to restore access immediately."
                  : `Your ${subStatus.type === "trial" ? "trial" : "subscription"} ends in ${subStatus.daysLeft} day${subStatus.daysLeft !== 1 ? "s" : ""}. Renew to avoid interruption.`}
              </div>
            )}
            <div className="pt-1 border-t border-border/50">
              <div className="text-xs text-muted-foreground mb-2">Plans: ₹2,999/month · ₹7,999/quarter · ₹29,999/year</div>
              <Link href="/payment">
                <Button size="sm" className="gap-1.5 text-xs h-8">
                  <CreditCard className="w-3.5 h-3.5" />
                  {subStatus.type === "active" ? "Renew / Upgrade" : "Subscribe Now"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Business Profile */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />Business Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Business Name *</label>
              <Input {...register("businessName")} data-testid="input-business-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">GSTIN</label>
                <Input {...register("gstin")} placeholder="27AAACR5055K1ZS" data-testid="input-gstin" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mobile</label>
                <Input {...register("mobile")} data-testid="input-mobile" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <Input {...register("email")} type="email" data-testid="input-email" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Address</label>
              <Input {...register("address")} data-testid="input-address" />
            </div>
          </CardContent>
        </Card>

        {/* Metal Rates */}
        <Card className="border-border border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600" />
              Today's Metal Rates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Check your <strong>local sarafa / bullion market</strong> rates each morning and update here manually. Enter gold <strong>per 10 grams</strong> and silver <strong>per kg</strong>.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Gold 22K (₹/10g)", key: "gold22k", placeholder: "e.g. 72500" },
                { label: "Gold 24K (₹/10g)", key: "gold24k", placeholder: "e.g. 79500" },
                { label: "Gold 18K (₹/10g)", key: "gold18k", placeholder: "e.g. 59400" },
                { label: "Silver (₹/kg)", key: "silver", placeholder: "e.g. 95000" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                  <Input
                    type="number"
                    step="1"
                    value={rateForm[key as keyof typeof rateForm]}
                    onChange={e => setRateForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    data-testid={`input-rate-${key}`}
                  />
                </div>
              ))}
            </div>
            {currentRates && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(currentRates.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            <Button type="button" onClick={saveRates} disabled={ratesSaving} className="gap-2" data-testid="button-save-rates">
              <Coins className="w-4 h-4" />
              {ratesSaving ? "Saving..." : "Update Metal Rates"}
            </Button>
          </CardContent>
        </Card>

        {/* Tax Settings */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />Tax Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">GST Rate (%)</label>
              <Input type="number" step="0.1" {...register("gstRate")} data-testid="input-gst-rate" />
              <p className="text-xs text-muted-foreground mt-1">Standard rate for jewellery is 3%</p>
            </div>
          </CardContent>
        </Card>

        {/* Branch Settings */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />Branch Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Default Branch</label>
              <Input {...register("defaultBranch")} data-testid="input-default-branch" />
            </div>
            {settings?.branches && settings.branches.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Current Branches</label>
                <div className="flex flex-wrap gap-2">
                  {settings.branches.map(b => (
                    <div key={b} className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary">{b}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Roles */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-primary" />User Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { role: "Admin", desc: "Full access to all modules", active: true },
                { role: "Salesperson", desc: "Billing, inventory view, customer management", active: true },
                { role: "Accountant", desc: "Reports, purchases, ledger access", active: false },
              ].map(r => (
                <div key={r.role} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <div className="text-sm font-medium">{r.role}</div>
                    <div className="text-xs text-muted-foreground">{r.desc}</div>
                  </div>
                  <div className={`text-xs font-medium ${r.active ? "text-green-400" : "text-muted-foreground"}`}>
                    {r.active ? "Active" : "Inactive"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={updateSettings.isPending} className="w-full" data-testid="button-save-settings">
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>

      {/* WhatsApp Business API — separate save */}
      <Card className="border-border border-green-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-400" />
            WhatsApp Business API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Connect Meta's WhatsApp Business Cloud API to send automated reminders and bulk CRM messages directly from SwarnDesk.
            Get your credentials from <span className="text-primary">Meta for Developers → WhatsApp → API Setup</span>.
          </p>

          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <div className="text-sm font-medium">Enable WhatsApp API</div>
              <div className="text-xs text-muted-foreground">Send messages programmatically via Meta Cloud API</div>
            </div>
            <button
              type="button"
              onClick={() => setWaConfig(c => ({ ...c, enabled: !c.enabled }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${waConfig.enabled ? "bg-green-500" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${waConfig.enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone Number ID</label>
              <Input
                value={waConfig.phoneNumberId}
                onChange={e => setWaConfig(c => ({ ...c, phoneNumberId: e.target.value }))}
                placeholder="e.g. 123456789012345"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-0.5">Found in Meta for Developers → WhatsApp → API Setup</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Permanent Access Token
                {waConfig.accessToken && <span className="text-green-400 ml-2">● Saved</span>}
              </label>
              <Input
                type="password"
                value={waConfig.accessToken}
                onChange={e => setWaConfig(c => ({ ...c, accessToken: e.target.value }))}
                placeholder="Enter new token to update (leave blank to keep existing)"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-0.5">Create a permanent token in System User settings to avoid expiry</p>
            </div>
          </div>

          {waTestStatus !== "idle" && (
            <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${waTestStatus === "ok" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
              {waTestStatus === "ok" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {waTestStatus === "ok" ? "WhatsApp API connected successfully." : "Invalid credentials. Check Phone Number ID and access token."}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={testWaConfig} className="gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              Test Connection
            </Button>
            <Button type="button" size="sm" onClick={saveWaConfig} disabled={waSaving} className="gap-1.5 bg-green-600 hover:bg-green-700">
              {waSaving ? "Saving..." : "Save WhatsApp Config"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/20 border border-border space-y-1">
            <div className="font-medium text-foreground mb-1">How to set up WhatsApp Business API:</div>
            <div>1. Go to <strong>developers.facebook.com</strong> → My Apps → Create App → Business</div>
            <div>2. Add WhatsApp product → Go to API Setup</div>
            <div>3. Copy the <strong>Phone Number ID</strong> (not the phone number itself)</div>
            <div>4. Create a <strong>System User</strong> with admin role → Generate permanent token</div>
            <div>5. Paste both above and click Save WhatsApp Config</div>
          </div>
        </CardContent>
      </Card>
      {/* Export Data */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Export Data to Excel / CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Download any module as a CSV file. Open it directly in Microsoft Excel, Google Sheets, or any spreadsheet app.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { key: "inventory", label: "Inventory" },
              { key: "customers", label: "Customers" },
              { key: "sales", label: "Sales" },
              { key: "purchases", label: "Purchases" },
              { key: "repairs", label: "Repairs" },
              { key: "karigars", label: "Karigars" },
              { key: "girvi", label: "Girvi Loans" },
            ].map(({ key, label }) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 justify-start text-xs"
                disabled={exporting === key}
                onClick={() => exportModule(key, label)}
                data-testid={`button-export-${key}`}
              >
                <Download className="w-3 h-3 shrink-0" />
                {exporting === key ? "Exporting..." : label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Files are named with today's date, e.g. <span className="font-mono">swarndesk-inventory-2026-05-23.csv</span></p>
        </CardContent>
      </Card>
    </div>
  );
}
