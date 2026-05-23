import { useEffect, useState } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { Settings as SettingsIcon, Building2, Percent, GitBranch, MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { register, handleSubmit, reset } = useForm<SettingsForm>();

  const [waConfig, setWaConfig] = useState<WaConfig>({ enabled: false, phoneNumberId: "", accessToken: "" });
  const [waSaving, setWaSaving] = useState(false);
  const [waTestStatus, setWaTestStatus] = useState<"idle" | "ok" | "fail">("idle");

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
        headers: { "Content-Type": "application/json" },
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Configure your business profile</p>
      </div>

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
            Connect Meta's WhatsApp Business Cloud API to send automated reminders and bulk CRM messages directly from HiraNXT.
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
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${waConfig.enabled ? "left-5.5 left-[22px]" : "left-0.5"}`} />
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
    </div>
  );
}
