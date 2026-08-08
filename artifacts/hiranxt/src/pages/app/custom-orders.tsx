import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  useListCustomOrders, useCreateCustomOrder, useUpdateCustomOrder, useDeleteCustomOrder,
  useListKarigars, useGetSettings, getListCustomOrdersQueryKey,
} from "@workspace/api-client-react";
import type { CustomOrderInput, CustomOrderUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, PrinterIcon, AlertTriangle, CheckCircle2,
  ArrowRight, User, Hammer, Package, ChevronRight,
} from "lucide-react";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";
import { InfoTooltip } from "@/components/InfoTooltip";
import { BankAccountSelect } from "@/components/BankAccountSelect";
import { useToast } from "@/hooks/use-toast";

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUSES = ["pending", "karigar_assigned", "in_progress", "karigar_returned", "ready", "delivered", "cancelled"] as const;
type Status = typeof STATUSES[number];

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  karigar_assigned: "Karigar Assigned",
  in_progress: "With Karigar",
  karigar_returned: "Quality Check",
  ready: "Ready for Pickup",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<Status, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-300",
  karigar_assigned: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-orange-50 text-orange-700 border-orange-200",
  karigar_returned: "bg-purple-50 text-purple-700 border-purple-200",
  ready: "bg-green-50 text-green-700 border-green-200",
  delivered: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const ACTIVE_STATUSES: Status[] = ["pending", "karigar_assigned", "in_progress", "karigar_returned", "ready"];
const ITEM_TYPES = ["Ring", "Necklace", "Bangle", "Chain", "Earring", "Pendant", "Bracelet", "Mangalsutra", "Payal", "Tikka", "Nose Ring", "Other"];
const METAL_TYPES = ["gold", "silver"];
const GOLD_PURITIES = ["24K", "22K", "18K", "14K"];
const SILVER_PURITIES = ["999", "925"];
const puritiesForMetal = (metalType: string) => metalType === "silver" ? SILVER_PURITIES : GOLD_PURITIES;

// ─── Types ────────────────────────────────────────────────────────────────────

type Order = {
  id: number;
  orderNumber: string;
  customerId?: number | null;
  customerName: string;
  customerMobile: string;
  itemType: string;
  description?: string | null;
  metalType: string;
  purity: string;
  targetWeight?: number | null;
  estimatedPrice?: number | null;
  agreedPrice?: number | null;
  bookingMetalRate?: number | null;
  advancePaid: number;
  status: string;
  karigarId?: number | null;
  karigarName?: string | null;
  metalIssuedWeight?: number | null;
  metalIssuedDate?: string | null;
  finishedWeight?: number | null;
  wastageWeight?: number | null;
  karigarReturnDate?: string | null;
  karigarWages?: number | null;
  karigarNotes?: string | null;
  orderDate: string;
  dueDate: string;
  deliveryDate?: string | null;
  finalPrice?: number | null;
  notes?: string | null;
  createdAt: string;
};

type CreateForm = {
  customerName: string; customerMobile: string;
  itemType: string; description: string;
  metalType: string; purity: string;
  targetWeight: string; estimatedPrice: string; agreedPrice: string; bookingMetalRate: string; advancePaid: string; paymentMode: string;
  orderDate: string; dueDate: string; notes: string;
};

const PAYMENT_MODES = ["cash", "upi", "card", "bank"];

const EMPTY_CREATE: CreateForm = {
  customerName: "", customerMobile: "",
  itemType: "Ring", description: "",
  metalType: "gold", purity: "22K",
  targetWeight: "", estimatedPrice: "", agreedPrice: "", bookingMetalRate: "", advancePaid: "", paymentMode: "cash",
  orderDate: new Date().toISOString().split("T")[0], dueDate: "", notes: "",
};

// ─── Print order card ─────────────────────────────────────────────────────────

