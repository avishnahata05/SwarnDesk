import { useState } from "react";
import { formatCurrency, formatWeight } from "@/lib/utils";
import {
  useListKarigars, useCreateKarigar, useIssueMetalToKarigar, useReturnMetalFromKarigar, useGetKarigar, useDeleteKarigar,
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
import { Plus, Hammer, TrendingDown, TrendingUp, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KarigarForm { name: string; mobile: string; specialization: string; address: string; }
interface MetalIssueForm { metalType: string; weight: number; purity: string; notes: string; }
interface MetalReturnForm { metalType: string; issuedWeight: number; returnedWeight: number; wastagePercent: number; notes: string; }

const GOLD_PURITIES = ["24K", "22K", "18K", "14K"];
const SILVER_PURITIES = ["999", "925"];
const puritiesForMetal = (metalType: string) => metalType === "silver" ? SILVER_PURITIES : GOLD_PURITIES;

export default function Karigars() {
  const [addOpen, setAddOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState<number | null>(null);
  const [returnOpen, setReturnOpen] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: karigars, isLoading } = useListKarigars();
  const createKarigar = useCreateKarigar();
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

  const addForm = useForm<KarigarForm>();
  const issueForm = useForm<MetalIssueForm>({ defaultValues: { metalType: "gold", purity: "22K" } });
  const returnForm = useForm<MetalReturnForm>({ defaultValues: { metalType: "gold" } });

  const issueMetalType = issueForm.watch("metalType") ?? "gold";
  const issuePurity = issueForm.watch("purity") ?? "22K";
  const returnMetalType = returnForm.watch("metalType") ?? "gold";
  const returnKarigar = (karigars ?? []).find(k => k.id === returnOpen) ?? null;

  const onAdd = (data: KarigarForm) => {
    createKarigar.mutate({ data: { ...data, address: data.address || null } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKarigarsQueryKey() });
        toast({ title: "Karigar added" });
        setAddOpen(false);
        addForm.reset();
      },
      onError: () => toast({ title: "Failed to add karigar", variant: "destructive" }),
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
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline">{k.pendingOrders} pending orders</Badge>
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

              <div className="text-xs text-muted-foreground">
                Total wages paid: <span className="text-foreground font-medium">{formatCurrency(k.totalWagesPaid)}</span>
              </div>

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
              <label className="text-xs text-muted-foreground mb-1 block">Wastage % *</label>
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
    </div>
  );
}
