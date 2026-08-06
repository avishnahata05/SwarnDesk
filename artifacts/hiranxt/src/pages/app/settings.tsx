import { useEffect, useState } from "react";
import { useGetSettings, useUpdateSettings, useGetCurrentRates, useUpdateRates, getGetSettingsQueryKey, getGetCurrentRatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { Settings as SettingsIcon, Building2, Percent, GitBranch, MessageCircle, CheckCircle2, AlertCircle, Coins, Download, FileSpreadsheet, CreditCard, Clock, AlertTriangle, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { useMetalRateForm } from "@/hooks/use-metal-rate-form";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";
import StaffRolesCard from "@/components/StaffRolesCard";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("swarndesk_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface SettingsForm {
  businessName: string; gstin: string; address: string;
  mobile: string; email: string; gstRate: number; stateCode: string;
  gstOnExchangeEnabled: boolean; cashTransactionLimit: number; defaultBranch: string;
}

interface WaConfig {
  enabled: boolean;
  phoneNumberId: string;
  accessToken: string;
}

interface LoyaltyConfig {
  enabled: boolean;
  rate: string; // ₹ a customer must spend to earn 1 point
}

export default function Settings() {
  const { toast } = useToast();
  const { user, isShopAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { register, handleSubmit, reset } = useForm<SettingsForm>();

  const { data: currentRates } = useGetCurrentRates();
  const updateRates = useUpdateRates();
  const { rateForm, setGoldRate, setSilver, buildRatePayload } = useMetalRateForm(currentRates);

  const [waConfig, setWaConfig] = useState<WaConfig>({ enabled: false, phoneNumberId: "", accessToken: "" });
  const [waSaving, setWaSaving] = useState(false);
  const [waTestStatus, setWaTestStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [exporting, setExporting] = useState<string | null>(null);

  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig>({ enabled: true, rate: "1000" });
  const [loyaltySaving, setLoyaltySaving] = useState(false);
  const [pageHelpOpen, setPageHelpOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      reset({
        businessName: settings.businessName,
        gstin: settings.gstin,
        address: settings.address,
        mobile: settings.mobile,
        email: settings.email ?? "",
        gstRate: settings.gstRate,
        stateCode: settings.stateCode ?? "",
        gstOnExchangeEnabled: settings.gstOnExchangeEnabled ?? true,
        cashTransactionLimit: settings.cashTransactionLimit ?? 200000,
        defaultBranch: settings.defaultBranch,
      });
      setWaConfig(prev => ({
        enabled: settings.whatsappApiEnabled ?? false,
        phoneNumberId: settings.whatsappPhoneNumberId ?? "",
        accessToken: prev.accessToken, // never overwrite what the user typed; token is not returned by API
      }));
      setLoyaltyConfig({
        enabled: settings.loyaltyPointsEnabled ?? true,
        rate: String(settings.loyaltyPointsRate ?? 1000),
      });
    }
  }, [settings, reset]);

  const saveRates = () => {
    const payload = buildRatePayload();
    if (Object.keys(payload).length === 0) {
      toast({ title: "Enter at least one valid rate", variant: "destructive" }); return;
    }
    updateRates.mutate({ data: payload }, {
      onSuccess: (updated) => {
        localStorage.setItem("sd_gold22k", updated.gold22k.toString());
        localStorage.setItem("sd_silver", updated.silver.toString());
        queryClient.invalidateQueries({ queryKey: getGetCurrentRatesQueryKey() });
        toast({ title: "Metal rates updated successfully" });
      },
      onError: () => toast({ title: "Failed to update rates", variant: "destructive" }),
    });
  };

  const onSubmit = (data: SettingsForm) => {
    // Preserve existing branches and ensure the new default branch is included
    const existingBranches = settings?.branches ?? [];
    const updatedBranches = [...new Set([...existingBranches, data.defaultBranch])];
    updateSettings.mutate({
      data: {
        businessName: data.businessName,
        gstin: data.gstin,
        address: data.address,
        mobile: data.mobile,
        email: data.email || null,
        gstRate: parseFloat(String(data.gstRate)),
        stateCode: data.stateCode || null,
        gstOnExchangeEnabled: !!data.gstOnExchangeEnabled,
        cashTransactionLimit: parseFloat(String(data.cashTransactionLimit)) || 200000,
        defaultBranch: data.defaultBranch,
        branches: updatedBranches,
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

  const saveLoyaltyConfig = async () => {
    const rate = parseFloat(loyaltyConfig.rate);
    if (loyaltyConfig.enabled && (!isFinite(rate) || rate <= 0)) {
      toast({ title: "Enter a valid positive amount per point", variant: "destructive" });
      return;
    }
    setLoyaltySaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          loyaltyPointsEnabled: loyaltyConfig.enabled,
          loyaltyPointsRate: rate,
        }),
      });
      if (!r.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Loyalty points settings saved" });
    } catch {
      toast({ title: "Failed to save loyalty points settings", variant: "destructive" });
    } finally {
      setLoyaltySaving(false);
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
        <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
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
                    {subStatus.type === "trial" ? "Trial ends:" : "Valid until:"}{" "}
                    <strong>{new Date(subStatus.endsAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong>
                    {subStatus.type !== "trial" && " — renew manually before this date to avoid interruption"}
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
              <div className="text-xs text-muted-foreground mb-2">Choose one billing cycle: ₹2,999/month · ₹7,999/quarter · ₹29,999/year</div>
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
                <Input {...register("gstin")} placeholder="22AAAAA0000A1Z5" data-testid="input-gstin" />
                <p className="text-xs text-muted-foreground mt-0.5">15-character GST number, e.g. 22AAAAA0000A1Z5 (leave blank if you don't have GST registration yet)</p>
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
                { label: "Gold 24K (₹/10g)", key: "gold24k", placeholder: "e.g. 79500" },
                { label: "Gold 22K (₹/10g)", key: "gold22k", placeholder: "e.g. 72500" },
                { label: "Gold 18K (₹/10g)", key: "gold18k", placeholder: "e.g. 59400" },
                { label: "Silver (₹/kg)", key: "silver", placeholder: "e.g. 95000" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                  <Input
                    type="number"
                    step="1"
                    value={rateForm[key as keyof typeof rateForm]}
                    onChange={e => key === "silver" ? setSilver(e.target.value) : setGoldRate(key as "gold22k" | "gold24k" | "gold18k", e.target.value)}
                    placeholder={placeholder}
                    data-testid={`input-rate-${key}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Enter any one gold rate and the other karats auto-fill from it — edit any field afterward to override.
            </p>
            <p className="text-xs text-amber-700">
              Auto-filled values overwrite existing 18K/24K rates — double check before saving.
            </p>
            {currentRates && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(currentRates.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            <Button type="button" onClick={saveRates} disabled={updateRates.isPending} className="gap-2" data-testid="button-save-rates">
              <Coins className="w-4 h-4" />
              {updateRates.isPending ? "Saving..." : "Update Metal Rates"}
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
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">GST State Code</label>
              <Input maxLength={2} placeholder="e.g. 27 (Maharashtra)" {...register("stateCode")} data-testid="input-state-code" />
              <p className="text-xs text-muted-foreground mt-1">Used to tell intra-state (CGST+SGST) from inter-state (IGST) sales — leave blank to always assume intra-state.</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="gst-on-exchange" className="h-4 w-4" {...register("gstOnExchangeEnabled")} data-testid="checkbox-gst-on-exchange" />
              <label htmlFor="gst-on-exchange" className="text-xs text-muted-foreground">Net old-gold exchange value out of the taxable base (uncheck to tax the full pre-exchange value instead)</label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cash Transaction Limit (₹)</label>
              <Input type="number" step="1000" {...register("cashTransactionLimit")} data-testid="input-cash-limit" />
              <p className="text-xs text-muted-foreground mt-1">Same-day cash receipts above this amount are flagged for TCS/Sec. 269ST awareness (informational only).</p>
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

        <Button type="submit" disabled={updateSettings.isPending} className="w-full" data-testid="button-save-settings">
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>

      {/* Staff & Roles — separate save, only shown to the owner/admin (route+API already
          gate this, but hiding it here avoids showing a card whose actions would all 403). */}
      {isShopAdmin && <StaffRolesCard />}

      {/* WhatsApp Business API — separate save */}
      <Card className="border-border border-green-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-400" />
            WhatsApp Business API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            This is an advanced/optional feature — if you're not comfortable with these steps, ask a tech-savvy friend or contact WhatsApp Support (see sidebar) for help setting this up. Without it, WhatsApp messages still work via normal WhatsApp links — this just adds the ability to send them automatically without opening WhatsApp each time.
          </p>
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
                {(waConfig.accessToken || (settings as unknown as { hasAccessToken?: boolean }).hasAccessToken) && (
                  <span className="text-green-400 ml-2">● Saved</span>
                )}
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

      {/* Loyalty Points — optional, purchases only (not Girvi loans) */}
      <Card className="border-border border-amber-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Loyalty Points Program
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Reward customers with points on purchases (Sales only — Girvi loan payments never earn points).
            Points accrue automatically on the customer's profile when a sale is linked to their record.
          </p>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <div className="text-sm font-medium">Enable Loyalty Points</div>
              <div className="text-xs text-muted-foreground">Turn off to stop earning points on new sales — existing points are kept either way</div>
            </div>
            <button
              type="button"
              onClick={() => setLoyaltyConfig(c => ({ ...c, enabled: !c.enabled }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${loyaltyConfig.enabled ? "bg-amber-500" : "bg-muted"}`}
              data-testid="toggle-loyalty-enabled"
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${loyaltyConfig.enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>

          {loyaltyConfig.enabled && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">₹ spent per 1 point earned</label>
              <Input
                type="number"
                min="1"
                value={loyaltyConfig.rate}
                onChange={e => setLoyaltyConfig(c => ({ ...c, rate: e.target.value }))}
                placeholder="1000"
                className="max-w-[160px]"
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                e.g. 1000 means a customer earns 1 point for every ₹1,000 spent on a linked sale.
              </p>
            </div>
          )}

          <Button type="button" size="sm" onClick={saveLoyaltyConfig} disabled={loyaltySaving} className="gap-1.5 bg-amber-500 hover:bg-amber-600">
            {loyaltySaving ? "Saving..." : "Save Loyalty Settings"}
          </Button>
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

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Settings"
        description="Shop-wide configuration — your business identity, tax rules, metal rates, branches, and integrations. Changes here affect the whole app, not just one page."
        sections={[
          { heading: "Subscription Status", items: ["Your current plan and billing status"] },
          { heading: "Business Profile", items: ["Shop name, address, contact details, and GSTIN — printed on invoices and used across the app"] },
          { heading: "Today's Metal Rates", items: ["Set today's gold/silver rate per gram — used to price new inventory and live valuations everywhere"] },
          { heading: "Tax Settings", items: ["GST rate, your state code (for CGST/SGST vs IGST), and whether GST applies to old-gold exchange value"] },
          { heading: "Branch Settings", items: ["Manage which branch is the default for new entries if you operate more than one location"] },
          { heading: "User Roles", items: ["Control what staff logins can see and do"] },
          { heading: "WhatsApp Business API", items: ["Connect a WhatsApp Business account to send messages automatically instead of opening chat links manually"] },
          { heading: "Loyalty Points Program", items: ["Turn on customer loyalty points and set how much spend earns 1 point"] },
          { heading: "Export Data to Excel / CSV", items: ["Download a full backup/export of any module's data as a spreadsheet"] },
        ]}
      />
    </div>
  );
}
