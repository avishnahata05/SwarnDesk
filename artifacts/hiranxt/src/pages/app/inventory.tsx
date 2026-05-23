import { useState } from "react";
import { formatCurrency, formatWeight } from "@/lib/utils";
import {
  useListInventoryItems, useCreateInventoryItem, useDeleteInventoryItem,
  useGetCurrentRates, useGetInventoryStatsByCategory, useGetSettings,
  getListInventoryItemsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm, useWatch } from "react-hook-form";
import { Plus, Search, Trash2, Pencil, Package, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["gold", "silver", "diamond", "kundan", "platinum", "antique"];
const ITEM_TYPES = [
  "Ring", "Necklace", "Bangle", "Bracelet", "Earring", "Pendant", "Chain",
  "Mangalsutra", "Anklet", "Nose Ring", "Maang Tikka", "Haar", "Choker",
  "Jhumka", "Kangan", "Payal", "Coin", "Bar", "Other",
];
const PURITIES = ["24K", "22K", "18K", "14K", "925", "999", "Unspecified"];

interface ItemForm {
  name: string; category: string; purity: string; itemType: string;
  grossWeight: number; netWeight: number; stoneWeight: number;
  makingCharges: number; quantity: number; branch: string;
  huid: string; barcode: string; lowStockThreshold: number;
}

function getStatusBadge(qty: number, threshold: number) {
  if (qty <= 0) return <Badge variant="destructive">Out of Stock</Badge>;
  if (qty <= threshold) return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">Low Stock</Badge>;
  return <Badge variant="secondary">In Stock</Badge>;
}

function ItemFormDialog({
  open, onOpenChange, title, defaultValues, onSubmit, isPending,
  rates, testIdPrefix,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  defaultValues: Partial<ItemForm>;
  onSubmit: (data: ItemForm) => void;
  isPending: boolean;
  rates: { gold22k: number; gold24k: number; gold18k: number; silver: number } | undefined;
  testIdPrefix: string;
}) {
  const { register, handleSubmit, reset, setValue, control } = useForm<ItemForm>({
    defaultValues: {
      category: "gold", purity: "22K", quantity: 1, branch: "Main",
      stoneWeight: 0, lowStockThreshold: 2, itemType: "Ring",
      ...defaultValues,
    },
  });

  const metalRateMap = {
    gold: rates?.gold22k ?? 7250,
    silver: rates?.silver ?? 95,
    diamond: rates?.gold22k ?? 7250,
    kundan: rates?.gold22k ?? 7250,
    platinum: 3500,
    antique: rates?.gold22k ?? 7250,
  };

  const watchedValues = useWatch({ control });
  const netW = parseFloat(String(watchedValues.netWeight || 0));
  const stoneW = parseFloat(String(watchedValues.stoneWeight || 0));
  const making = parseFloat(String(watchedValues.makingCharges || 0));
  const cat = watchedValues.category ?? "gold";
  const metalRate = metalRateMap[cat as keyof typeof metalRateMap] ?? 7250;
  const metalValue = Math.max(0, netW - stoneW) * metalRate;
  const previewTotal = Math.round(metalValue + making);

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Item Name *</label>
              <Input {...register("name", { required: true })} placeholder="Gold Bangle 22K" data-testid={`${testIdPrefix}-name`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Item Type</label>
              <Select defaultValue={defaultValues.itemType ?? "Ring"} onValueChange={v => setValue("itemType", v)}>
                <SelectTrigger data-testid={`${testIdPrefix}-item-type`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <Select defaultValue={defaultValues.category ?? "gold"} onValueChange={v => setValue("category", v)}>
                <SelectTrigger data-testid={`${testIdPrefix}-category`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Purity</label>
              <Select defaultValue={defaultValues.purity ?? "22K"} onValueChange={v => setValue("purity", v)}>
                <SelectTrigger data-testid={`${testIdPrefix}-purity`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Gross Weight (g) *</label>
              <Input type="number" step="0.001" {...register("grossWeight", { required: true })} data-testid={`${testIdPrefix}-gross-weight`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Net Weight (g) *</label>
              <Input type="number" step="0.001" {...register("netWeight", { required: true })} data-testid={`${testIdPrefix}-net-weight`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stone Weight (g)</label>
              <Input type="number" step="0.001" {...register("stoneWeight")} data-testid={`${testIdPrefix}-stone-weight`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Making Charges (₹) *</label>
              <Input type="number" {...register("makingCharges", { required: true })} data-testid={`${testIdPrefix}-making-charges`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
              <Input type="number" {...register("quantity")} data-testid={`${testIdPrefix}-quantity`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Low Stock Alert (qty)</label>
              <Input type="number" {...register("lowStockThreshold")} data-testid={`${testIdPrefix}-low-stock`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Branch</label>
              <Input {...register("branch")} data-testid={`${testIdPrefix}-branch`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">HUID (optional)</label>
              <Input {...register("huid")} placeholder="AA1234" data-testid={`${testIdPrefix}-huid`} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Barcode (optional)</label>
              <Input {...register("barcode")} placeholder="123456789" data-testid={`${testIdPrefix}-barcode`} />
            </div>
          </div>

          {/* Live price preview */}
          {previewTotal > 0 && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1.5">
              <div className="font-semibold text-primary mb-1">Price Preview (at current rates)</div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Metal rate ({cat})</span>
                <span>₹{metalRate.toLocaleString("en-IN")}/g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Metal value ({Math.max(0, netW - stoneW).toFixed(3)}g)</span>
                <span>{formatCurrency(metalValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Making charges</span>
                <span>{formatCurrency(making)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-primary border-t border-primary/20 pt-1.5">
                <span>Total Value</span>
                <span>{formatCurrency(previewTotal)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid={`${testIdPrefix}-submit`}>
              {isPending ? "Saving..." : title.startsWith("Edit") ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function printBarcodeLabel(params: {
  item: { id: number; name: string; category: string; purity: string; grossWeight: number; totalValue: number; barcode: string | null };
  shopName: string;
  onSaveBarcode?: (barcode: string) => void;
}) {
  const { item, shopName, onSaveBarcode } = params;
  const barcode = item.barcode || `SD${item.id.toString().padStart(6, "0")}`;
  if (!item.barcode && onSaveBarcode) onSaveBarcode(barcode);

  const labelHtml = (i: number) => `
    <div class="label">
      <div class="shop">${shopName}</div>
      <div class="name">${item.name}</div>
      <div class="meta">${item.purity} &middot; ${item.grossWeight.toFixed(3)}g &middot; ${item.category}</div>
      <div class="price">&#8377;${item.totalValue.toLocaleString("en-IN")}</div>
      <svg id="bc${i}"></svg>
    </div>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Labels – ${item.name}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#fff;padding:16px}
.grid{display:flex;flex-wrap:wrap;gap:10px}
.label{border:1px solid #bbb;border-radius:4px;padding:10px 12px;width:210px;text-align:center;page-break-inside:avoid}
.shop{font-size:9px;font-weight:700;color:#1a6640;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.name{font-size:11px;font-weight:700;color:#111;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta{font-size:9px;color:#555;margin-bottom:6px}
.price{font-size:14px;font-weight:800;color:#1a6640;margin-bottom:6px}
.btn{display:block;margin:0 auto 14px;padding:7px 20px;background:#1a6640;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600}
@media print{.btn{display:none!important}}
</style>
</head>
<body>
<button class="btn" onclick="window.print()">🖨️ Print Labels</button>
<div class="grid">
${[0,1,2,3,4,5].map(i => labelHtml(i)).join("")}
</div>
<script>
[0,1,2,3,4,5].forEach(function(i){
  try{
    JsBarcode(document.getElementById('bc'+i),'${barcode}',{
      format:'CODE128',width:1.5,height:45,displayValue:true,fontSize:9,margin:3
    });
  }catch(e){}
});
<\/script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=720,height=600");
  if (w) { w.document.write(html); w.document.close(); }
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<null | {
    id: number; name: string; category: string; purity: string; itemType?: string;
    grossWeight: number; netWeight: number; stoneWeight: number;
    makingCharges: number; quantity: number; branch: string;
    huid: string | null; barcode: string | null; lowStockThreshold: number;
  }>(null);

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
  const { data: settings } = useGetSettings();

  const metalRateMap: Record<string, number> = {
    gold: rates?.gold22k ?? 7250,
    silver: rates?.silver ?? 95,
    diamond: rates?.gold22k ?? 7250,
    kundan: rates?.gold22k ?? 7250,
    platinum: 3500,
    antique: rates?.gold22k ?? 7250,
  };

  const buildPayload = (data: ItemForm) => {
    const metalRate = metalRateMap[data.category] ?? 7250;
    const netW = parseFloat(String(data.netWeight));
    const stoneW = parseFloat(String(data.stoneWeight || 0));
    const making = parseFloat(String(data.makingCharges));
    const totalValue = Math.max(0, netW - stoneW) * metalRate + making;
    return {
      ...data,
      grossWeight: parseFloat(String(data.grossWeight)),
      netWeight: netW,
      stoneWeight: stoneW,
      makingCharges: making,
      metalRate,
      totalValue: Math.round(totalValue),
      quantity: parseInt(String(data.quantity)),
      lowStockThreshold: parseInt(String(data.lowStockThreshold || 2)),
      huid: data.huid || null,
      barcode: data.barcode || null,
    };
  };

  const onAdd = (data: ItemForm) => {
    createItem.mutate({ data: buildPayload(data) }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
        toast({ title: "Item added successfully" });
        setAddOpen(false);
      },
      onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
    });
  };

  const onEdit = async (data: ItemForm) => {
    if (!editItem) return;
    try {
      const payload = buildPayload(data);
      const r = await fetch(`/api/inventory/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
      toast({ title: "Item updated successfully" });
      setEditItem(null);
    } catch {
      toast({ title: "Failed to update item", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Manage your jewellery stock</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2" data-testid="button-add-inventory">
          <Plus className="w-4 h-4" />Add Item
        </Button>
      </div>

      {/* Category stats */}
      {(categoryStats ?? []).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {(categoryStats ?? []).map((s) => (
            <Card key={s.category} className="border-border">
              <CardContent className="p-3 md:p-4">
                <div className="text-xs text-muted-foreground capitalize mb-1">{s.category}</div>
                <div className="text-xl font-bold">{s.count}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(s.value)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, HUID, barcode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-inventory"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-category-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
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
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-left font-medium">Purity</th>
                <th className="px-4 py-3 text-right font-medium">Weight</th>
                <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Rate/g</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 text-center font-medium hidden sm:table-cell">Qty</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {!isLoading && (!items || items.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <div className="text-muted-foreground">No items found.</div>
                    <div className="text-xs text-muted-foreground mt-1">Add your first inventory item to get started.</div>
                  </td>
                </tr>
              )}
              {(items ?? []).map(item => (
                <tr key={item.id} className="border-b border-border hover:bg-muted/10 transition-colors" data-testid={`row-inventory-${item.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    {item.huid && <div className="text-xs text-muted-foreground">HUID: {item.huid}</div>}
                    {item.barcode && <div className="text-xs text-muted-foreground font-mono">#{item.barcode}</div>}
                    {(item as { itemType?: string }).itemType && (
                      <div className="text-xs text-muted-foreground">{(item as { itemType?: string }).itemType}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="outline" className="capitalize">{item.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{item.purity}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">{formatWeight(item.grossWeight)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">₹{item.metalRate.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(item.totalValue)}</td>
                  <td className="px-4 py-3 text-center font-medium hidden sm:table-cell">{item.quantity}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(item.quantity, item.lowStockThreshold)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => printBarcodeLabel({
                          item: {
                            id: item.id,
                            name: item.name,
                            category: item.category,
                            purity: item.purity,
                            grossWeight: item.grossWeight,
                            totalValue: item.totalValue,
                            barcode: item.barcode ?? null,
                          },
                          shopName: settings?.businessName ?? "SwarnDesk",
                          onSaveBarcode: async (bc) => {
                            try {
                              const r = await fetch(`/api/inventory/${item.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  name: item.name,
                                  category: item.category,
                                  purity: item.purity,
                                  itemType: (item as { itemType?: string }).itemType ?? "Ring",
                                  grossWeight: item.grossWeight,
                                  netWeight: item.netWeight,
                                  stoneWeight: item.stoneWeight ?? 0,
                                  makingCharges: item.makingCharges,
                                  metalRate: item.metalRate,
                                  totalValue: item.totalValue,
                                  quantity: item.quantity,
                                  lowStockThreshold: item.lowStockThreshold,
                                  branch: item.branch ?? "Main",
                                  huid: item.huid ?? null,
                                  barcode: bc,
                                }),
                              });
                              if (r.ok) {
                                queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
                                toast({ title: `Barcode assigned: ${bc}` });
                              }
                            } catch { /* label still prints */ }
                          },
                        })}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`button-label-${item.id}`}
                        title={item.barcode ? `Print label (${item.barcode})` : "Generate & print barcode label"}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditItem({
                          id: item.id,
                          name: item.name,
                          category: item.category,
                          purity: item.purity,
                          itemType: (item as { itemType?: string }).itemType ?? "Ring",
                          grossWeight: item.grossWeight,
                          netWeight: item.netWeight,
                          stoneWeight: item.stoneWeight ?? 0,
                          makingCharges: item.makingCharges,
                          quantity: item.quantity,
                          branch: item.branch ?? "Main",
                          huid: item.huid ?? null,
                          barcode: item.barcode ?? null,
                          lowStockThreshold: item.lowStockThreshold,
                        })}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`button-edit-${item.id}`}
                        title="Edit item"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
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
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add item dialog */}
      <ItemFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Inventory Item"
        defaultValues={{ category: "gold", purity: "22K", quantity: 1, branch: "Main", stoneWeight: 0, lowStockThreshold: 2, itemType: "Ring" }}
        onSubmit={onAdd}
        isPending={createItem.isPending}
        rates={rates}
        testIdPrefix="input-item"
      />

      {/* Edit item dialog */}
      {editItem && (
        <ItemFormDialog
          open={!!editItem}
          onOpenChange={v => !v && setEditItem(null)}
          title={`Edit — ${editItem.name}`}
          defaultValues={{
            name: editItem.name,
            category: editItem.category,
            purity: editItem.purity,
            itemType: editItem.itemType ?? "Ring",
            grossWeight: editItem.grossWeight,
            netWeight: editItem.netWeight,
            stoneWeight: editItem.stoneWeight,
            makingCharges: editItem.makingCharges,
            quantity: editItem.quantity,
            branch: editItem.branch ?? "Main",
            huid: editItem.huid ?? "",
            barcode: editItem.barcode ?? "",
            lowStockThreshold: editItem.lowStockThreshold,
          }}
          onSubmit={onEdit}
          isPending={false}
          rates={rates}
          testIdPrefix="input-edit-item"
        />
      )}
    </div>
  );
}