function printOrderCard(order: Order, shopName: string, shopAddress: string, shopMobile: string) {
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const fmtD = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Custom Order – ${order.orderNumber}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;font-size:12px;background:#fff}
.page{max-width:420px;margin:0 auto;padding:20px}
.shop{text-align:center;border-bottom:2px solid #1a3e6e;padding-bottom:10px;margin-bottom:12px}
.shop-name{font-size:17px;font-weight:800;color:#1a3e6e}
.shop-sub{font-size:10px;color:#555;margin-top:2px}
.title{text-align:center;font-weight:700;font-size:13px;color:#c0392b;letter-spacing:1px;margin:8px 0;border:1px dashed #c0392b;padding:5px}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#666;margin:10px 0 4px;padding-bottom:3px;border-bottom:1px solid #eee}
.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #eee}
.label{color:#666}
.value{font-weight:600;text-align:right;max-width:55%;word-break:break-word}
.status-badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc}
.highlight{background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px 10px;margin:8px 0;font-size:13px;font-weight:800;text-align:center;color:#92400e}
.note-box{margin-top:8px;padding:6px;background:#f8f9fa;border-radius:4px;font-size:11px;color:#555;border-left:3px solid #1a3e6e}
.sig-row{display:flex;justify-content:space-between;margin-top:24px}
.sig-box{text-align:center;width:45%}
.sig-line{border-top:1px solid #333;margin-bottom:4px}
.sig-label{font-size:9px;color:#666}
.footer{text-align:center;font-size:10px;color:#aaa;margin-top:16px;border-top:1px dashed #ddd;padding-top:8px}
@media print{.no-print{display:none!important}}
</style></head><body>
<div class="page">
<div class="no-print" style="text-align:right;margin-bottom:12px">
  <button onclick="window.print()" style="background:#1a3e6e;color:#fff;border:none;padding:6px 16px;border-radius:4px;font-size:12px;cursor:pointer">🖨 Print</button>
</div>
<div class="shop">
  <div class="shop-name">${shopName}</div>
  <div class="shop-sub">${shopAddress}${shopMobile ? ` · ${shopMobile}` : ""}</div>
</div>
<div class="title">CUSTOM ORDER RECEIPT</div>
<div class="row"><span class="label">Order No.</span><span class="value">${order.orderNumber}</span></div>
<div class="row"><span class="label">Date</span><span class="value">${fmtD(order.orderDate)}</span></div>
<div class="row"><span class="label">Status</span><span class="value"><span class="status-badge">${STATUS_LABEL[order.status as Status] ?? order.status}</span></span></div>

<div class="section-title">Customer</div>
<div class="row"><span class="label">Name</span><span class="value">${order.customerName}</span></div>
<div class="row"><span class="label">Mobile</span><span class="value">${order.customerMobile}</span></div>

<div class="section-title">Item Specification</div>
<div class="row"><span class="label">Item</span><span class="value">${order.itemType}</span></div>
<div class="row"><span class="label">Metal</span><span class="value">${order.metalType === "gold" ? "Gold" : "Silver"} ${order.purity}</span></div>
${order.targetWeight ? `<div class="row"><span class="label">Target Weight</span><span class="value">${order.targetWeight.toFixed(3)} g</span></div>` : ""}
${order.description ? `<div class="row"><span class="label">Design Notes</span><span class="value" style="max-width:60%;text-align:right;font-size:11px">${order.description}</span></div>` : ""}
<div class="row"><span class="label">Due Date</span><span class="value">${fmtD(order.dueDate)}</span></div>

<div class="section-title">Pricing</div>
${order.estimatedPrice != null ? `<div class="row"><span class="label">Estimated</span><span class="value">${fmt(order.estimatedPrice)}</span></div>` : ""}
${order.agreedPrice != null ? `<div class="row"><span class="label">Agreed Price</span><span class="value">${fmt(order.agreedPrice)}</span></div>` : ""}
<div class="highlight">Advance Paid: ${fmt(order.advancePaid)}${order.agreedPrice != null ? `  ·  Balance: ${fmt(Math.max(0, order.agreedPrice - order.advancePaid))}` : ""}</div>

${order.karigarName ? `
<div class="section-title">Karigar</div>
<div class="row"><span class="label">Assigned To</span><span class="value">${order.karigarName}</span></div>
${order.metalIssuedWeight != null ? `<div class="row"><span class="label">Metal Issued</span><span class="value">${order.metalIssuedWeight.toFixed(3)} g ${order.metalType === "gold" ? "Gold" : "Silver"} ${order.purity}</span></div>` : ""}
${order.metalIssuedDate ? `<div class="row"><span class="label">Issue Date</span><span class="value">${fmtD(order.metalIssuedDate)}</span></div>` : ""}
${order.finishedWeight != null ? `<div class="row"><span class="label">Finished Weight</span><span class="value">${order.finishedWeight.toFixed(3)} g</span></div>` : ""}
${order.wastageWeight != null ? `<div class="row"><span class="label">Wastage</span><span class="value">${order.wastageWeight.toFixed(3)} g</span></div>` : ""}
${order.karigarWages != null ? `<div class="row"><span class="label">Karigar Wages</span><span class="value">${fmt(order.karigarWages)}</span></div>` : ""}
` : ""}

${order.deliveryDate ? `
<div class="section-title">Delivery</div>
<div class="row"><span class="label">Delivered On</span><span class="value">${fmtD(order.deliveryDate)}</span></div>
${order.finalPrice != null ? `<div class="row"><span class="label">Final Price</span><span class="value">${fmt(order.finalPrice)}</span></div>` : ""}
` : ""}

${order.notes ? `<div class="note-box">Notes: ${order.notes}</div>` : ""}

<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Customer Signature</div><div style="font-size:10px;color:#999;margin-top:2px">${order.customerName}</div></div>
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Authorised by ${shopName}</div></div>
</div>
<div class="footer">This is a computer-generated custom order receipt. Powered by SwarnDesk (by TirthonTech)</div>
</div></body></html>`;

  const w = window.open("", "_blank", "width=480,height=700");
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CustomOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useListCustomOrders();
  const { data: karigars = [] } = useListKarigars();
  const { data: settings } = useGetSettings();
  const createOrder = useCreateCustomOrder();
  const updateOrder = useUpdateCustomOrder();
  const deleteOrder = useDeleteCustomOrder();

  const shopName = settings?.businessName ?? "SwarnDesk Jewellers";
  const shopAddress = settings?.address ?? "";
  const shopMobile = settings?.mobile ?? "";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCustomOrdersQueryKey() });

  // ── View filter ──
  const [statusView, setStatusView] = useState<"active" | "delivered" | "cancelled">("active");
  const [pageHelpOpen, setPageHelpOpen] = useState(false);

  // ── Create dialog ──
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE);
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);
  const setF = (k: keyof CreateForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  // ── Edit dialog ──
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editBankAccountId, setEditBankAccountId] = useState<number | null>(null);
  const setEF = (k: keyof CreateForm, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  // ── Karigar assign dialog ──
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [selectedKarigarId, setSelectedKarigarId] = useState("");
  const [metalIssueWeight, setMetalIssueWeight] = useState("");

  // ── Karigar returned dialog ──
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [finishedWeight, setFinishedWeight] = useState("");
  const [wastageWeight, setWastageWeight] = useState("");
  const [karigarWages, setKarigarWages] = useState("");
  const [karigarNotes, setKarigarNotes] = useState("");

  // ── Deliver dialog ──
  const [deliverOrder, setDeliverOrder] = useState<Order | null>(null);
  const [finalPrice, setFinalPrice] = useState("");
  const [advanceAtDelivery, setAdvanceAtDelivery] = useState("");
  const [deliverPaymentMode, setDeliverPaymentMode] = useState("cash");
  const [deliverBankAccountId, setDeliverBankAccountId] = useState<number | null>(null);

  // ── Delete confirmation ──
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  // ── Filtered orders ──
  const visibleOrders = orders.filter(o => {
    if (statusView === "active") return ACTIVE_STATUSES.includes(o.status as Status);
    return o.status === statusView;
  }) as Order[];

  // ── Handlers ──

  const handleCreate = () => {
    if (!form.customerName.trim() || !form.customerMobile.trim()) {
      toast({ title: "Customer name and mobile required", variant: "destructive" }); return;
    }
    if (!form.dueDate) { toast({ title: "Due date required", variant: "destructive" }); return; }
    const createPayload: CustomOrderInput & { orderDate?: string } = {
      customerName: form.customerName.trim(),
      customerMobile: form.customerMobile.trim(),
      itemType: form.itemType,
      description: form.description.trim() || null,
      metalType: form.metalType,
      purity: form.purity,
      targetWeight: form.targetWeight ? parseFloat(form.targetWeight) : null,
      estimatedPrice: form.estimatedPrice ? parseFloat(form.estimatedPrice) : null,
      agreedPrice: form.agreedPrice ? parseFloat(form.agreedPrice) : null,
      bookingMetalRate: form.bookingMetalRate ? parseFloat(form.bookingMetalRate) : null,
      advancePaid: form.advancePaid ? parseFloat(form.advancePaid) : 0,
      paymentMode: form.paymentMode,
      bankAccountId: bankAccountId ?? undefined,
      orderDate: form.orderDate ? new Date(form.orderDate).toISOString() : undefined,
      dueDate: new Date(form.dueDate).toISOString(),
      notes: form.notes.trim() || null,
    };
    createOrder.mutate({ data: createPayload }, {
      onSuccess: () => { invalidate(); toast({ title: "Custom order created" }); setAddOpen(false); setForm(EMPTY_CREATE); setBankAccountId(null); },
      onError: () => toast({ title: "Failed to create order", variant: "destructive" }),
    });
  };

  const openEdit = (o: Order) => {
    setEditOrder(o);
    setEditBankAccountId(null);
    setEditForm({
      customerName: o.customerName, customerMobile: o.customerMobile,
      itemType: o.itemType, description: o.description ?? "",
      metalType: o.metalType, purity: o.purity,
      targetWeight: o.targetWeight != null ? String(o.targetWeight) : "",
      estimatedPrice: o.estimatedPrice != null ? String(o.estimatedPrice) : "",
      agreedPrice: o.agreedPrice != null ? String(o.agreedPrice) : "",
      bookingMetalRate: o.bookingMetalRate != null ? String(o.bookingMetalRate) : "",
      advancePaid: String(o.advancePaid),
      paymentMode: "cash",
      orderDate: o.orderDate.split("T")[0],
      dueDate: o.dueDate.split("T")[0],
      notes: o.notes ?? "",
    });
  };

  const handleEdit = () => {
    if (!editOrder) return;
    const editPayload: CustomOrderUpdate & { orderDate?: string } = {
      customerName: editForm.customerName.trim(),
      customerMobile: editForm.customerMobile.trim(),
      itemType: editForm.itemType,
      description: editForm.description.trim() || null,
      metalType: editForm.metalType,
      purity: editForm.purity,
      targetWeight: editForm.targetWeight ? parseFloat(editForm.targetWeight) : null,
      estimatedPrice: editForm.estimatedPrice ? parseFloat(editForm.estimatedPrice) : null,
      agreedPrice: editForm.agreedPrice ? parseFloat(editForm.agreedPrice) : null,
      bookingMetalRate: editForm.bookingMetalRate ? parseFloat(editForm.bookingMetalRate) : null,
      advancePaid: editForm.advancePaid ? parseFloat(editForm.advancePaid) : 0,
      paymentMode: editForm.paymentMode || "cash",
      bankAccountId: editBankAccountId ?? undefined,
      orderDate: editForm.orderDate ? new Date(editForm.orderDate).toISOString() : undefined,
      dueDate: new Date(editForm.dueDate).toISOString(),
      notes: editForm.notes.trim() || null,
    };
    updateOrder.mutate({
      id: editOrder.id,
      data: editPayload
    }, {
      onSuccess: () => { invalidate(); toast({ title: "Order updated" }); setEditOrder(null); setEditBankAccountId(null); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  const openAssign = (o: Order) => {
    setAssignOrder(o);
    setSelectedKarigarId(o.karigarId ? String(o.karigarId) : "");
    setMetalIssueWeight(o.metalIssuedWeight != null ? String(o.metalIssuedWeight) : o.targetWeight != null ? String(o.targetWeight) : "");
  };

  const handleAssign = () => {
    if (!assignOrder || !selectedKarigarId) { toast({ title: "Select a karigar", variant: "destructive" }); return; }
    const karigar = karigars.find(k => k.id === parseInt(selectedKarigarId));
    const issueWeight = parseFloat(metalIssueWeight);
    const isIssuingMetal = isFinite(issueWeight) && issueWeight > 0;
    updateOrder.mutate({
      id: assignOrder.id,
      data: {
        karigarId: parseInt(selectedKarigarId),
        karigarName: karigar?.name ?? "",
        status: isIssuingMetal ? "in_progress" : "karigar_assigned",
        ...(isIssuingMetal ? {
          metalIssuedWeight: issueWeight,
          metalIssuedDate: new Date().toISOString(),
        } : {}),
      }
    }, {
      onSuccess: () => {
        invalidate();
        toast({ title: isIssuingMetal ? `Metal issued to ${karigar?.name}` : `Order assigned to ${karigar?.name}` });
        setAssignOrder(null);
      },
      onError: () => toast({ title: "Failed to assign", variant: "destructive" }),
    });
  };

  const openReturn = (o: Order) => {
    setReturnOrder(o);
    setFinishedWeight("");
    setWastageWeight("");
    setKarigarWages("");
    setKarigarNotes("");
  };

  const handleReturn = () => {
    if (!returnOrder) return;
    const fw = parseFloat(finishedWeight);
    if (!isFinite(fw) || fw <= 0) { toast({ title: "Enter finished weight", variant: "destructive" }); return; }
    updateOrder.mutate({
      id: returnOrder.id,
      data: {
        status: "karigar_returned",
        finishedWeight: fw,
        wastageWeight: wastageWeight ? parseFloat(wastageWeight) : null,
        karigarReturnDate: new Date().toISOString(),
        karigarWages: karigarWages ? parseFloat(karigarWages) : null,
        karigarNotes: karigarNotes.trim() || null,
      }
    }, {
      onSuccess: () => { invalidate(); toast({ title: "Karigar return recorded" }); setReturnOrder(null); },
      onError: () => toast({ title: "Failed to record return", variant: "destructive" }),
    });
  };

  const handleMarkReady = (o: Order) => {
    updateOrder.mutate({ id: o.id, data: { status: "ready" } }, {
      onSuccess: () => { invalidate(); toast({ title: "Marked as ready for pickup" }); },
    });
  };

  const openDeliver = (o: Order) => {
    setDeliverOrder(o);
    setFinalPrice(o.agreedPrice != null ? String(o.agreedPrice) : o.estimatedPrice != null ? String(o.estimatedPrice) : "");
    setAdvanceAtDelivery("0");
    setDeliverPaymentMode("cash");
    setDeliverBankAccountId(null);
  };

  const handleDeliver = () => {
    if (!deliverOrder) return;
    const fp = parseFloat(finalPrice);
    updateOrder.mutate({
      id: deliverOrder.id,
      data: {
        status: "delivered",
        deliveryDate: new Date().toISOString(),
        finalPrice: isFinite(fp) ? fp : null,
        advancePaid: deliverOrder.advancePaid + (parseFloat(advanceAtDelivery) || 0),
        paymentMode: deliverPaymentMode,
        bankAccountId: deliverBankAccountId ?? undefined,
      }
    }, {
      onSuccess: () => { invalidate(); toast({ title: "Order delivered" }); setDeliverOrder(null); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteOrder.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { invalidate(); toast({ title: "Order deleted" }); setDeleteTarget(null); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1 font-medium";

  const balanceDue = (o: Order) => {
    const price = o.finalPrice ?? o.agreedPrice ?? o.estimatedPrice ?? 0;
    return Math.max(0, price - o.advancePaid);
  };

  const isOverdue = (o: Order) => o.status !== "delivered" && o.status !== "cancelled" && new Date(o.dueDate) < new Date();

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Orders</h1>
          <p className="text-muted-foreground text-sm">Customer orders made-to-order via karigar</p>
          <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />New Order
        </Button>
      </div>

      {/* Summary counts */}
      <div className="flex gap-2 flex-wrap">
        {(["pending", "karigar_assigned", "in_progress", "karigar_returned", "ready"] as Status[]).map(s => {
          const count = orders.filter(o => o.status === s).length;
          return count > 0 ? (
            <div key={s} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${STATUS_COLOR[s]}`}>
              {STATUS_LABEL[s]}: {count}
            </div>
          ) : null;
        })}
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {(["active", "delivered", "cancelled"] as const).map(v => (
          <button
            key={v}
            onClick={() => setStatusView(v)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${statusView === v ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {v === "active" ? "Active Orders" : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-muted-foreground text-sm text-center py-10">Loading orders...</div>}

      {!isLoading && visibleOrders.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {statusView === "active" ? "active" : statusView} custom orders</p>
          {statusView === "active" && (
            <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />Create First Order
            </Button>
          )}
        </div>
      )}

      {/* Orders list */}
      <div className="space-y-3">
        {visibleOrders.map(order => {
          const overdue = isOverdue(order);
          const balance = balanceDue(order);
          return (
            <Card key={order.id} className={`border-border transition-all ${overdue ? "border-l-4 border-l-destructive" : ""}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Main info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Order header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{order.orderNumber}</span>
                      <Badge variant="outline" className={`text-[10px] h-4 ${STATUS_COLOR[order.status as Status]}`}>
                        {STATUS_LABEL[order.status as Status] ?? order.status}
                      </Badge>
                      {overdue && (
                        <Badge variant="destructive" className="text-[10px] h-4 gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />Overdue
                        </Badge>
                      )}
                    </div>

                    {/* Customer + item */}
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-sm">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.customerMobile}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <div className="font-medium text-sm">{order.itemType}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.metalType === "gold" ? "Gold" : "Silver"} {order.purity}
                            {order.targetWeight ? ` · ${order.targetWeight}g target` : ""}
                          </div>
                        </div>
                      </div>
                      {order.karigarName && (
                        <div className="flex items-center gap-1.5">
                          <Hammer className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <div>
                            <div className="font-medium text-sm">{order.karigarName}</div>
                            <div className="text-xs text-muted-foreground">
                              {order.metalIssuedWeight != null ? `${order.metalIssuedWeight}g issued` : "Assigned, metal pending"}
                              {order.finishedWeight != null ? ` · ${order.finishedWeight}g returned` : ""}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {order.description && (
                      <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 italic">{order.description}</p>
                    )}

                    {/* Pricing row */}
                    <div className="flex items-center gap-4 flex-wrap text-xs">
                      {order.agreedPrice != null && (
                        <span><span className="text-muted-foreground">Agreed:</span> <strong className="text-primary">{formatCurrency(order.agreedPrice)}</strong></span>
                      )}
                      {order.estimatedPrice != null && order.agreedPrice == null && (
                        <span><span className="text-muted-foreground">Est.:</span> <strong>{formatCurrency(order.estimatedPrice)}</strong></span>
                      )}
                      <span><span className="text-muted-foreground">Advance:</span> <strong className="text-green-700">{formatCurrency(order.advancePaid)}</strong></span>
                      {balance > 0 && (
                        <span><span className="text-muted-foreground">Balance:</span> <strong className="text-orange-700">{formatCurrency(balance)}</strong></span>
                      )}
                      <span className={`${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        Due: {new Date(order.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
                    {/* Icon actions */}
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(order)} className="p-1.5 text-muted-foreground hover:text-primary rounded transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => printOrderCard(order, shopName, shopAddress, shopMobile)} className="p-1.5 text-muted-foreground hover:text-primary rounded transition-colors" title="Print"><PrinterIcon className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteTarget(order)} className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>

                    {/* Primary action button per status */}
                    {(order.status === "pending" || order.status === "karigar_assigned") && (
                      <Button size="sm" className="h-7 text-xs gap-1.5 whitespace-nowrap" onClick={() => openAssign(order)}>
                        <Hammer className="w-3 h-3" />
                        Assign Karigar
                      </Button>
                    )}
                    {order.status === "in_progress" && (
                      <Button size="sm" className="h-7 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap" onClick={() => openReturn(order)}>
                        <ArrowRight className="w-3 h-3" />Quality Check
                      </Button>
                    )}
                    {order.status === "karigar_returned" && (
                      <Button size="sm" className="h-7 text-xs gap-1.5 whitespace-nowrap" onClick={() => handleMarkReady(order)}>
                        <CheckCircle2 className="w-3 h-3" />Mark Ready
                      </Button>
                    )}
                    {order.status === "ready" && (
                      <Button size="sm" className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white whitespace-nowrap" onClick={() => openDeliver(order)}>
                        <ChevronRight className="w-3 h-3" />Deliver
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={addOpen} onOpenChange={v => { setAddOpen(v); if (!v) setForm(EMPTY_CREATE); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Custom Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Name *</label><input className={inp} value={form.customerName} onChange={e => setF("customerName", e.target.value)} placeholder="Full name" /></div>
                <div><label className={lbl}>Mobile *</label><input className={inp} value={form.customerMobile} onChange={e => setF("customerMobile", e.target.value)} placeholder="10-digit" /></div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item Specification</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Item Type *</label>
                  <Select value={form.itemType} onValueChange={v => setF("itemType", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={lbl}>Metal *</label>
                  <Select value={form.metalType} onValueChange={v => { setF("metalType", v); setF("purity", v === "silver" ? "925" : "22K"); }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{METAL_TYPES.map(m => <SelectItem key={m} value={m}>{m === "gold" ? "Gold" : "Silver"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={lbl}>Purity *</label>
                  <Select value={form.purity} onValueChange={v => setF("purity", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{puritiesForMetal(form.metalType).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className={lbl}>Target Weight (g)</label><input className={inp} type="number" step="0.001" value={form.targetWeight} onChange={e => setF("targetWeight", e.target.value)} placeholder="e.g. 15.000" /></div>
                <div className="col-span-2"><label className={lbl}>Design Notes / Description</label><input className={inp} value={form.description} onChange={e => setF("description", e.target.value)} placeholder="Design specs, customer preferences…" /></div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing & Timeline</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Estimated Price (₹)</label><input className={inp} type="number" value={form.estimatedPrice} onChange={e => setF("estimatedPrice", e.target.value)} /></div>
                <div><label className={lbl}>Agreed Price (₹)</label><input className={inp} type="number" value={form.agreedPrice} onChange={e => setF("agreedPrice", e.target.value)} /></div>
                <div>
                  <label className={lbl}>Metal Rate at Booking (₹/g) <span className="text-muted-foreground/60">optional — locks in what "the rate" meant today</span></label>
                  <input className={inp} type="number" value={form.bookingMetalRate} onChange={e => setF("bookingMetalRate", e.target.value)} placeholder="e.g. 7250" />
                </div>
                <div><label className={lbl}>Advance Collected (₹)</label><input className={inp} type="number" value={form.advancePaid} onChange={e => setF("advancePaid", e.target.value)} placeholder="0" /></div>
                <div>
                  <label className={lbl}>Payment Mode</label>
                  <Select value={form.paymentMode} onValueChange={v => { setF("paymentMode", v); setBankAccountId(null); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(m => <SelectItem key={m} value={m} className="capitalize">{m.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <BankAccountSelect paymentMode={form.paymentMode} bankAccountId={bankAccountId} onChange={setBankAccountId} />
                </div>
                <div><label className={lbl}>Order Date *</label><input className={inp} type="date" value={form.orderDate} onChange={e => setF("orderDate", e.target.value)} /></div>
                <div><label className={lbl}>Due Date *</label><input className={inp} type="date" value={form.dueDate} min={new Date().toISOString().split("T")[0]} onChange={e => setF("dueDate", e.target.value)} /></div>
                <div className="col-span-2"><label className={lbl}>Notes</label><input className={inp} value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Remarks…" /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createOrder.isPending}>{createOrder.isPending ? "Creating…" : "Create Order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editOrder} onOpenChange={v => { if (!v) setEditOrder(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Order {editOrder?.orderNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Name *</label><input className={inp} value={editForm.customerName} onChange={e => setEF("customerName", e.target.value)} /></div>
                <div><label className={lbl}>Mobile *</label><input className={inp} value={editForm.customerMobile} onChange={e => setEF("customerMobile", e.target.value)} /></div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item Specification</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Item Type *</label>
                  <Select value={editForm.itemType} onValueChange={v => setEF("itemType", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{ITEM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={lbl}>Metal *</label>
                  <Select value={editForm.metalType} onValueChange={v => { setEF("metalType", v); setEF("purity", v === "silver" ? "925" : "22K"); }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{METAL_TYPES.map(m => <SelectItem key={m} value={m}>{m === "gold" ? "Gold" : "Silver"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={lbl}>Purity *</label>
                  <Select value={editForm.purity} onValueChange={v => setEF("purity", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{puritiesForMetal(editForm.metalType).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><label className={lbl}>Target Weight (g)</label><input className={inp} type="number" step="0.001" value={editForm.targetWeight} onChange={e => setEF("targetWeight", e.target.value)} /></div>
                <div className="col-span-2"><label className={lbl}>Design Notes</label><input className={inp} value={editForm.description} onChange={e => setEF("description", e.target.value)} /></div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing & Timeline</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Estimated Price (₹)</label><input className={inp} type="number" value={editForm.estimatedPrice} onChange={e => setEF("estimatedPrice", e.target.value)} /></div>
                <div><label className={lbl}>Agreed Price (₹)</label><input className={inp} type="number" value={editForm.agreedPrice} onChange={e => setEF("agreedPrice", e.target.value)} /></div>
                <div>
                  <label className={lbl}>Metal Rate at Booking (₹/g)</label>
                  <input className={inp} type="number" value={editForm.bookingMetalRate} onChange={e => setEF("bookingMetalRate", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Advance Paid (₹) <span className="text-muted-foreground/60">increasing this logs a new payment</span></label>
                  <input className={inp} type="number" value={editForm.advancePaid} onChange={e => setEF("advancePaid", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Payment Mode <span className="text-muted-foreground/60">used only if advance increased</span></label>
                  <Select value={editForm.paymentMode} onValueChange={v => { setEF("paymentMode", v); setEditBankAccountId(null); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(m => <SelectItem key={m} value={m} className="capitalize">{m.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <BankAccountSelect paymentMode={editForm.paymentMode} bankAccountId={editBankAccountId} onChange={setEditBankAccountId} />
                </div>
                <div><label className={lbl}>Order Date *</label><input className={inp} type="date" value={editForm.orderDate} onChange={e => setEF("orderDate", e.target.value)} /></div>
                <div><label className={lbl}>Due Date *</label><input className={inp} type="date" value={editForm.dueDate} onChange={e => setEF("dueDate", e.target.value)} /></div>
                <div className="col-span-2"><label className={lbl}>Notes</label><input className={inp} value={editForm.notes} onChange={e => setEF("notes", e.target.value)} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrder(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateOrder.isPending}>{updateOrder.isPending ? "Saving…" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign karigar + issue metal ── */}
      <Dialog open={!!assignOrder} onOpenChange={v => { if (!v) setAssignOrder(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Karigar — {assignOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs space-y-1">
              <div><strong>{assignOrder?.customerName}</strong> · {assignOrder?.itemType}</div>
              <div className="text-muted-foreground">{assignOrder?.metalType === "gold" ? "Gold" : "Silver"} {assignOrder?.purity}{assignOrder?.targetWeight ? ` · ${assignOrder?.targetWeight}g target` : ""}</div>
            </div>
            <div>
              <label className={lbl}>Select Karigar *</label>
              <Select value={selectedKarigarId} onValueChange={setSelectedKarigarId}>
                <SelectTrigger><SelectValue placeholder="Choose karigar…" /></SelectTrigger>
                <SelectContent>
                  {karigars.map(k => (
                    <SelectItem key={k.id} value={String(k.id)}>
                      {k.name} <span className="text-muted-foreground text-xs ml-1">({k.specialization})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={lbl}>Metal to Issue (g) <span className="text-muted-foreground/60">leave blank to assign only, issue metal later</span></label>
              <Input type="number" step="0.001" value={metalIssueWeight} onChange={e => setMetalIssueWeight(e.target.value)} placeholder="e.g. 18.000" />
            </div>
            {metalIssueWeight && parseFloat(metalIssueWeight) > 0 && (
              <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {parseFloat(metalIssueWeight).toFixed(3)}g of {assignOrder?.metalType === "gold" ? "Gold" : "Silver"} {assignOrder?.purity} will be recorded as issued to the karigar.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOrder(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={updateOrder.isPending}>{updateOrder.isPending ? "Saving…" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Karigar returned ── */}
      <Dialog open={!!returnOrder} onOpenChange={v => { if (!v) setReturnOrder(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quality Check — {returnOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {returnOrder?.metalIssuedWeight != null && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-xs">
                <span className="text-muted-foreground">Issued to {returnOrder.karigarName}:</span> <strong>{returnOrder.metalIssuedWeight}g {returnOrder.metalType === "gold" ? "Gold" : "Silver"} {returnOrder.purity}</strong>
              </div>
            )}
            <div>
              <label className={lbl}>Finished Piece Weight (g) *</label>
              <Input type="number" step="0.001" value={finishedWeight} onChange={e => setFinishedWeight(e.target.value)} placeholder="e.g. 16.500" />
            </div>
            <div>
              <label className={lbl}>Wastage (g) <span className="text-muted-foreground/60">optional</span></label>
              <Input type="number" step="0.001" value={wastageWeight} onChange={e => setWastageWeight(e.target.value)} placeholder="e.g. 1.500" />
            </div>
            <div>
              <label className={lbl}>Karigar Wages (₹) <span className="text-muted-foreground/60">optional</span></label>
              <Input type="number" value={karigarWages} onChange={e => setKarigarWages(e.target.value)} placeholder="e.g. 2000" />
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <Input value={karigarNotes} onChange={e => setKarigarNotes(e.target.value)} placeholder="Quality notes, remarks…" />
            </div>
            {finishedWeight && returnOrder?.metalIssuedWeight != null && (() => {
              const diff = returnOrder.metalIssuedWeight - parseFloat(finishedWeight);
              const isWastage = diff > 0;
              return (
                <div className="text-xs p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                  Issued: <strong>{returnOrder.metalIssuedWeight}g</strong> · Returned: <strong>{parseFloat(finishedWeight).toFixed(3)}g</strong> ·{" "}
                  {isWastage ? "Wastage" : diff < 0 ? "Gain" : "Difference"}:{" "}
                  <strong className={isWastage ? "text-destructive" : diff < 0 ? "text-emerald-600" : ""}>
                    {Math.abs(diff).toFixed(3)}g{diff < 0 ? " more than issued" : ""}
                  </strong>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOrder(null)}>Cancel</Button>
            <Button onClick={handleReturn} disabled={updateOrder.isPending}>{updateOrder.isPending ? "Saving…" : "Record Return"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deliver to customer ── */}
      <Dialog open={!!deliverOrder} onOpenChange={v => { if (!v) setDeliverOrder(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deliver to Customer — {deliverOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs space-y-1">
              <div><strong>{deliverOrder?.customerName}</strong> · {deliverOrder?.itemType}</div>
              <div className="text-muted-foreground">Advance already paid: <strong className="text-foreground">{formatCurrency(deliverOrder?.advancePaid ?? 0)}</strong></div>
            </div>
            <div>
              <label className={lbl}>Final Price (₹)</label>
              <Input type="number" value={finalPrice} onChange={e => setFinalPrice(e.target.value)} placeholder="Total amount charged" />
            </div>
            <div>
              <label className={lbl}>Additional Payment at Delivery (₹)</label>
              <Input type="number" value={advanceAtDelivery} onChange={e => setAdvanceAtDelivery(e.target.value)} placeholder="0" />
            </div>
            {!!(parseFloat(advanceAtDelivery) > 0) && (
              <div className="space-y-2">
                <div>
                  <label className={lbl}>Payment Mode</label>
                  <Select value={deliverPaymentMode} onValueChange={v => { setDeliverPaymentMode(v); setDeliverBankAccountId(null); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(m => <SelectItem key={m} value={m} className="capitalize">{m.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <BankAccountSelect paymentMode={deliverPaymentMode} bankAccountId={deliverBankAccountId} onChange={setDeliverBankAccountId} />
              </div>
            )}
            {finalPrice && (
              <div className="text-xs p-2.5 bg-green-50 border border-green-200 rounded-lg text-green-800 space-y-0.5">
                <div>Total: <strong>{formatCurrency(parseFloat(finalPrice) || 0)}</strong></div>
                <div>Total collected: <strong>{formatCurrency((deliverOrder?.advancePaid ?? 0) + (parseFloat(advanceAtDelivery) || 0))}</strong></div>
                <div>Balance due: <strong>{formatCurrency(Math.max(0, (parseFloat(finalPrice) || 0) - (deliverOrder?.advancePaid ?? 0) - (parseFloat(advanceAtDelivery) || 0)))}</strong></div>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-green-700 p-2 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />Delivery date will be set to today.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverOrder(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleDeliver} disabled={updateOrder.isPending}>
              {updateOrder.isPending ? "Saving…" : "Confirm Delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />Delete Custom Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Delete this order permanently? This cannot be undone.</p>
            {deleteTarget && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs space-y-1">
                <div><strong>{deleteTarget.customerName}</strong> · {deleteTarget.orderNumber}</div>
                <div className="text-muted-foreground">{deleteTarget.itemType} · {STATUS_LABEL[deleteTarget.status as Status]}</div>
              </div>
            )}
            {deleteTarget && (deleteTarget.advancePaid > 0 || (deleteTarget.metalIssuedWeight ?? 0) > 0) && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {deleteTarget.advancePaid > 0 && <div>₹{deleteTarget.advancePaid.toLocaleString("en-IN")} advance collected</div>}
                {(deleteTarget.metalIssuedWeight ?? 0) > 0 && <div>{deleteTarget.metalIssuedWeight}g metal issued to {deleteTarget.karigarName ?? "karigar"}</div>}
                <div className="mt-1 font-medium">Deleting this order will not reverse or record these — track them manually if needed.</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteOrder.isPending}>
              {deleteOrder.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Custom Orders"
        description="Track jewellery a customer has commissioned to be made-to-order — from taking the order and handing metal to a karigar (artisan), through to delivery."
        sections={[
          {
            heading: "What you can do here",
            items: [
              "New Order — record a customer's custom order and its item specifications",
              "Assign to a karigar and track metal issued to them for the job",
              "Move an order through its status stages as work progresses",
              "Mark Delivered — record final collection and any balance payment",
              "Print — generate an order card for the customer or workshop",
            ],
          },
          {
            heading: "Status stages",
            items: [
              "Pending — order taken, not yet assigned",
              "Karigar Assigned — handed off to an artisan",
              "With Karigar — actively being made",
              "Quality Check — returned from the karigar for inspection",
              "Ready for Pickup — finished, waiting on the customer",
              "Delivered / Cancelled — closed out",
            ],
          },
          {
            heading: "Terms you'll see",
            items: [
              "Karigar — your artisan/goldsmith who does the crafting work",
              "Metal Issued Weight — how much gold/silver you handed the karigar for this order, tracked separately from the order's billed weight",
              "Advance Paid — any deposit the customer already gave toward this order",
            ],
          },
        ]}
      />
    </div>
  );
}
