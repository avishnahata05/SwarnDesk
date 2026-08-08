import { useState, useEffect, useCallback } from "react";
import { formatCurrency, formatWeight, formatDate } from "@/lib/utils";
import {
  useListKarigars, useCreateKarigar, useUpdateKarigar, useIssueMetalToKarigar, useReturnMetalFromKarigar, useGetKarigar, useDeleteKarigar,
  getListKarigarsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Plus, Hammer, TrendingDown, TrendingUp, Trash2, Pencil, Banknote, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";
import { InfoTooltip } from "@/components/InfoTooltip";
import { BankAccountSelect } from "@/components/BankAccountSelect";

interface KarigarForm { name: string; mobile: string; specialization: string; address: string; openingBalance: string; openingBalanceType: "debit" | "credit"; }
interface MetalIssueForm { metalType: string; weight: number; purity: string; notes: string; }
interface MetalReturnForm { metalType: string; issuedWeight: number; returnedWeight: number; wastagePercent: number; notes: string; }

type KarigarPayment = { id: number; karigarId: number; karigarName: string; amount: number; paymentMode: string; bankAccountId: number | null; paidAt: string; notes: string | null };

const GOLD_PURITIES = ["24K", "22K", "18K", "14K"];
const SILVER_PURITIES = ["999", "925"];
const puritiesForMetal = (metalType: string) => metalType === "silver" ? SILVER_PURITIES : GOLD_PURITIES;
const PAYMENT_MODES = ["cash", "upi", "card", "bank"];

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("swarndesk_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function Karigars() {
  const [addOpen, setAddOpen] = useState(false);
  const [editKarigar, setEditKarigar] = useState<{ id: number; name: string; mobile: string; specialization: string; address?: string | null; openingBalance?: number; openingBalanceType?: string } | null>(null);
  const [issueOpen, setIssueOpen] = useState<number | null>(null);
  const [returnOpen, setReturnOpen] = useState<number | null>(null);
  const [pageHelpOpen, setPageHelpOpen] = useState(false);
  const [paymentsKarigar, setPaymentsKarigar] = useState<{ id: number; name: string } | null>(null);
  const [payments, setPayments] = useState<KarigarPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [payBankAccountId, setPayBankAccountId] = useState<number | null>(null);
  const [payNotes, setPayNotes] = useState("");
  const [payingSubmit, setPayingSubmit] = useState(false);
  const [editingPayment, setEditingPayment] = useState<KarigarPayment | null>(null);
  const [editPayNotes, setEditPayNotes] = useState("");
  const [savingPaymentEdit, setSavingPaymentEdit] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const loadPayments = useCallback(async (karigarId: number) => {
    setPaymentsLoading(true);
    try {
      const r = await fetch(`/api/karigars/${karigarId}/payments`, { headers: getAuthHeaders() });
      if (r.ok) setPayments(await r.json());
    } catch { /* ignore */ } finally { setPaymentsLoading(false); }
  }, []);

  useEffect(() => {
    if (paymentsKarigar) loadPayments(paymentsKarigar.id);
    else setPayments([]);
  }, [paymentsKarigar, loadPayments]);

  const openPayments = (k: { id: number; name: string }) => {
    setPaymentsKarigar(k);
    setPayAmount(""); setPayMode("cash"); setPayBankAccountId(null); setPayNotes("");
  };

  const handleLogPayment = async () => {
    if (!paymentsKarigar) return;
    const amount = parseFloat(payAmount);
    if (!isFinite(amount) || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setPayingSubmit(true);
    try {
      const r = await fetch(`/api/karigars/${paymentsKarigar.id}/payments`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ amount, paymentMode: payMode, bankAccountId: payBankAccountId, notes: payNotes.trim() || null }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to log payment");
      toast({ title: "Payment logged" });
      setPayAmount(""); setPayBankAccountId(null); setPayNotes("");
      loadPayments(paymentsKarigar.id);
      queryClient.invalidateQueries({ queryKey: getListKarigarsQueryKey() });
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to log payment", variant: "destructive" });
    } finally { setPayingSubmit(false); }
  };

  const openEditPayment = (p: KarigarPayment) => {
    setEditingPayment(p);
    setEditPayNotes(p.notes ?? "");
  };

  const handleSavePaymentEdit = async () => {
    if (!editingPayment || !paymentsKarigar) return;
    setSavingPaymentEdit(true);
    try {
      const r = await fetch(`/api/karigars/${paymentsKarigar.id}/payments/${editingPayment.id}`, {
        method: "PATCH", headers: getAuthHeaders(),
        body: JSON.stringify({ notes: editPayNotes.trim() || null }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to update payment");
      toast({ title: "Payment updated" });
      setEditingPayment(null);
      loadPayments(paymentsKarigar.id);
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to update payment", variant: "destructive" });
    } finally { setSavingPaymentEdit(false); }
  };

  const { data: karigars, isLoading } = useListKarigars();
  const createKarigar = useCreateKarigar();
  const updateKarigar = useUpdateKarigar();
  const issueMetal = useIssueMetalToKarigar();
  const returnMetal = useReturnMetalFromKarigar();
  const deleteKarigar = useDeleteKarigar();

  const handleDelete = (id: number) => {
    if (!confirm("Delete this karigar? This cannot be undone.")) return;
    deleteKarigar.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKarigarsQueryKey() }); toast({ title: "Karigar deleted" }); },
      onError: () => toast({ title: "Failed to delete karigar", variant: "destructive" }),
    });
  };

  const addForm = useForm<KarigarForm>({ defaultValues: { openingBalance: "0", openingBalanceType: "credit" } });
  const editForm = useForm<KarigarForm>();
  const addOpeningTypeWatch = addForm.watch("openingBalanceType") ?? "credit";
  const editOpeningTypeWatch = editForm.watch("openingBalanceType") ?? "credit";
  const issueForm = useForm<MetalIssueForm>({ defaultValues: { metalType: "gold", purity: "22K" } });
  const returnForm = useForm<MetalReturnForm>({ defaultValues: { metalType: "gold" } });

  const issueMetalType = issueForm.watch("metalType") ?? "gold";
  const issuePurity = issueForm.watch("purity") ?? "22K";
  const returnMetalType = returnForm.watch("metalType") ?? "gold";
  const returnKarigar = (karigars ?? []).find(k => k.id === returnOpen) ?? null;

  const onAdd = (data: KarigarForm) => {
    createKarigar.mutate({
      data: { name: data.name, mobile: data.mobile, specialization: data.specialization, address: data.address || null, openingBalance: parseFloat(data.openingBalance) || 0, openingBalanceType: data.openingBalanceType },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKarigarsQueryKey() });
        toast({ title: "Karigar added" });
        setAddOpen(false);
        addForm.reset();
      },
      onError: () => toast({ title: "Failed to add karigar", variant: "destructive" }),
    });
  };

  const openEdit = (k: { id: number; name: string; mobile: string; specialization: string; address?: string | null; openingBalance?: number; openingBalanceType?: string }) => {
    setEditKarigar(k);
    editForm.reset({
      name: k.name, mobile: k.mobile, specialization: k.specialization, address: k.address ?? "",
      openingBalance: String(k.openingBalance ?? 0), openingBalanceType: (k.openingBalanceType as "debit" | "credit") ?? "credit",
    });
  };

  const onEditSubmit = (data: KarigarForm) => {
    if (!editKarigar) return;
    updateKarigar.mutate({
      id: editKarigar.id,
      data: { name: data.name, mobile: data.mobile, specialization: data.specialization, address: data.address || null, openingBalance: parseFloat(data.openingBalance) || 0, openingBalanceType: data.openingBalanceType },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKarigarsQueryKey() });
        toast({ title: "Karigar updated" });
        setEditKarigar(null);
      },
      onError: () => toast({ title: "Failed to update karigar", variant: "destructive" }),
    });
  };

  const onIssue = (data: MetalIssueForm) => {
    if (!issueOpen) return;
    issueMetal.mutate({
      id: issueOpen,
      data: { metalType: data.metalType, weight: parseFloat(String(data.weight)), purity: data.purity, notes: data.notes || null }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKarigarsQueryKey() });
        toast({ title: "Metal issued to karigar" });
        setIssueOpen(null);
        issueForm.reset();
      },
      onError: () => toast({ title: "Failed to issue metal", variant: "destructive" }),
    });
  };

  const onReturn = (data: MetalReturnForm) => {
    if (!returnOpen) return;
    const issuedW = parseFloat(String(data.issuedWeight));
    const returnedW = parseFloat(String(data.returnedWeight));
    if (isFinite(returnedW) && isFinite(issuedW) && returnedW > issuedW) {
      toast({ title: "Returned weight cannot exceed issued weight (some wastage during making is expected)", variant: "destructive" });
      return;
    }
    returnMetal.mutate({
      id: returnOpen,
      data: {
        metalType: data.metalType,
        issuedWeight: issuedW,
        returnedWeight: returnedW,
        wastagePercent: parseFloat(String(data.wastagePercent)),
        notes: data.notes || null
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKarigarsQueryKey() });
        toast({ title: "Metal return recorded" });
        setReturnOpen(null);
        returnForm.reset();
      },
      onError: () => toast({ title: "Failed to record return", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Karigars</h1>
          <p className="text-muted-foreground text-sm">Manage artisan assignments and metal tracking</p>
          <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2" data-testid="button-add-karigar">
          <Plus className="w-4 h-4" />Add Karigar
        </Button>
      </div>

      {!isLoading && (karigars ?? []).length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Hammer className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No karigars added yet</p>
          <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />Add Karigar
          </Button>
        </div>
      )}

      {/* Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
        {(karigars ?? []).map(k => (
          <Card key={k.id} className="border-border" data-testid={`card-karigar-${k.id}`}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{k.name}</div>
                  <div className="text-xs text-muted-foreground">{k.specialization} • {k.mobile}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Added on {formatDate(k.createdAt)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline">{k.pendingOrders} pending orders</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(k)} data-testid={`button-edit-karigar-${k.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => handleDelete(k.id)} data-testid={`button-delete-karigar-${k.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <div className="text-muted-foreground mb-1">Gold Pending</div>
                  <div className="font-semibold text-primary">{formatWeight(k.pendingGoldWeight)}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/30">
                  <div className="text-muted-foreground mb-1">Silver Pending</div>
                  <div className="font-semibold">{formatWeight(k.pendingSilverWeight)}</div>
                </div>
              </div>

              <button
                className="text-xs text-muted-foreground text-left hover:text-primary transition-colors w-full"
                onClick={() => openPayments({ id: k.id, name: k.name })}
                data-testid={`button-payments-${k.id}`}
              >
                Total wages paid: <span className="text-foreground font-medium underline underline-offset-2">{formatCurrency(k.totalWagesPaid)}</span>
                {!!k.openingBalance && (
                  <div>Opening: {formatCurrency(k.openingBalance)} {k.openingBalanceType === "debit" ? "Dr" : "Cr"}</div>
                )}
              </button>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-xs"
                  onClick={() => setIssueOpen(k.id)}
                  data-testid={`button-issue-metal-${k.id}`}
                >
                  <TrendingDown className="w-3 h-3" />Issue Metal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-xs"
                  onClick={() => {
                    setReturnOpen(k.id);
                    returnForm.reset({ metalType: "gold", issuedWeight: k.pendingGoldWeight || undefined });
                  }}
                  data-testid={`button-return-metal-${k.id}`}
                >
                  <TrendingUp className="w-3 h-3" />Return
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-xs"
                  onClick={() => openPayments({ id: k.id, name: k.name })}
                  data-testid={`button-wages-${k.id}`}
                >
                  <Banknote className="w-3 h-3" />Wages
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add karigar */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Karigar</DialogTitle></DialogHeader>
          <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                <Input {...addForm.register("name", { required: true })} data-testid="input-karigar-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mobile *</label>
                <Input {...addForm.register("mobile", { required: true })} data-testid="input-karigar-mobile" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Specialization *</label>
                <Input {...addForm.register("specialization", { required: true })} placeholder="Bangles, Chains, Rings" data-testid="input-karigar-spec" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                <Input {...addForm.register("address")} data-testid="input-karigar-address" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  Opening Balance
                  <InfoTooltip text="Wages already owed to this karigar (or an advance they owe you) from before you started using this software." />
                </label>
                <Input type="number" {...addForm.register("openingBalance")} placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Balance Side</label>
                <Select value={addOpeningTypeWatch} onValueChange={v => addForm.setValue("openingBalanceType", v as "debit" | "credit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Wages due (you owe them)</SelectItem>
                    <SelectItem value="debit">Advance (they owe you)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createKarigar.isPending} data-testid="button-submit-karigar">
                {createKarigar.isPending ? "Adding..." : "Add Karigar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit karigar */}
      <Dialog open={!!editKarigar} onOpenChange={o => !o && setEditKarigar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Karigar</DialogTitle></DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                <Input {...editForm.register("name", { required: true })} data-testid="input-edit-karigar-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mobile *</label>
                <Input {...editForm.register("mobile", { required: true })} data-testid="input-edit-karigar-mobile" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Specialization *</label>
                <Input {...editForm.register("specialization", { required: true })} placeholder="Bangles, Chains, Rings" data-testid="input-edit-karigar-spec" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                <Input {...editForm.register("address")} data-testid="input-edit-karigar-address" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Opening Balance</label>
                <Input type="number" {...editForm.register("openingBalance")} placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Balance Side</label>
                <Select value={editOpeningTypeWatch} onValueChange={v => editForm.setValue("openingBalanceType", v as "debit" | "credit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Wages due (you owe them)</SelectItem>
                    <SelectItem value="debit">Advance (they owe you)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditKarigar(null)}>Cancel</Button>
              <Button type="submit" disabled={updateKarigar.isPending} data-testid="button-submit-edit-karigar">
                {updateKarigar.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Issue metal dialog */}
      <Dialog open={!!issueOpen} onOpenChange={o => !o && setIssueOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Issue Metal to Karigar</DialogTitle></DialogHeader>
          <form onSubmit={issueForm.handleSubmit(onIssue)} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Metal Type</label>
              <Select
                value={issueMetalType}
                onValueChange={v => {
                  issueForm.setValue("metalType", v);
                  const validPurities = puritiesForMetal(v);
                  if (!validPurities.includes(issueForm.getValues("purity"))) {
                    issueForm.setValue("purity", v === "silver" ? "925" : "22K");
                  }
                }}
              >
                <SelectTrigger data-testid="select-issue-metal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Weight (g) *</label>
              <Input type="number" step="0.001" {...issueForm.register("weight", { required: true })} data-testid="input-issue-weight" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Purity</label>
              <Select value={issuePurity} onValueChange={v => issueForm.setValue("purity", v)}>
                <SelectTrigger data-testid="select-issue-purity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {puritiesForMetal(issueMetalType).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Input {...issueForm.register("notes")} data-testid="input-issue-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIssueOpen(null)}>Cancel</Button>
              <Button type="submit" disabled={issueMetal.isPending} data-testid="button-submit-issue">Issue Metal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Return metal dialog */}
      <Dialog open={!!returnOpen} onOpenChange={o => !o && setReturnOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Metal Return</DialogTitle></DialogHeader>
          <form onSubmit={returnForm.handleSubmit(onReturn)} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Metal Type</label>
              <Select
                value={returnMetalType}
                onValueChange={v => {
                  returnForm.setValue("metalType", v);
                  if (returnKarigar) {
                    const pending = v === "silver" ? returnKarigar.pendingSilverWeight : returnKarigar.pendingGoldWeight;
                    returnForm.setValue("issuedWeight", pending || undefined as unknown as number);
                  }
                }}
              >
                <SelectTrigger data-testid="select-return-metal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Issued Weight (g) * <span className="text-muted-foreground/60">pre-filled from pending balance, editable</span>
              </label>
              <Input type="number" step="0.001" {...returnForm.register("issuedWeight", { required: true })} data-testid="input-issued-weight" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Returned Weight (g) *</label>
              <Input type="number" step="0.001" {...returnForm.register("returnedWeight", { required: true })} data-testid="input-returned-weight" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                Wastage % *
                <InfoTooltip text="The % of metal lost during crafting (filing, polishing, melting loss). It's expected — the karigar's wage/fee typically factors this in." />
              </label>
              <Input type="number" step="0.01" {...returnForm.register("wastagePercent", { required: true })} data-testid="input-wastage" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Wastage % = weight lost while making the piece.{" "}
                {(() => {
                  const issuedW = parseFloat(String(returnForm.watch("issuedWeight") ?? ""));
                  const returnedW = parseFloat(String(returnForm.watch("returnedWeight") ?? ""));
                  if (!isFinite(issuedW) || !isFinite(returnedW) || issuedW <= 0) return null;
                  const suggested = ((issuedW - returnedW) / issuedW) * 100;
                  return (
                    <>
                      Based on issued/returned weight:{" "}
                      <button
                        type="button"
                        className="underline text-primary"
                        onClick={() => returnForm.setValue("wastagePercent", Math.max(0, parseFloat(suggested.toFixed(2))))}
                      >
                        use {suggested.toFixed(2)}%
                      </button>
                    </>
                  );
                })()}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Input {...returnForm.register("notes")} data-testid="input-return-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReturnOpen(null)}>Cancel</Button>
              <Button type="submit" disabled={returnMetal.isPending} data-testid="button-submit-return">Record Return</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Wage payments dialog */}
      <Dialog open={!!paymentsKarigar} onOpenChange={o => !o && setPaymentsKarigar(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Banknote className="w-4 h-4 text-primary" />Wages — {paymentsKarigar?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Log a Payment</div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Amount (₹)" value={payAmount} onChange={e => setPayAmount(e.target.value)} data-testid="input-log-payment-amount" />
                <Select value={payMode} onValueChange={v => { setPayMode(v); setPayBankAccountId(null); }}>
                  <SelectTrigger data-testid="select-log-payment-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(m => <SelectItem key={m} value={m} className="capitalize">{m.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <BankAccountSelect paymentMode={payMode} bankAccountId={payBankAccountId} onChange={setPayBankAccountId} />
              <Input placeholder="Notes (optional)" value={payNotes} onChange={e => setPayNotes(e.target.value)} data-testid="input-log-payment-notes" />
              <Button size="sm" className="w-full gap-1.5" onClick={handleLogPayment} disabled={payingSubmit} data-testid="button-log-payment">
                <IndianRupee className="w-3.5 h-3.5" />{payingSubmit ? "Logging..." : "Log Payment"}
              </Button>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Payment History</div>
              {paymentsLoading ? (
                <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
              ) : payments.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">No payments logged yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border text-xs">
                      <div>
                        <div className="font-medium">{formatCurrency(p.amount)} <span className="text-muted-foreground capitalize font-normal">· {p.paymentMode}</span></div>
                        <div className="text-muted-foreground">{formatDate(p.paidAt)}{p.notes ? ` · ${p.notes}` : ""}</div>
                      </div>
                      <button onClick={() => openEditPayment(p)} className="text-muted-foreground hover:text-primary transition-colors" title="Edit" data-testid={`button-edit-payment-${p.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit payment dialog */}
      <Dialog open={!!editingPayment} onOpenChange={o => !o && setEditingPayment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />Edit Payment</DialogTitle></DialogHeader>
          {editingPayment && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                The amount ({formatCurrency(editingPayment.amount)}) and payment mode ({editingPayment.paymentMode.toUpperCase()}) aren't editable here — they're already reflected in the books. Only notes can be corrected; log a new payment if this one was recorded wrong.
              </p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <Input value={editPayNotes} onChange={e => setEditPayNotes(e.target.value)} data-testid="input-edit-payment-notes" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingPayment(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSavePaymentEdit} disabled={savingPaymentEdit} data-testid="button-save-payment-edit">
                  {savingPaymentEdit ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Karigars"
        description="Manage your karigars — the artisans/goldsmiths who craft and repair jewellery for you — and track exactly how much gold/silver is currently out with each one."
        sections={[
          {
            heading: "What you can do here",
            items: [
              "Add Karigar — register a new artisan with their specialization and contact details",
              "Issue Metal — record handing raw gold/silver to a karigar for a job",
              "Return — record metal coming back after the work is done, including any wastage during crafting",
              "Wages — log a wage payment and view/correct payment history for this karigar",
            ],
          },
          {
            heading: "Terms you'll see",
            items: [
              "Pending Gold/Silver — metal currently issued to this karigar that hasn't been returned yet",
              "Wastage % — metal lost during crafting (filing, polishing, melting loss) — expected, not a mistake",
              "Total Wages Paid — cumulative amount paid to this karigar for their work",
            ],
          },
        ]}
      />
    </div>
  );
}
