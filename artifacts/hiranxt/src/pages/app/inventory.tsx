import { useState, useEffect, useRef, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
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
import {
  Plus, Search, Trash2, Pencil, Package, Printer, Download,
  ScanBarcode, Info, X, CheckCircle2, AlertTriangle,
} from "lucide-react";
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

type InventoryItem = {
  id: number; name: string; category: string; purity: string;
  grossWeight: number; netWeight: number; stoneWeight: number;
  stoneValue: number | null; makingCharges: number; metalRate: number;
  totalValue: number; quantity: number; branch: string;
  huid: string | null; barcode: string | null; karigarId: number | null;
  karigarName: string | null; lowStockThreshold: number; createdAt: string;
  itemType?: string;
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCsv(items: InventoryItem[], filename = "inventory.csv") {
  const headers = [
    "ID", "Name", "Category", "Purity", "Gross Weight (g)", "Net Weight (g)",
    "Stone Weight (g)", "Stone Value (₹)", "Making Charges (%)", "Metal Rate (₹/g)",
    "Total Value (₹)", "Quantity", "Branch", "HUID", "Barcode",
    "Low Stock Threshold", "Karigar", "Created At",
  ];

  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = items.map(i => [
    i.id, i.name, i.category, i.purity,
    i.grossWeight, i.netWeight, i.stoneWeight, i.stoneValue ?? "",
    i.makingCharges, i.metalRate, i.totalValue, i.quantity,
    i.branch, i.huid ?? "", i.barcode ?? "",
    i.lowStockThreshold, i.karigarName ?? "",
    new Date(i.createdAt).toLocaleDateString("en-IN"),
  ].map(escape).join(","));

  const bom = "﻿"; // UTF-8 BOM so Excel opens Indian text correctly
  const csv = bom + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Barcode label printing ───────────────────────────────────────────────────

type LabelSize = "thermal58" | "thermal80" | "a4sheet";

function printBarcodeLabel(params: {
  item: { id: number; name: string; category: string; purity: string; grossWeight: number; totalValue: number; barcode: string | null };
  shopName: string;
  labelSize?: LabelSize;
  onSaveBarcode?: (barcode: string) => void;
}) {
  const { item, shopName, labelSize = "thermal58", onSaveBarcode } = params;
  const barcode = item.barcode || `SD${item.id.toString().padStart(6, "0")}`;
  if (!item.barcode && onSaveBarcode) onSaveBarcode(barcode);

  const isA4 = labelSize === "a4sheet";
  const labelW = labelSize === "thermal58" ? "54mm" : labelSize === "thermal80" ? "76mm" : "60mm";
  const copies = isA4 ? 24 : 1;

  const labelHtml = (i: number) => `
    <div class="label">
      <div class="shop">${shopName}</div>
      <div class="name">${item.name}</div>
      <div class="meta">${item.purity} &middot; ${item.grossWeight.toFixed(3)}g &middot; ${item.category}</div>
      <div class="price">&#8377;${item.totalValue.toLocaleString("en-IN")}</div>
      <svg id="bc${i}" class="bc"></svg>
    </div>`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Label – ${item.name}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#fff;padding:${isA4 ? "12px" : "4px"}}
.grid{display:flex;flex-wrap:wrap;gap:${isA4 ? "6px" : "0"};${isA4 ? "" : "flex-direction:column"}}
.label{
  border:1px solid #ccc;border-radius:3px;padding:6px 8px;
  width:${labelW};text-align:center;page-break-inside:avoid;
  ${isA4 ? "" : "page-break-after:always;margin-bottom:4px"}
}
.label:last-child{page-break-after:auto}
.shop{font-size:8px;font-weight:700;color:#1a6640;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px}
.name{font-size:10px;font-weight:700;color:#111;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta{font-size:8px;color:#555;margin-bottom:4px}
.price{font-size:13px;font-weight:800;color:#1a6640;margin-bottom:4px}
.bc{max-width:100%}
.btn{display:block;margin:0 auto 12px;padding:7px 20px;background:#1a6640;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600}
@media print{.btn{display:none!important}body{padding:0}${isA4 ? "" : ".label{border:none}"}}
</style>
</head>
<body>
<button class="btn" onclick="window.print()">🖨️ Print ${isA4 ? `${copies} Labels` : "Label"}</button>
<div class="grid">
${Array.from({ length: copies }, (_, i) => labelHtml(i)).join("")}
</div>
<script>
var bc='${barcode.replace(/'/g, "\\'")}';
for(var i=0;i<${copies};i++){
  try{
    JsBarcode(document.getElementById('bc'+i),bc,{
      format:'CODE128',width:${labelSize === "thermal58" ? "1.2" : "1.6"},
      height:${labelSize === "thermal58" ? "38" : "45"},
      displayValue:true,fontSize:8,margin:2
    });
  }catch(e){}
}
<\/script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=780,height=600");
  if (w) { w.document.write(html); w.document.close(); }
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("swarndesk_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getStatusBadge(qty: number, threshold: number) {
  if (qty <= 0) return <Badge variant="destructive">Out of Stock</Badge>;
  if (qty <= threshold) return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">Low Stock</Badge>;
  return <Badge variant="secondary">In Stock</Badge>;
}

// ─── Item form dialog ─────────────────────────────────────────────────────────

function ItemFormDialog({
  open, onOpenChange, title, defaultValues, onSubmit, isPending, rates, testIdPrefix,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string;
  defaultValues: Partial<ItemForm>; onSubmit: (data: ItemForm) => void;
  isPending: boolean; rates: { gold22k: number; gold24k: number; gold18k: number; silver: number } | undefined;
  testIdPrefix: string;
}) {
  const { register, handleSubmit, reset, setValue, control } = useForm<ItemForm>({
    defaultValues: { category: "gold", purity: "22K", quantity: 1, branch: "Main", stoneWeight: 0, lowStockThreshold: 2, itemType: "Ring", ...defaultValues },
  });
  const watchedValues = useWatch({ control });
  const netW = parseFloat(String(watchedValues.netWeight || 0));
  const stoneW = parseFloat(String(watchedValues.stoneWeight || 0));
  const makingPct = parseFloat(String(watchedValues.makingCharges || 0));
  const cat = watchedValues.category ?? "gold";
  const pur = watchedValues.purity ?? "22K";
  const metalRate = cat === "silver" ? (rates?.silver ?? 95)
    : cat === "platinum" ? 3500
    : pur === "24K" ? (rates?.gold24k ?? 7900)
    : pur === "18K" ? (rates?.gold18k ?? 5940)
    : (rates?.gold22k ?? 7250);
  const metalValue = Math.max(0, netW - stoneW) * metalRate;
  const makingAmt = Math.round(metalValue * makingPct / 100);
  const previewTotal = Math.round(metalValue + makingAmt);

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
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
                <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <Select defaultValue={defaultValues.category ?? "gold"} onValueChange={v => setValue("category", v)}>
                <SelectTrigger data-testid={`${testIdPrefix}-category`}><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Purity</label>
              <Select defaultValue={defaultValues.purity ?? "22K"} onValueChange={v => setValue("purity", v)}>
                <SelectTrigger data-testid={`${testIdPrefix}-purity`}><SelectValue /></SelectTrigger>
                <SelectContent>{PURITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
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
              <label className="text-xs text-muted-foreground mb-1 block">Making Charges (%) *</label>
              <Input type="number" step="0.01" placeholder="e.g. 12" {...register("makingCharges", { required: true })} data-testid={`${testIdPrefix}-making-charges`} />
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
              <label className="text-xs text-muted-foreground mb-1 block">Barcode (optional — leave blank to auto-generate)</label>
              <Input {...register("barcode")} placeholder="Leave blank to auto-generate when printing" data-testid={`${testIdPrefix}-barcode`} />
            </div>
          </div>
          {previewTotal > 0 && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1.5">
              <div className="font-semibold text-primary mb-1">Price Preview (at current rates)</div>
              <div className="flex justify-between"><span className="text-muted-foreground">Metal rate ({cat})</span><span>₹{metalRate.toLocaleString("en-IN")}/g</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Metal value ({Math.max(0, netW - stoneW).toFixed(3)}g)</span><span>{formatCurrency(metalValue)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Making charges ({makingPct}%)</span><span>{formatCurrency(makingAmt)}</span></div>
              <div className="flex justify-between font-bold text-sm text-primary border-t border-primary/20 pt-1.5"><span>Total Value</span><span>{formatCurrency(previewTotal)}</span></div>
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

// ─── Barcode + Printer guide dialog ──────────────────────────────────────────

function HardwareGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="w-5 h-5 text-primary" />
            Barcode Scanner & Printer Setup
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-sm">

          <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 text-xs">No drivers or special software needed. Both devices work out-of-the-box with any Windows/Mac/Android device.</p>
          </div>

          {/* Scanner section */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <ScanBarcode className="w-4 h-4 text-primary" /> Connecting a Barcode Scanner
            </h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Recommended: USB / Bluetooth Wired Scanner (e.g. Honeywell, Zebra, iBall, Retsol)</p>
              <ol className="list-decimal pl-4 space-y-1.5">
                <li><strong>Plug in</strong> the USB scanner — Windows installs it automatically as a keyboard. No drivers needed.</li>
                <li>Open this app and click the <strong>"🔍 Scan Mode"</strong> button (top-right of inventory).</li>
                <li>A green input box will appear. <strong>Point your scanner</strong> at any barcode and press the trigger.</li>
                <li>The scanner sends the barcode number + Enter key. The app instantly finds and highlights that item.</li>
                <li>Use "Scan Mode" during billing too — scanning adds items to the cart automatically.</li>
              </ol>
              <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800">
                <strong>Tip:</strong> The scan input works with any scanner model. Just make sure the cursor is inside the scan box before scanning.
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Printer section */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-primary" /> Connecting a Label Printer
            </h3>
            <div className="space-y-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Works with any printer — regular ink/laser or thermal.</p>

              <div>
                <p className="font-medium text-foreground mb-1">Option A — Regular Printer (A4 sticker sheet)</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Buy <strong>A4 peel-off label sheets</strong> (Avery / Oddy brand, 24 labels per sheet). Available on Amazon for ₹4–8/sheet.</li>
                  <li>Click the 🖨️ label button on any item. Select <strong>"A4 Sheet (24 labels)"</strong>.</li>
                  <li>Click "Print Labels" → your browser's print dialog opens.</li>
                  <li>Select your printer, set paper size to A4, no margins. Print.</li>
                  <li>Peel labels and stick on the jewellery tag / box.</li>
                </ol>
              </div>

              <div>
                <p className="font-medium text-foreground mb-1">Option B — Thermal Label Printer (recommended for daily use)</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Buy any <strong>58mm or 80mm thermal printer</strong> (e.g. Zywell ZY801, TVS LP46, Xprinter XP-365B). Cost: ₹1,500–₹5,000.</li>
                  <li>Connect via USB. Windows installs as a normal printer.</li>
                  <li>Click 🖨️ on an item. Select <strong>"58mm Thermal"</strong> or <strong>"80mm Thermal"</strong>.</li>
                  <li>Browser print dialog opens → select your thermal printer → Print.</li>
                  <li><strong>Set browser page size to match your paper width</strong> (58mm or 80mm) for a perfect fit.</li>
                </ol>
                <div className="mt-1.5 p-2 rounded bg-blue-50 border border-blue-200 text-blue-800">
                  <strong>Chrome tip:</strong> In print dialog → More settings → Paper size → Custom → set width to 58mm or 80mm, height to 40mm. Save as preset for 1-click printing next time.
                </div>
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Quick reference */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Quick Reference</h3>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-muted/50"><th className="text-left px-2 py-1.5 border border-border">Device</th><th className="text-left px-2 py-1.5 border border-border">Connection</th><th className="text-left px-2 py-1.5 border border-border">Driver</th><th className="text-left px-2 py-1.5 border border-border">Cost</th></tr></thead>
              <tbody>
                {[
                  ["USB Barcode Scanner", "Plug USB", "None (HID keyboard)", "₹500–₹2,000"],
                  ["BT Barcode Scanner", "Pair Bluetooth", "None", "₹1,000–₹4,000"],
                  ["58mm Thermal", "USB or BT", "Auto Windows", "₹1,500–₹3,000"],
                  ["80mm Thermal", "USB or BT", "Auto Windows", "₹2,500–₹5,000"],
                  ["A4 Ink/Laser", "USB/WiFi", "Auto Windows", "Already have one"],
                ].map(r => (
                  <tr key={r[0]} className="hover:bg-muted/20">
                    {r.map((c, i) => <td key={i} className="px-2 py-1.5 border border-border">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Got it!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [labelSize, setLabelSize] = useState<LabelSize>("thermal58");
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<null | {
    id: number; name: string; category: string; purity: string; itemType?: string;
    grossWeight: number; netWeight: number; stoneWeight: number;
    makingCharges: number; quantity: number; branch: string;
    huid: string | null; barcode: string | null; lowStockThreshold: number;
  }>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = {
    ...(search ? { search } : {}),
    ...(category !== "all" ? { category } : {}),
  };
  const { data: rawItems, isLoading } = useListInventoryItems(params);
  const { data: rates } = useGetCurrentRates();
  const { data: categoryStats } = useGetInventoryStatsByCategory();
  const createItem = useCreateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const { data: settings } = useGetSettings();

  // Cast to extended type
  const items = (rawItems ?? []) as InventoryItem[];

  const getLiveRate = (category: string, purity: string) => {
    if (category === "silver") return rates?.silver ?? 95;
    if (category === "platinum") return 3500;
    if (purity === "24K") return rates?.gold24k ?? 7900;
    if (purity === "18K") return rates?.gold18k ?? 5940;
    return rates?.gold22k ?? 7250;
  };

  const getLiveValue = (item: InventoryItem) => {
    const liveRate = getLiveRate(item.category, item.purity);
    const metalVal = item.netWeight * liveRate;
    return Math.round(metalVal * (1 + item.makingCharges / 100) + (item.stoneValue ?? 0));
  };

  const metalRateMap: Record<string, number> = {
    gold: rates?.gold22k ?? 7250, silver: rates?.silver ?? 95,
    diamond: rates?.gold22k ?? 7250, kundan: rates?.gold22k ?? 7250,
    platinum: 3500, antique: rates?.gold22k ?? 7250,
  };

  // Focus scan input when scan mode activates
  useEffect(() => {
    if (scanMode) scanRef.current?.focus();
  }, [scanMode]);

  // Handle barcode scan submission (scanner sends Enter after code)
  const handleScan = useCallback((value: string) => {
    const code = value.trim();
    if (!code) return;
    setScannedBarcode(code);
    setSearch(code);
    setScanInput("");
    toast({ title: `Scanned: ${code}` });
  }, [toast]);

  const buildPayload = (data: ItemForm) => {
    const metalRate = getLiveRate(data.category, data.purity);
    const netW = parseFloat(String(data.netWeight));
    const stoneW = parseFloat(String(data.stoneWeight || 0));
    const makingPct = parseFloat(String(data.makingCharges));
    const metalVal = Math.max(0, netW - stoneW) * metalRate;
    const totalValue = metalVal + metalVal * makingPct / 100;
    return {
      ...data,
      grossWeight: parseFloat(String(data.grossWeight)),
      netWeight: netW,
      stoneWeight: stoneW,
      makingCharges: makingPct,
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
      const r = await fetch(`/api/inventory/${editItem.id}`, {
        method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(buildPayload(data)),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed");
      queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
      toast({ title: "Item updated successfully" });
      setEditItem(null);
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to update item", variant: "destructive" });
    }
  };

  const handleExportCsv = () => {
    if (!items.length) { toast({ title: "No items to export", variant: "destructive" }); return; }
    const dateStr = new Date().toISOString().split("T")[0];
    exportToCsv(items, `inventory-${dateStr}.csv`);
    toast({ title: `Exported ${items.length} items to CSV` });
  };

  // Highlight row when barcode is scanned
  const isScannedItem = (item: InventoryItem) =>
    scannedBarcode && (item.barcode === scannedBarcode || item.huid === scannedBarcode);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Manage your jewellery stock</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setGuideOpen(true)}>
            <Info className="w-4 h-4" />Scanner & Printer Setup
          </Button>
          <Button
            variant={scanMode ? "default" : "outline"}
            size="sm"
            className={`gap-1.5 ${scanMode ? "bg-green-600 hover:bg-green-700" : ""}`}
            onClick={() => { setScanMode(s => !s); setScannedBarcode(null); }}
          >
            <ScanBarcode className="w-4 h-4" />
            {scanMode ? "Exit Scan Mode" : "🔍 Scan Mode"}
          </Button>
          {/* Label size selector */}
          <Select value={labelSize} onValueChange={v => setLabelSize(v as LabelSize)}>
            <SelectTrigger className="h-9 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thermal58">58mm Thermal</SelectItem>
              <SelectItem value="thermal80">80mm Thermal</SelectItem>
              <SelectItem value="a4sheet">A4 Sheet (24 labels)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv}>
            <Download className="w-4 h-4" />Export CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-2" data-testid="button-add-inventory">
            <Plus className="w-4 h-4" />Add Item
          </Button>
        </div>
      </div>

      {/* Scan mode input */}
      {scanMode && (
        <div className="p-3 rounded-xl bg-green-50 border-2 border-green-400 flex items-center gap-3">
          <ScanBarcode className="w-5 h-5 text-green-600 flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-green-800 mb-1">Scan Mode Active — point your scanner at any barcode</p>
            <input
              ref={scanRef}
              type="text"
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { handleScan(scanInput); e.preventDefault(); }
              }}
              placeholder="Scanner input appears here automatically..."
              className="w-full bg-white border border-green-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-green-500 font-mono"
              autoComplete="off"
            />
          </div>
          <button onClick={() => { setScanMode(false); setScannedBarcode(null); setScanInput(""); }} className="text-green-600 hover:text-green-800">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {scannedBarcode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Showing results for scanned barcode: <strong className="font-mono">{scannedBarcode}</strong>
          <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => { setScannedBarcode(null); setSearch(""); }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            onChange={e => { setSearch(e.target.value); setScannedBarcode(null); }}
            className="pl-9"
            data-testid="input-search-inventory"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-category-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Items table */}
      <Card className="border-border">
        <CardHeader className="pb-0 pt-3 px-4 flex flex-row items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {isLoading ? "Loading..." : `${items.length} item${items.length !== 1 ? "s" : ""}`}
            {search && ` for "${search}"`}
          </span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium">Item</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-left font-medium">Purity</th>
                <th className="px-4 py-3 text-right font-medium">Gross Wt</th>
                <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Net Wt</th>
                <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Making</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 text-center font-medium hidden sm:table-cell">Qty</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <div className="text-muted-foreground">{search ? `No items found for "${search}"` : "No items found."}</div>
                    {!search && <div className="text-xs text-muted-foreground mt-1">Add your first inventory item to get started.</div>}
                  </td>
                </tr>
              )}
              {items.map(item => (
                <tr
                  key={item.id}
                  className={`border-b border-border hover:bg-muted/10 transition-colors ${isScannedItem(item) ? "bg-green-50 ring-2 ring-inset ring-green-400" : ""}`}
                  data-testid={`row-inventory-${item.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium flex items-center gap-1.5">
                      {item.name}
                      {isScannedItem(item) && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                    </div>
                    {item.huid && <div className="text-xs text-muted-foreground">HUID: {item.huid}</div>}
                    {item.barcode && <div className="text-xs text-muted-foreground font-mono">#{item.barcode}</div>}
                    {item.itemType && <div className="text-xs text-muted-foreground">{item.itemType}</div>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="outline" className="capitalize">{item.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{item.purity}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">{item.grossWeight.toFixed(3)}g</td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden md:table-cell">{item.netWeight.toFixed(3)}g</td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden md:table-cell">{item.makingCharges.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(getLiveValue(item))}</td>
                  <td className="px-4 py-3 text-center font-medium hidden sm:table-cell">{item.quantity}</td>
                  <td className="px-4 py-3 text-center">{getStatusBadge(item.quantity, item.lowStockThreshold ?? 2)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => printBarcodeLabel({
                          item: { id: item.id, name: item.name, category: item.category, purity: item.purity, grossWeight: item.grossWeight, totalValue: item.totalValue, barcode: item.barcode ?? null },
                          shopName: settings?.businessName ?? "SwarnDesk",
                          labelSize,
                          onSaveBarcode: async (bc) => {
                            try {
                              const r = await fetch(`/api/inventory/${item.id}`, {
                                method: "PATCH", headers: getAuthHeaders(),
                                body: JSON.stringify({ barcode: bc }),
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
                          id: item.id, name: item.name, category: item.category, purity: item.purity,
                          itemType: item.itemType ?? "Ring", grossWeight: item.grossWeight,
                          netWeight: item.netWeight, stoneWeight: item.stoneWeight ?? 0,
                          makingCharges: item.makingCharges, quantity: item.quantity,
                          branch: item.branch ?? "Main", huid: item.huid ?? null,
                          barcode: item.barcode ?? null, lowStockThreshold: item.lowStockThreshold ?? 2,
                        })}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`button-edit-${item.id}`} title="Edit item"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
                          deleteItem.mutate({ id: item.id }, {
                            onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
                              toast({ title: "Item deleted" });
                            },
                            onError: () => toast({ title: "Failed to delete item", variant: "destructive" }),
                          });
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        data-testid={`button-delete-${item.id}`} title="Delete item"
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
        {items.length > 0 && (
          <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{items.length} items · Total value: <strong className="text-foreground">{formatCurrency(items.reduce((s, i) => s + i.totalValue * i.quantity, 0))}</strong></span>
            <button onClick={handleExportCsv} className="flex items-center gap-1 hover:text-primary transition-colors">
              <Download className="w-3 h-3" />Export CSV
            </button>
          </div>
        )}
      </Card>

      {/* Add item dialog */}
      <ItemFormDialog
        open={addOpen} onOpenChange={setAddOpen} title="Add Inventory Item"
        defaultValues={{ category: "gold", purity: "22K", quantity: 1, branch: "Main", stoneWeight: 0, lowStockThreshold: 2, itemType: "Ring" }}
        onSubmit={onAdd} isPending={createItem.isPending} rates={rates} testIdPrefix="input-item"
      />

      {/* Edit item dialog */}
      {editItem && (
        <ItemFormDialog
          open={!!editItem} onOpenChange={v => !v && setEditItem(null)} title={`Edit — ${editItem.name}`}
          defaultValues={{
            name: editItem.name, category: editItem.category, purity: editItem.purity,
            itemType: editItem.itemType ?? "Ring", grossWeight: editItem.grossWeight,
            netWeight: editItem.netWeight, stoneWeight: editItem.stoneWeight,
            makingCharges: editItem.makingCharges, quantity: editItem.quantity,
            branch: editItem.branch ?? "Main", huid: editItem.huid ?? "",
            barcode: editItem.barcode ?? "", lowStockThreshold: editItem.lowStockThreshold,
          }}
          onSubmit={onEdit} isPending={false} rates={rates} testIdPrefix="input-edit-item"
        />
      )}

      {/* Hardware guide dialog */}
      <HardwareGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
