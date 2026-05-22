import { useState } from "react";
import { formatCurrency, formatDate, formatWeight } from "@/lib/utils";
import {
  useListPurchases, useCreatePurchase, useListSuppliers, useCreateSupplier,
  getListPurchasesQueryKey, getListSuppliersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Plus, TruckIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PurchaseForm {
  supplierName: string; metalType: string; purity: string;
  grossWeight: number; netWeight: number; fineWeight: number;
  ratePerGram: number; totalAmount: number; purchaseDate: string; notes: string;
}

export default function Purchases() {
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: purchases, isLoading } = useListPurchases();
  const { data: suppliers } = useListSuppliers();
  const createPurchase = useCreatePurchase();

  const { register, handleSubmit, reset, setValue, watch } = useForm<PurchaseForm>({
    defaultValues: { metalType: "gold", purity: "22K", purchaseDate: new Date().toISOString().split("T")[0] }
  });

  const grossWeight = watch("grossWeight");
  const netWeight = watch("netWeight");
  const ratePerGram = watch("ratePerGram");

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
        totalAmount: parseFloat(String(data.totalAmount || (data.netWeight * data.ratePerGram))),
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
      <div className="flex items-center justify-between">
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
                <th className="px-4 py-3 text-left font-medium">Invoice</th>
                <th className="px-4 py-3 text-left font-medium">Supplier</th>
                <th className="px-4 py-3 text-left font-medium">Metal</th>
                <th className="px-4 py-3 text-right font-medium">Gross Wt.</th>
                <th className="px-4 py-3 text-right font-medium">Fine Wt.</th>
                <th className="px-4 py-3 text-right font-medium">Rate/g</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && (!purchases || purchases.length === 0) && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No purchases recorded yet.</td></tr>
              )}
              {(purchases ?? []).map(p => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/10" data-testid={`row-purchase-${p.id}`}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.invoiceNumber}</td>
                  <td className="px-4 py-3 font-medium">{p.supplierName}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize">{p.metalType} {p.purity}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatWeight(p.grossWeight)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatWeight(p.fineWeight)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">₹{p.ratePerGram.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">{formatCurrency(p.totalAmount)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(p.purchaseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Purchase</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Supplier Name *</label>
                <Input {...register("supplierName", { required: true })} placeholder="Mehta Gold Suppliers" data-testid="input-supplier-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Metal Type</label>
                <Select defaultValue="gold" onValueChange={v => setValue("metalType", v)}>
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
                <Input defaultValue="22K" {...register("purity")} data-testid="input-purchase-purity" />
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
                <label className="text-xs text-muted-foreground mb-1 block">Fine Weight (g)</label>
                <Input type="number" step="0.001" {...register("fineWeight")} placeholder="Same as net if pure" data-testid="input-purchase-fine" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Rate per gram (₹) *</label>
                <Input type="number" {...register("ratePerGram", { required: true })} data-testid="input-purchase-rate" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Total Amount (₹)</label>
                <Input type="number" {...register("totalAmount")} data-testid="input-purchase-total" />
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
