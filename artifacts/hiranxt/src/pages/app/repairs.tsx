import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  useListRepairs, useCreateRepair, useUpdateRepair, useDeleteRepair, useGetSettings, useListKarigars,
  getListRepairsQueryKey,
} from "@workspace/api-client-react";
import type { RepairJobInput, RepairJobUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, MessageCircle, ArrowRight, Pencil, Trash2, PrinterIcon,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Hammer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";

const STATUSES = ["received", "in_progress", "ready", "delivered"] as const;
type Status = typeof STATUSES[number];

const STATUS_LABELS: Record<Status, string> = {
  received: "Received",
  in_progress: "In Progress",
  ready: "Ready",
  delivered: "Delivered",
};

const STATUS_COLORS: Record<Status, string> = {
  received: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  in_progress: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  ready: "bg-green-500/10 text-green-700 border-green-500/20",
  delivered: "bg-muted text-muted-foreground border-border",
};

const STATUS_COLUMN_BG: Record<Status, string> = {
  received: "bg-blue-50/60 border-blue-200/60",
  in_progress: "bg-orange-50/60 border-orange-200/60",
  ready: "bg-green-50/60 border-green-200/60",
  delivered: "bg-muted/20 border-border",
};

const nextStatus: Record<Status, Status | null> = {
  received: "in_progress",
  in_progress: "ready",
  ready: "delivered",
  delivered: null,
};

type Repair = {
  id: number;
  customerName: string;
  customerMobile: string;
  itemDescription: string;
  issue: string;
  grossWeight?: number | null;
  netWeight?: number | null;
  estimatedCost: number;
  actualCost?: number | null;
  status: string;
  receivedDate: string;
  promisedDate: string;
  deliveredDate?: string | null;
  notes?: string | null;
  karigarId?: number | null;
  karigarName?: string | null;
};

type RepairForm = {
  customerName: string;
  customerMobile: string;
  itemDescription: string;
  issue: string;
  grossWeight: string;
  netWeight: string;
  estimatedCost: string;
  receivedDate: string;
  promisedDate: string;
  notes: string;
  karigarId: string;
};

const EMPTY_FORM: RepairForm = {
  customerName: "", customerMobile: "", itemDescription: "",
  issue: "", grossWeight: "", netWeight: "", estimatedCost: "", receivedDate: new Date().toISOString().split("T")[0], promisedDate: "", notes: "", karigarId: "",
};

// ─── Print job card ────────────────────────────────────────────────────────────
function printRepairJobCard(repair: Repair, shopName: string, shopAddress: string, shopMobile: string) {
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const fmtD = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Repair Job Card – #${repair.id}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;font-size:12px;background:#fff}
.page{max-width:400px;margin:0 auto;padding:20px}
.shop{text-align:center;border-bottom:2px solid #1a3e6e;padding-bottom:10px;margin-bottom:12px}
.shop-name{font-size:17px;font-weight:800;color:#1a3e6e}
.shop-sub{font-size:10px;color:#555;margin-top:2px}
.title{text-align:center;font-weight:700;font-size:13px;color:#c0392b;letter-spacing:1px;margin:8px 0;border:1px dashed #c0392b;padding:5px}
.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #eee}
.label{color:#666}
.value{font-weight:600;text-align:right;max-width:55%;word-break:break-word}
.status-badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#f0fdf4;color:#15803d;border:1px solid #86efac}
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
<div class="title">REPAIR JOB CARD</div>
<div class="row"><span class="label">Job #</span><span class="value">#${repair.id}</span></div>
<div class="row"><span class="label">Received</span><span class="value">${fmtD(repair.receivedDate)}</span></div>
<div class="row"><span class="label">Status</span><span class="value"><span class="status-badge">${STATUS_LABELS[repair.status as Status] ?? repair.status}</span></span></div>
<div class="row"><span class="label">Customer</span><span class="value">${repair.customerName}</span></div>
<div class="row"><span class="label">Mobile</span><span class="value">${repair.customerMobile}</span></div>
<div class="row"><span class="label">Item</span><span class="value">${repair.itemDescription}</span></div>
<div class="row"><span class="label">Issue</span><span class="value">${repair.issue}</span></div>
${repair.karigarName ? `<div class="row"><span class="label">Assigned Karigar</span><span class="value">${repair.karigarName}</span></div>` : ""}
<div class="row"><span class="label">Estimated Cost</span><span class="value">${fmt(repair.estimatedCost)}</span></div>
${repair.actualCost != null ? `<div class="row"><span class="label">Actual Cost</span><span class="value">${fmt(repair.actualCost)}</span></div>` : ""}
<div class="row"><span class="label">Promised Date</span><span class="value">${fmtD(repair.promisedDate)}</span></div>
${repair.deliveredDate ? `<div class="row"><span class="label">Delivered</span><span class="value">${fmtD(repair.deliveredDate)}</span></div>` : ""}
${repair.notes ? `<div class="note-box">Notes: ${repair.notes}</div>` : ""}
<div class="sig-row">
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Customer Signature</div></div>
  <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Authorised by ${shopName}</div></div>
</div>
<div class="footer">This is a computer-generated repair job card. Powered by SwarnDesk (by TirthonTech)</div>
</div></body></html>`;

  const w = window.open("", "_blank", "width=460,height=640");
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Repairs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: repairs, isLoading } = useListRepairs();
  const { data: settings } = useGetSettings();
  const { data: karigars } = useListKarigars();
  const createRepair = useCreateRepair();
  const updateRepair = useUpdateRepair();
  const deleteRepair = useDeleteRepair();

  const shopName = settings?.businessName ?? "SwarnDesk Jewellers";
  const shopAddress = settings?.address ?? "";
  const shopMobile = settings?.mobile ?? "";

  // ── Create dialog ──
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<RepairForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // ── Edit dialog ──
  const [editRepair, setEditRepair] = useState<Repair | null>(null);
  const [editForm, setEditForm] = useState<RepairForm>(EMPTY_FORM);

  // ── Delete confirmation ──
  const [deleteTarget, setDeleteTarget] = useState<Repair | null>(null);

  // ── Status change dialog ──
  const [statusRepair, setStatusRepair] = useState<Repair | null>(null);
  const [newStatus, setNewStatus] = useState<Status>("received");
  const [actualCost, setActualCost] = useState("");
  const [statusNotes, setStatusNotes] = useState("");

  // ── Collapse columns ──
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pageHelpOpen, setPageHelpOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListRepairsQueryKey() });

  const setF = (k: keyof RepairForm, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEF = (k: keyof RepairForm, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleCreate = () => {
    if (!form.customerName.trim()) { toast({ title: "Customer name required", variant: "destructive" }); return; }
    if (!form.customerMobile.trim()) { toast({ title: "Mobile required", variant: "destructive" }); return; }
    if (!form.itemDescription.trim()) { toast({ title: "Item description required", variant: "destructive" }); return; }
    if (!form.issue.trim()) { toast({ title: "Issue/work required", variant: "destructive" }); return; }
    const cost = parseFloat(form.estimatedCost);
    if (!isFinite(cost) || cost < 0) { toast({ title: "Valid estimated cost required", variant: "destructive" }); return; }
    if (!form.promisedDate) { toast({ title: "Promised date required", variant: "destructive" }); return; }

    setSubmitting(true);
    // receivedDate isn't in the generated RepairJobInput type (it used to always default
    // to "now" server-side) — extend it locally now that it's settable.
    const createPayload: RepairJobInput & { receivedDate?: string } = {
      customerName: form.customerName,
      customerMobile: form.customerMobile,
      itemDescription: form.itemDescription,
      issue: form.issue,
      grossWeight: form.grossWeight ? parseFloat(form.grossWeight) : null,
      netWeight: form.netWeight ? parseFloat(form.netWeight) : null,
      estimatedCost: cost,
      receivedDate: form.receivedDate ? new Date(form.receivedDate).toISOString() : undefined,
      promisedDate: new Date(form.promisedDate).toISOString(),
      notes: form.notes.trim() || null,
      customerId: null,
      karigarId: form.karigarId ? parseInt(form.karigarId) : null,
    };
    createRepair.mutate({ data: createPayload }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Repair job logged" });
        setAddOpen(false);
        setForm(EMPTY_FORM);
      },
      onError: () => toast({ title: "Failed to log repair", variant: "destructive" }),
      onSettled: () => setSubmitting(false),
    });
  };

  const openEdit = (r: Repair) => {
    setEditRepair(r);
    setEditForm({
      customerName: r.customerName,
      customerMobile: r.customerMobile,
      itemDescription: r.itemDescription,
      issue: r.issue,
      grossWeight: r.grossWeight != null ? String(r.grossWeight) : "",
      netWeight: r.netWeight != null ? String(r.netWeight) : "",
      estimatedCost: String(r.estimatedCost),
      receivedDate: r.receivedDate.split("T")[0],
      promisedDate: r.promisedDate.split("T")[0],
      notes: r.notes ?? "",
      karigarId: r.karigarId != null ? String(r.karigarId) : "",
    });
  };

  const handleEdit = () => {
    if (!editRepair) return;
    const cost = parseFloat(editForm.estimatedCost);
    if (!editForm.customerName.trim() || !editForm.itemDescription.trim() || !editForm.issue.trim()) {
      toast({ title: "Fill all required fields", variant: "destructive" }); return;
    }
    if (!isFinite(cost) || cost < 0) { toast({ title: "Valid estimated cost required", variant: "destructive" }); return; }
    const editPayload: RepairJobUpdate & { receivedDate?: string } = {
      customerName: editForm.customerName,
      customerMobile: editForm.customerMobile,
      itemDescription: editForm.itemDescription,
      issue: editForm.issue,
      grossWeight: editForm.grossWeight ? parseFloat(editForm.grossWeight) : null,
      netWeight: editForm.netWeight ? parseFloat(editForm.netWeight) : null,
      estimatedCost: cost,
      receivedDate: editForm.receivedDate ? new Date(editForm.receivedDate).toISOString() : undefined,
      promisedDate: new Date(editForm.promisedDate).toISOString(),
      notes: editForm.notes.trim() || null,
      karigarId: editForm.karigarId ? parseInt(editForm.karigarId) : null,
    };
    updateRepair.mutate({
      id: editRepair.id,
      data: editPayload
    }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Repair updated" });
        setEditRepair(null);
      },
      onError: () => toast({ title: "Failed to update repair", variant: "destructive" }),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRepair.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Repair deleted" });
        setDeleteTarget(null);
      },
      onError: () => toast({ title: "Failed to delete repair", variant: "destructive" }),
    });
  };

  const openStatusChange = (r: Repair) => {
    setStatusRepair(r);
    setNewStatus(r.status as Status);
    setActualCost(r.actualCost != null ? String(r.actualCost) : "");
    setStatusNotes(r.notes ?? "");
  };

  const handleStatusChange = () => {
    if (!statusRepair) return;
    const isDelivering = newStatus === "delivered";
    updateRepair.mutate({
      id: statusRepair.id,
      data: {
        status: newStatus,
        notes: statusNotes.trim() || null,
        ...(isDelivering ? { deliveredDate: new Date().toISOString() } : {}),
        ...(actualCost ? { actualCost: parseFloat(actualCost) } : {}),
      }
    }, {
      onSuccess: () => {
        invalidate();
        toast({ title: `Status set to "${STATUS_LABELS[newStatus]}"` });
        setStatusRepair(null);
      },
      onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
    });
  };

  const advanceStatus = (r: Repair) => {
    const next = nextStatus[r.status as Status];
    if (!next) return;
    if (next === "delivered") { openStatusChange(r); return; }
    updateRepair.mutate({
      id: r.id,
      data: { status: next },
    }, {
      onSuccess: () => {
        invalidate();
        toast({ title: `Moved to "${STATUS_LABELS[next]}"` });
      },
    });
  };

  const sendWhatsApp = (r: Repair) => {
    const contactLine = shopMobile ? ` Contact us: ${shopMobile}.` : "";
    const msg = `Hello ${r.customerName}! Your repair (${r.itemDescription}) is now "${STATUS_LABELS[r.status as Status]}". Est. cost: ${formatCurrency(r.estimatedCost)}.${contactLine}`;
    const digits = r.customerMobile.replace(/\D/g, "");
    const mobile = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = (repairs ?? []).filter(r => r.status === s) as Repair[];
    return acc;
  }, {} as Record<Status, Repair[]>);

  const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary";
  const lbl = "text-xs text-muted-foreground block mb-1 font-medium";

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Repairs</h1>
          <p className="text-muted-foreground text-sm">Track repair jobs through the pipeline</p>
          <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />Log Repair
        </Button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <div key={s} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${STATUS_COLORS[s]}`}>
            {STATUS_LABELS[s]}: {byStatus[s].length}
          </div>
        ))}
      </div>

      {isLoading && <div className="text-muted-foreground text-sm py-10 text-center">Loading repairs...</div>}

      {/* Kanban columns */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map(status => {
          const isCollapsed = collapsed[status];
          const cards = byStatus[status];
          return (
            <div key={status} className="space-y-2">
              {/* Column header */}
              <button
                onClick={() => setCollapsed(c => ({ ...c, [status]: !c[status] }))}
                className={`w-full flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-lg border ${STATUS_COLUMN_BG[status]} transition-all`}
              >
                <span>{STATUS_LABELS[status]} ({cards.length})</span>
                {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>

              {!isCollapsed && cards.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
                  No repairs
                </div>
              )}

              {!isCollapsed && cards.map(repair => {
                const isOverdue = repair.status !== "delivered" && new Date(repair.promisedDate) < new Date();
                return (
                  <Card key={repair.id} className={`border-border ${isOverdue ? "border-l-4 border-l-destructive" : ""}`}>
                    <CardContent className="p-4 space-y-2">
                      {/* Top row: name + action buttons */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{repair.customerName}</div>
                          <div className="text-xs text-muted-foreground">{repair.customerMobile}</div>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => openEdit(repair)} className="p-2 -m-0.5 text-muted-foreground hover:text-primary hover:bg-muted/40 rounded-md transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => printRepairJobCard(repair, shopName, shopAddress, shopMobile)} className="p-2 -m-0.5 text-muted-foreground hover:text-primary hover:bg-muted/40 rounded-md transition-colors" title="Print job card">
                            <PrinterIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => sendWhatsApp(repair)} className="p-2 -m-0.5 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded-md transition-colors" title="Send WhatsApp update">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-px h-4 bg-border mx-0.5" />
                          <button onClick={() => setDeleteTarget(repair)} className="p-2 -m-0.5 text-muted-foreground hover:text-destructive hover:bg-red-50 rounded-md transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Item info */}
                      <div className="text-xs font-medium border-l-2 border-primary pl-2 leading-snug">{repair.itemDescription}</div>
                      <div className="text-xs text-muted-foreground">{repair.issue}</div>

                      {repair.karigarName && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Hammer className="w-3 h-3" />{repair.karigarName}
                        </div>
                      )}

                      {/* Cost + date */}
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-primary">
                            {repair.actualCost != null ? formatCurrency(repair.actualCost) : formatCurrency(repair.estimatedCost)}
                          </span>
                          {repair.actualCost != null && (
                            <span className="text-muted-foreground ml-1">(actual)</span>
                          )}
                        </div>
                        <span className={`${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                          {repair.status === "delivered" && repair.deliveredDate
                            ? `Delivered ${formatDate(repair.deliveredDate)}`
                            : `Due: ${formatDate(repair.promisedDate)}`}
                        </span>
                      </div>

                      {isOverdue && (
                        <div className="flex items-center gap-1 text-[10px] text-destructive font-medium">
                          <AlertTriangle className="w-3 h-3" />Overdue
                        </div>
                      )}

                      {repair.notes && (
                        <div className="text-[11px] text-muted-foreground italic truncate">{repair.notes}</div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => openStatusChange(repair)}
                          className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 hover:bg-muted/30 transition-colors text-center"
                        >
                          Change Status
                        </button>
                        {nextStatus[status] && (
                          <Button
                            size="sm"
                            className="flex-1 text-xs gap-1 h-7"
                            onClick={() => advanceStatus(repair)}
                          >
                            {nextStatus[status] === "delivered" ? "Mark Delivered..." : STATUS_LABELS[nextStatus[status]!]}
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Create dialog ── */}
      <Dialog open={addOpen} onOpenChange={v => { setAddOpen(v); if (!v) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log New Repair Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Customer Name *</label>
                <input className={inp} value={form.customerName} onChange={e => setF("customerName", e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className={lbl}>Mobile *</label>
                <input className={inp} value={form.customerMobile} onChange={e => setF("customerMobile", e.target.value)} placeholder="10-digit number" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Item Description *</label>
                <input className={inp} value={form.itemDescription} onChange={e => setF("itemDescription", e.target.value)} placeholder="Gold necklace with pendant" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Issue / Work Required *</label>
                <input className={inp} value={form.issue} onChange={e => setF("issue", e.target.value)} placeholder="Clasp broken, needs replacement" />
              </div>
              <div>
                <label className={lbl}>Gross Weight (g) <span className="text-muted-foreground/60">optional — to verify it comes back the same</span></label>
                <input className={inp} type="number" step="0.001" min="0" value={form.grossWeight} onChange={e => setF("grossWeight", e.target.value)} placeholder="0.000" />
              </div>
              <div>
                <label className={lbl}>Net Weight (g)</label>
                <input className={inp} type="number" step="0.001" min="0" value={form.netWeight} onChange={e => setF("netWeight", e.target.value)} placeholder="0.000" />
              </div>
              <div>
                <label className={lbl}>Estimated Cost (₹) *</label>
                <input className={inp} type="number" min="0" value={form.estimatedCost} onChange={e => setF("estimatedCost", e.target.value)} placeholder="e.g. 500" />
              </div>
              <div>
                <label className={lbl}>Received Date *</label>
                <input className={inp} type="date" value={form.receivedDate} onChange={e => setF("receivedDate", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Promised Date *</label>
                <input className={inp} type="date" value={form.promisedDate} min={new Date().toISOString().split("T")[0]} onChange={e => setF("promisedDate", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Assign Karigar</label>
                <Select value={form.karigarId || "none"} onValueChange={v => setF("karigarId", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(karigars ?? []).map(k => (
                      <SelectItem key={k.id} value={String(k.id)}>{k.name} ({k.specialization})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Notes</label>
                <input className={inp} value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Additional remarks..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || createRepair.isPending}>
              {createRepair.isPending ? "Logging..." : "Log Repair"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editRepair} onOpenChange={v => { if (!v) setEditRepair(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Repair Job #{editRepair?.id}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Customer Name *</label>
                <input className={inp} value={editForm.customerName} onChange={e => setEF("customerName", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Mobile *</label>
                <input className={inp} value={editForm.customerMobile} onChange={e => setEF("customerMobile", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Item Description *</label>
                <input className={inp} value={editForm.itemDescription} onChange={e => setEF("itemDescription", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Issue / Work Required *</label>
                <input className={inp} value={editForm.issue} onChange={e => setEF("issue", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Gross Weight (g)</label>
                <input className={inp} type="number" step="0.001" min="0" value={editForm.grossWeight} onChange={e => setEF("grossWeight", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Net Weight (g)</label>
                <input className={inp} type="number" step="0.001" min="0" value={editForm.netWeight} onChange={e => setEF("netWeight", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Estimated Cost (₹) *</label>
                <input className={inp} type="number" min="0" value={editForm.estimatedCost} onChange={e => setEF("estimatedCost", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Received Date *</label>
                <input className={inp} type="date" value={editForm.receivedDate} onChange={e => setEF("receivedDate", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Promised Date *</label>
                <input className={inp} type="date" value={editForm.promisedDate} onChange={e => setEF("promisedDate", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Assign Karigar</label>
                <Select value={editForm.karigarId || "none"} onValueChange={v => setEF("karigarId", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(karigars ?? []).map(k => (
                      <SelectItem key={k.id} value={String(k.id)}>{k.name} ({k.specialization})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Notes</label>
                <input className={inp} value={editForm.notes} onChange={e => setEF("notes", e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRepair(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateRepair.isPending}>
              {updateRepair.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Status change dialog ── */}
      <Dialog open={!!statusRepair} onOpenChange={v => { if (!v) setStatusRepair(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Status — #{statusRepair?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className={lbl}>New Status</label>
              <Select value={newStatus} onValueChange={v => setNewStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newStatus === "delivered" && (
              <div>
                <label className={lbl}>Actual Cost (₹) <span className="text-muted-foreground/60">optional — leave blank to use the estimate</span></label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={actualCost}
                    onChange={e => setActualCost(e.target.value)}
                    placeholder={`Est. was ${formatCurrency(statusRepair?.estimatedCost ?? 0)}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs whitespace-nowrap"
                    onClick={() => setActualCost(String(statusRepair?.estimatedCost ?? 0))}
                  >
                    Use estimate
                  </Button>
                </div>
              </div>
            )}
            <div>
              <label className={lbl}>Notes <span className="text-muted-foreground/60">optional</span></label>
              <Input value={statusNotes} onChange={e => setStatusNotes(e.target.value)} placeholder="Remarks..." />
            </div>
            {newStatus === "delivered" && (
              <div className="flex items-center gap-2 text-xs text-green-700 p-2 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                Delivered date will be set to today automatically.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusRepair(null)}>Cancel</Button>
            <Button onClick={handleStatusChange} disabled={updateRepair.isPending}>
              {updateRepair.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />Delete Repair Job
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>This will permanently delete this repair record, including all notes and history. This cannot be undone.</p>
            {deleteTarget && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1 text-xs">
                <div><span className="text-muted-foreground">Customer:</span> <strong>{deleteTarget.customerName}</strong></div>
                <div><span className="text-muted-foreground">Item:</span> {deleteTarget.itemDescription}</div>
                <div><span className="text-muted-foreground">Status:</span> {STATUS_LABELS[deleteTarget.status as Status]}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRepair.isPending}>
              {deleteRepair.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Repairs"
        description="Track jewellery brought in for repair, from intake through to delivery back to the customer."
        sections={[
          {
            heading: "What you can do here",
            items: [
              "Log Repair — record a new repair job with the issue, estimated cost, and promised date",
              "Move a job forward through its status as work progresses",
              "Print — generate a job card for the customer/workshop",
              "Assign a karigar to a job if one of your artisans is doing the work",
            ],
          },
          {
            heading: "Status stages",
            items: [
              "Received — item taken in, work not started",
              "In Progress — actively being repaired",
              "Ready — repair complete, waiting for customer pickup",
              "Delivered — returned to the customer, job closed",
            ],
          },
        ]}
      />
    </div>
  );
}
