import { useState } from "react";
import { formatCurrency, formatWeight } from "@/lib/utils";
import {
  useListInventoryItems, useCreateInventoryItem, useDeleteInventoryItem,
  useGetCurrentRates, useGetInventoryStatsByCategory,
  getListInventoryItemsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Plus, Search, Package, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["gold", "silver", "diamond", "kundan", "platinum"];
const PURITIES = ["24K", "22K", "18K", "14K", "925", "999"];

interface ItemForm {
  name: string; category: string; purity: string;
  grossWeight: number; netWeight: number; stoneWeight: number;
  makingCharges: number; quantity: number; branch: string;
  huid: string; barcode: string;
}

function getStatusBadge(qty: number, threshold: number) {
  if (qty <= 0) return <Badge variant="destructive">Out of Stock</Badge>;
  if (qty <= threshold) return <Badge variant="destructive" className="bg-orange-500/20 text-orange-400 border-orange-500/30">Low Stock</Badge>;
  return <Badge variant="secondary">In Stock</Badge>;
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = {
    ...(search ? { search } : {}),
    ...(category !== "all" ? { category } : {}),
  };
  const { data: items, isLoading } = useListInventoryItems(params);
  const { data: rates } = useGetCurrentRates();
  const { data: categoryStats } = useGetInventoryStatsByCategory();
  const createItem = useCreateInventoryItem();
  const deleteItem = useDeleteInventoryItem();

  const { register, handleSubmit, reset, setValue, watch } = useForm<ItemForm>({
    defaultValues: { category: "gold", purity: "22K", quantity: 1, branch: "Main", stoneWeight: 0 }
  });

  const grossWeight = watch("grossWeight");
  const metalRateMap: Record<string, number> = {
    gold: rates?.gold22k ?? 7250,
    silver: rates?.silver ?? 95,
    diamond: rates?.gold22k ?? 7250,
    kundan: rates?.gold22k ?? 7250,
    platinum: 3500,
  };

  const onSubmit = (data: ItemForm) => {
    const metalRate = metalRateMap[data.category] ?? 7250;
    const totalValue = (parseFloat(String(data.netWeight)) - parseFloat(String(data.stoneWeight || 0))) * metalRate + parseFloat(String(data.makingCharges));
    createItem.mutate({
      data: {
        ...data,
        grossWeight: parseFloat(String(data.grossWeight)),
        netWeight: parseFloat(String(data.netWeight)),
        stoneWeight: parseFloat(String(data.stoneWeight || 0)),
        makingCharges: parseFloat(String(data.makingCharges)),
        metalRate,
        totalValue: Math.round(totalValue),
        quantity: parseInt(String(data.quantity)),
        huid: data.huid || null,
        barcode: data.barcode || null,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
        toast({ title: "Item added successfully" });
        setAddOpen(false);
        reset();
      },
      onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Manage your jewellery stock</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2" data-testid="button-add-inventory">
          <Plus className="w-4 h-4" />Add Item
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(categoryStats ?? []).map((s, i) => (
          <Card key={s.category} className="border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground capitalize mb-1">{s.category}</div>
              <div className="text-xl font-bold">{s.count}</div>
              <div className="text-xs text-muted-foreground">{formatCurrency(s.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-inventory"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40" data-testid="select-category-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Items table */}
      <Card className="border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium">Item</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Purity</th>
                <th className="px-4 py-3 text-right font-medium">Weight</th>
                <th className="px-4 py-3 text-right font-medium">Rate/g</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 text-center font-medium">Qty</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {!isLoading && (!items || items.length === 0) && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No items found. Add your first inventory item.</td></tr>
              )}
              {(items ?? []).map(item => (
                <tr key={item.id} className="border-b border-border hover:bg-muted/10 transition-colors" data-testid={`row-inventory-${item.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    {item.huid && <div className="text-xs text-muted-foreground">HUID: {item.huid}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    <Badge variant="outline" className="capitalize">{item.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.purity}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatWeight(item.grossWeight)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">₹{item.metalRate.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(item.totalValue)}</td>
                  <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(item.quantity, item.lowStockThreshold)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        deleteItem.mutate({ id: item.id }, {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
                            toast({ title: "Item deleted" });
                          }
                        });
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add item dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Item Name</label>
                <Input {...register("name", { required: true })} placeholder="Gold Bangle 22K" data-testid="input-item-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                <Select defaultValue="gold" onValueChange={v => setValue("category", v)}>
                  <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Purity</label>
                <Select defaultValue="22K" onValueChange={v => setValue("purity", v)}>
                  <SelectTrigger data-testid="select-purity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Gross Weight (g)</label>
                <Input type="number" step="0.001" {...register("grossWeight", { required: true })} data-testid="input-gross-weight" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Net Weight (g)</label>
                <Input type="number" step="0.001" {...register("netWeight", { required: true })} data-testid="input-net-weight" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Stone Weight (g)</label>
                <Input type="number" step="0.001" defaultValue="0" {...register("stoneWeight")} data-testid="input-stone-weight" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Making Charges (₹)</label>
                <Input type="number" {...register("makingCharges", { required: true })} data-testid="input-making-charges" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                <Input type="number" defaultValue="1" {...register("quantity")} data-testid="input-quantity" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Branch</label>
                <Input defaultValue="Main" {...register("branch")} data-testid="input-branch" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">HUID (optional)</label>
                <Input {...register("huid")} placeholder="AA1234" data-testid="input-huid" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Barcode (optional)</label>
                <Input {...register("barcode")} placeholder="123456789" data-testid="input-barcode" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createItem.isPending} data-testid="button-submit-item">
                {createItem.isPending ? "Adding..." : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
