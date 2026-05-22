import { useEffect } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { Settings as SettingsIcon, Building2, Percent, GitBranch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SettingsForm {
  businessName: string; gstin: string; address: string;
  mobile: string; email: string; gstRate: number; defaultBranch: string;
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { register, handleSubmit, reset } = useForm<SettingsForm>();

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
    </div>
  );
}
