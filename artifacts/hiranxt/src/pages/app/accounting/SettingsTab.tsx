import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon } from "lucide-react";
import { apiGet, apiSend } from "./api";
import type { AccountingSettings } from "./types";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";

export default function SettingsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AccountingSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageHelpOpen, setPageHelpOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSettings(await apiGet<AccountingSettings>("/settings"));
    } catch {
      toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof AccountingSettings>(k: K, v: AccountingSettings[K]) => setSettings(s => s ? { ...s, [k]: v } : s);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await apiSend<AccountingSettings>("/settings", "PATCH", settings);
      toast({ title: "Accounting settings saved" });
      setSettings(updated);
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1";

  if (loading || !settings) return <div className="text-center py-12 text-muted-foreground text-sm">Loading settings...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" />
          Accounting Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Financial year, voucher numbering, and books lock date</p>
        <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-sm">Financial Year</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Financial Year Start Month</label>
            <input className={inp} type="number" min="1" max="12" value={settings.financialYearStartMonth} onChange={e => set("financialYearStartMonth", parseInt(e.target.value) || 4)} />
          </div>
          <div>
            <label className={lbl}>Books Locked Before (optional)</label>
            <input className={inp} type="date" value={settings.booksLockedBefore ? settings.booksLockedBefore.slice(0, 10) : ""} onChange={e => set("booksLockedBefore", e.target.value || null)} />
            <p className="text-xs text-muted-foreground mt-1">Once a period is reconciled, set this to prevent accidental backdated edits.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-sm">Voucher Numbering Prefixes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={lbl}>Journal Voucher Prefix</label><input className={inp} value={settings.journalPrefix} onChange={e => set("journalPrefix", e.target.value.toUpperCase())} /></div>
          <div><label className={lbl}>Receipt Voucher Prefix</label><input className={inp} value={settings.receiptPrefix} onChange={e => set("receiptPrefix", e.target.value.toUpperCase())} /></div>
          <div><label className={lbl}>Payment Voucher Prefix</label><input className={inp} value={settings.paymentPrefix} onChange={e => set("paymentPrefix", e.target.value.toUpperCase())} /></div>
          <p className="sm:col-span-3 text-xs text-muted-foreground">Numbers are sequential per financial year, e.g. {settings.journalPrefix}/2026-27/0001, and never reused.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
      </div>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Accounting Settings"
        description="Configuration for the accounting module specifically — separate from your main shop settings."
        sections={[
          {
            heading: "Financial Year",
            items: [
              "Financial Year Start Month — which month your accounting year begins (April = 4, the standard Indian FY)",
              "Books Locked Before — prevents edits to entries dated before this date, once a period is finalized/reconciled",
            ],
          },
          {
            heading: "Voucher Numbering Prefixes",
            items: ["Each voucher type gets its own sequential number per financial year, e.g. JV/2026-27/0001 — never reused"],
          },
        ]}
      />
    </div>
  );
}
