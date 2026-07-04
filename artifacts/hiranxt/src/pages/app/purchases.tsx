import { useState } from "react";
import { formatCurrency, formatDate, formatWeight } from "@/lib/utils";
import {
  useListPurchases, useCreatePurchase, useListSuppliers,
  getListPurchasesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PurchaseForm {
  supplierName: string; metalType: string; purity: string;
  grossWeight: number; netWeight: number; fineWeight: number;
  ratePerGram: number; totalAmount: number; purchaseDate: string; notes: string;
}

// Same fixed purity options as inventory.tsx / billing.tsx, for consistency across the app.
const PURITIES = ["24K", "22K", "18K", "14K", "925", "999", "Unspecified"];

export default function Purchases() {
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: purchases, isLoading } = useListPurchases();
  const createPurchase = useCreatePurchase();

  const { register, handleSubmit, reset, setValue, watch } = useForm<PurchaseForm>({
    defaultValues: { metalType: "gold", purity: "22K", purchaseDate: new Date().toISOString().split("T")[0] }
  });

  const netWeight = watch("netWeight");
  const ratePerGram = watch("ratePerGram");
  const metalTypeWatch = watch("metalType") ?? "gold";
  const purityWatch = watch("purity") ?? "22K";

  const onSubmit = (data: PurchaseForm) => {
    createPurchase.mutate({
      data: {
        supplierName: data.supplierName,
        metalType: data.metalType,
        purity: data.purity,
        grossWeight: parseFloat(String(data.grossWeight)),
        netWeight: parseFloat(String(data.netWeight)),
        fineWeight: parseFloat(String(data.fineWeight || data.netWeight)),
        ratePerGram: parseFloat(String(data.ratePerGram)),
        totalAmount: data.totalAmount > 0 ? parseFloat(String(data.totalAmount)) : parseFloat(String(netWeight)) * parseFloat(String(ratePerGram)) || 0,
        purchaseDate: new Date(data.purchaseDate).toISOString(),
        notes: data.notes || null,
        supplierId: null,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
        toast({ title: "Purchase recorded" });
        setAddOpen(false);
        reset();
      },
      onError: () => toast({ title: "Failed to record purchase", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Purchases</h1>
          <p className="text-muted-foreground text-sm">Track metal receipts and supplier purchases</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2" data-testid="button-add-purchase">
          <Plus className="w-4 h-4" />New Purchase
        </Button>
      </div>

      <Card className="border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Invoice</th>
                <th className="px-4 py-3 text-left font-medium">Supplier</th>
                <th className="px-4 py-3 text-left font-medium">Metal</th>
                <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Gross Wt.</th>
                <th className="px-4 py-3 text-right font-medium">Fine Wt.</th>
                <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Rate/g</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && (!purchases || purchases.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="text-muted-foreground mb-3">No purchases recorded yet.</div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)} data-testid="button-add-first-purchase">
                      <Plus className="w-3.5 h-3.5" />
                      Record First Purchase
                    </Button>
                  </td>
                </tr>
              )}
              {(purchases ?? []).map(p => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/10" data-testid={`row-purchase-${p.id}`}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">{p.invoiceNumber}</td>
                  <td className="px-4 py-3 font-medium">{p.supplierName}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize">{p.metalType} {p.purity}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{formatWeight(p.grossWeight)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatWeight(p.fineWeight)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">₹{p.ratePerGram.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">{formatCurrency(p.totalAmount)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{formatDate(p.purchaseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Purchase</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Supplier Name *</label>
                <Input {...register("supplierName", { required: true })} placeholder="Mehta Gold Suppliers" data-testid="input-supplier-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Metal Type / Form</label>
                <Select value={metalTypeWatch} onValueChange={v => setValue("metalType", v)}>
                  <SelectTrigger data-testid="select-metal-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="bullion">Bullion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Purity</label>
                <Select value={purityWatch} onValueChange={v => setValue("purity", v)}>
                  <SelectTrigger data-testid="select-purchase-purity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Gross Weight (g) *</label>
                <Input type="number" step="0.001" {...register("grossWeight", { required: true })} data-testid="input-purchase-gross" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Net Weight (g) *</label>
                <Input type="number" step="0.001" {...register("netWeight", { required: true })} data-testid="input-purchase-net" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block" title="Fine weight = pure metal equivalent after adjusting for purity">Fine Weight (g)</label>
                <Input type="number" step="0.001" {...register("fineWeight")} placeholder="Same as net if pure" data-testid="input-purchase-fine" />
                <p className="text-[10px] text-muted-foreground mt-1">Fine weight = pure metal equivalent after adjusting for purity</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Rate per gram (₹) *</label>
                <Input type="number" {...register("ratePerGram", { required: true })} data-testid="input-purchase-rate" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Total Amount (₹, optional)</label>
                <Input type="number" {...register("totalAmount")} placeholder="Auto-calculated if blank" data-testid="input-purchase-total" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Purchase Date</label>
                <Input type="date" {...register("purchaseDate")} data-testid="input-purchase-date" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <Input {...register("notes")} data-testid="input-purchase-notes" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createPurchase.isPending} data-testid="button-submit-purchase">
                {createPurchase.isPending ? "Saving..." : "Record Purchase"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
