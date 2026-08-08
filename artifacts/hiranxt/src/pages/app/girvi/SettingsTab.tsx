import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Building2, Plus, Ban, Star, AlertTriangle, Pencil } from "lucide-react";
import { API, getAuthHeaders, authHeader } from "./api";
import type { GirviSettings, Branch } from "./types";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function SettingsTab({ branches, onBranchesChanged, onDirtyChange }: { branches: Branch[]; onBranchesChanged: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GirviSettings | null>(null);
  const savedRef = useRef<GirviSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [addingBranch, setAddingBranch] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Branch | null>(null);
  const [pageHelpOpen, setPageHelpOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [editBranchName, setEditBranchName] = useState("");
  const [editBranchAddress, setEditBranchAddress] = useState("");
  const [editBranchPhone, setEditBranchPhone] = useState("");
  const [savingBranch, setSavingBranch] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/settings`, { headers: authHeader() });
      if (r.ok) { const data = await r.json(); setSettings(data); savedRef.current = data; }
    } catch {
      toast({ title: "Network error — please check your connection", variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Radix Tabs unmounts inactive tab content, so edits made here and never
  // saved were previously lost with zero warning the moment the shop owner
  // clicked another tab. Report dirty state up so the parent can confirm
  // before switching away, and guard the hard-refresh/close-tab case directly.
  const dirty = !!settings && !!savedRef.current && JSON.stringify(settings) !== JSON.stringify(savedRef.current);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

  const set = <K extends keyof GirviSettings>(k: K, v: GirviSettings[K]) => setSettings(s => s ? { ...s, [k]: v } : s);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/settings`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(settings) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast({ title: "Girvi settings saved" });
      const saved = await r.json();
      setSettings(saved);
      savedRef.current = saved;
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
    } finally {
      setDeactivateTarget(null);
    }
  };

  const requestDeactivate = (b: Branch) => {
    if (b.activeLoanCount > 0) { setDeactivateTarget(b); return; }
    toggleBranch(b);
  };

  const setDefaultBranch = async (b: Branch) => {
    try {
      const r = await fetch(`${API}/branches/${b.id}/set-default`, { method: "POST", headers: getAuthHeaders() });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast({ title: `${b.name} is now the default branch` });
      onBranchesChanged();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" });
    }
  };

  const openEditBranch = (b: Branch) => {
    setEditBranch(b);
    setEditBranchName(b.name);
    setEditBranchAddress(b.address ?? "");
    setEditBranchPhone(b.phone ?? "");
  };

  const saveEditBranch = async () => {
    if (!editBranch || !editBranchName.trim()) return;
    setSavingBranch(true);
    try {
      const r = await fetch(`${API}/branches/${editBranch.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: editBranchName.trim(), address: editBranchAddress.trim() || null, phone: editBranchPhone.trim() || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      toast({ title: "Branch updated" });
      setEditBranch(null);
      onBranchesChanged();
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" });
    } finally { setSavingBranch(false); }
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
        <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
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
          <div>
            <label className={lbl}>Financial Year Start Month</label>
            <Select value={String(settings.financialYearStartMonth)} onValueChange={v => set("financialYearStartMonth", parseInt(v))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => <SelectItem key={name} value={String(i + 1)}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Overdue Grace Period (days)</label>
            <input className={inp} type="number" min="0" value={settings.overdueGraceDays} onChange={e => set("overdueGraceDays", Math.max(0, parseInt(e.target.value) || 0))} />
            <p className="text-xs text-muted-foreground mt-1">
              No lender charges interest to the exact day — a customer a few days late is routinely let off. Penalty interest
              won't start accruing until a loan is this many days past its due date. Beyond that, interest does accrue, but you
              can still choose to waive it for a specific customer when collecting interest or redeeming (e.g. someone 15 days
              late — your call whether to charge for it).
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Forfeiture Notice Period (days)</label>
            <input className={inp} type="number" min="0" value={settings.forfeitureNoticeDays} onChange={e => set("forfeitureNoticeDays", Math.max(0, parseInt(e.target.value) || 0))} />
            <p className="text-xs text-muted-foreground mt-1">
              Before an overdue loan can be forfeited, a notice must be sent to the customer and this many days must pass. Adjust
              to match your state's Pawnbrokers Act or your own policy — this app doesn't enforce a specific statutory figure.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader><CardTitle className="text-sm">Voucher Numbering Prefixes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div><label className={lbl}>Loan Receipt Prefix</label><input className={inp} value={settings.receiptPrefix} onChange={e => set("receiptPrefix", e.target.value.toUpperCase())} /></div>
          <div><label className={lbl}>Return Voucher Prefix</label><input className={inp} value={settings.returnPrefix} onChange={e => set("returnPrefix", e.target.value.toUpperCase())} /></div>
          <div><label className={lbl}>Transfer Voucher Prefix</label><input className={inp} value={settings.transferPrefix} onChange={e => set("transferPrefix", e.target.value.toUpperCase())} /></div>
          <div><label className={lbl}>Partial Release Prefix</label><input className={inp} value={settings.partialReleasePrefix} onChange={e => set("partialReleasePrefix", e.target.value.toUpperCase())} /></div>
          <div><label className={lbl}>Forfeiture Notice Prefix</label><input className={inp} value={settings.noticePrefix} onChange={e => set("noticePrefix", e.target.value.toUpperCase())} /></div>
          <p className="sm:col-span-4 text-xs text-muted-foreground">Numbers are sequential per financial year, e.g. {settings.receiptPrefix}/2026-27/0001, and never reused.</p>
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
                  {b.activeLoanCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">{b.activeLoanCount} active loan{b.activeLoanCount !== 1 ? "s" : ""}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => openEditBranch(b)}>
                    <Pencil className="w-3 h-3" />Edit
                  </Button>
                  {!b.isDefault && b.isActive && (
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setDefaultBranch(b)}>
                      <Star className="w-3 h-3" />Set as Default
                    </Button>
                  )}
                  {!b.isDefault && (
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => requestDeactivate(b)}>
                      <Ban className="w-3 h-3" />{b.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </div>
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

      <Dialog open={!!deactivateTarget} onOpenChange={v => { if (!v) setDeactivateTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-amber-700"><AlertTriangle className="w-4 h-4" />Deactivate Branch</DialogTitle></DialogHeader>
          {deactivateTarget && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{deactivateTarget.name}</strong> currently has <strong>{deactivateTarget.activeLoanCount}</strong> active loan{deactivateTarget.activeLoanCount !== 1 ? "s" : ""} pledged at it. Deactivating hides it from the branch picker on new loans, but existing loans stay assigned to it.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={() => toggleBranch(deactivateTarget)}>Deactivate Anyway</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editBranch} onOpenChange={v => { if (!v) setEditBranch(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" />Edit Branch</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className={lbl}>Branch Name *</label>
              <input className={inp} value={editBranchName} onChange={e => setEditBranchName(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Address</label>
              <input className={inp} value={editBranchAddress} onChange={e => setEditBranchAddress(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className={lbl}>Phone</label>
              <input className={inp} value={editBranchPhone} onChange={e => setEditBranchPhone(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditBranch(null)}>Cancel</Button>
            <Button size="sm" onClick={saveEditBranch} disabled={savingBranch || !editBranchName.trim()}>
              {savingBranch ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Girvi Settings"
        description="Configuration for the whole Girvi module — separate from your main shop settings. Shop identity here is printed on Girvi vouchers/notices; loan defaults pre-fill every new loan; branches control where loans can be pledged."
        sections={[
          {
            heading: "Shop Identity",
            items: ["Shown on every printed voucher — pledge receipts, return vouchers, forfeiture notices, transfer vouchers"],
          },
          {
            heading: "Loan Defaults",
            items: [
              "Pre-fill values offered on every New Girvi Loan form — changing them here doesn't touch existing loans",
              "Grace Period — days after due date before penalty interest starts accruing",
              "Forfeiture Notice Period — days a customer must be given after a notice before you can forfeit their pledge",
            ],
          },
          {
            heading: "Voucher Numbering Prefixes",
            items: ["Each document type gets its own sequential number per financial year, e.g. GRV/2026-27/0001 — never reused, even if a loan is later voided"],
          },
          {
            heading: "Branches",
            items: ["Add branches, set which one is the default for new loans, and deactivate ones no longer in use"],
          },
        ]}
      />
    </div>
  );
}
