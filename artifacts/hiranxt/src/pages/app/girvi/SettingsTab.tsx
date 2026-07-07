import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Building2, Plus, Ban } from "lucide-react";
import { API, getAuthHeaders, authHeader } from "./api";
import type { GirviSettings, Branch } from "./types";

export default function SettingsTab({ branches, onBranchesChanged }: { branches: Branch[]; onBranchesChanged: () => void }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GirviSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [addingBranch, setAddingBranch] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/settings`, { headers: authHeader() });
      if (r.ok) setSettings(await r.json());
    } catch {
      toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof GirviSettings>(k: K, v: GirviSettings[K]) => setSettings(s => s ? { ...s, [k]: v } : s);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/settings`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(settings) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast({ title: "Girvi settings saved" });
      setSettings(await r.json());
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const addBranch = async () => {
    if (!newBranchName.trim()) return;
    setAddingBranch(true);
    try {
      const r = await fetch(`${API}/branches`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ name: newBranchName.trim() }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast({ title: "Branch added" });
      setNewBranchName("");
      onBranchesChanged();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" });
    } finally { setAddingBranch(false); }
  };

  const toggleBranch = async (b: Branch) => {
    try {
      const r = await fetch(`${API}/branches/${b.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ isActive: !b.isActive }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      onBranchesChanged();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" });
    }
  };

  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1";

  if (loading || !settings) return <div className="text-center py-12 text-muted-foreground text-sm">Loading settings...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" />
          Girvi Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Standalone settings for the Girvi module — shop identity, defaults, and voucher numbering</p>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-sm">Shop Identity (used on printed vouchers)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lbl}>Shop Name</label><input className={inp} value={settings.shopName} onChange={e => set("shopName", e.target.value)} /></div>
            <div><label className={lbl}>Owner Name</label><input className={inp} value={settings.ownerName ?? ""} onChange={e => set("ownerName", e.target.value)} /></div>
            <div><label className={lbl}>Pawnbroker License Number</label><input className={inp} value={settings.licenseNumber ?? ""} onChange={e => set("licenseNumber", e.target.value)} /></div>
            <div><label className={lbl}>GSTIN</label><input className={inp} value={settings.gstin ?? ""} onChange={e => set("gstin", e.target.value)} /></div>
            <div><label className={lbl}>PAN</label><input className={inp} value={settings.pan ?? ""} onChange={e => set("pan", e.target.value.toUpperCase())} /></div>
            <div><label className={lbl}>Mobile</label><input className={inp} value={settings.mobile ?? ""} onChange={e => set("mobile", e.target.value)} /></div>
            <div><label className={lbl}>Email</label><input className={inp} value={settings.email ?? ""} onChange={e => set("email", e.target.value)} /></div>
          </div>
          <div>
            <label className={lbl}>Address</label>
            <Textarea value={settings.address ?? ""} onChange={e => set("address", e.target.value)} rows={2} className="text-sm resize-y" />
          </div>
          <div>
            <label className={lbl}>Terms &amp; Conditions (one per line — shown on pledge vouchers)</label>
            <Textarea value={settings.termsAndConditions ?? ""} onChange={e => set("termsAndConditions", e.target.value)} rows={4} className="text-sm resize-y" placeholder="Leave blank to use the default terms" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-sm">Loan Defaults</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={lbl}>Default Interest Rate (%)</label><input className={inp} type="number" step="0.1" value={settings.defaultInterestRate} onChange={e => set("defaultInterestRate", parseFloat(e.target.value) || 0)} /></div>
          <div>
            <label className={lbl}>Default Interest Period</label>
            <Select value={settings.defaultInterestPeriod} onValueChange={v => set("defaultInterestPeriod", v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Per Day</SelectItem>
                <SelectItem value="weekly">Per Week</SelectItem>
                <SelectItem value="monthly">Per Month</SelectItem>
                <SelectItem value="yearly">Per Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><label className={lbl}>Default Penalty Rate (%)</label><input className={inp} type="number" step="0.1" value={settings.defaultPenaltyRate} onChange={e => set("defaultPenaltyRate", parseFloat(e.target.value) || 0)} /></div>
          <div><label className={lbl}>Default Loan Duration (days)</label><input className={inp} type="number" value={settings.defaultLoanDurationDays} onChange={e => set("defaultLoanDurationDays", parseInt(e.target.value) || 90)} /></div>
          <div><label className={lbl}>Cash Transaction Limit (₹) <span className="text-muted-foreground/60">Sec. 269ST awareness</span></label><input className={inp} type="number" value={settings.cashTransactionLimit} onChange={e => set("cashTransactionLimit", parseFloat(e.target.value) || 200000)} /></div>
          <div><label className={lbl}>Financial Year Start Month</label><input className={inp} type="number" min="1" max="12" value={settings.financialYearStartMonth} onChange={e => set("financialYearStartMonth", parseInt(e.target.value) || 4)} /></div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-sm">Voucher Numbering Prefixes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={lbl}>Loan Receipt Prefix</label><input className={inp} value={settings.receiptPrefix} onChange={e => set("receiptPrefix", e.target.value.toUpperCase())} /></div>
          <div><label className={lbl}>Return Voucher Prefix</label><input className={inp} value={settings.returnPrefix} onChange={e => set("returnPrefix", e.target.value.toUpperCase())} /></div>
          <div><label className={lbl}>Transfer Voucher Prefix</label><input className={inp} value={settings.transferPrefix} onChange={e => set("transferPrefix", e.target.value.toUpperCase())} /></div>
          <p className="sm:col-span-3 text-xs text-muted-foreground">Numbers are sequential per financial year, e.g. {settings.receiptPrefix}/2026-27/0001, and never reused.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
      </div>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />Branches</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            {branches.map(b => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{b.name}</span>
                  {b.isDefault && <Badge variant="outline" className="text-[10px]">Default</Badge>}
                  {!b.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                </div>
                {!b.isDefault && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => toggleBranch(b)}>
                    <Ban className="w-3 h-3" />{b.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inp} value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="New branch name" />
            <Button size="sm" onClick={addBranch} disabled={addingBranch || !newBranchName.trim()} className="gap-1.5 flex-shrink-0">
              <Plus className="w-3.5 h-3.5" />Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
