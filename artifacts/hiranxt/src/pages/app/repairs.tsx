import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  useListRepairs, useCreateRepair, useUpdateRepair,
  getListRepairsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Plus, Wrench, MessageCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUSES = ["received", "in_progress", "ready", "delivered"] as const;
type Status = typeof STATUSES[number];

const STATUS_LABELS: Record<Status, string> = {
  received: "Received",
  in_progress: "In Progress",
  ready: "Ready",
  delivered: "Delivered",
};

const STATUS_COLORS: Record<Status, string> = {
  received: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_progress: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  ready: "bg-green-500/10 text-green-400 border-green-500/20",
  delivered: "bg-muted text-muted-foreground border-border",
};

interface RepairForm {
  customerName: string; customerMobile: string; itemDescription: string;
  issue: string; estimatedCost: number; promisedDate: string; notes: string;
}

export default function Repairs() {
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: repairs, isLoading } = useListRepairs();
  const createRepair = useCreateRepair();
  const updateRepair = useUpdateRepair();

  const { register, handleSubmit, reset } = useForm<RepairForm>();

  const onSubmit = (data: RepairForm) => {
    createRepair.mutate({
      data: {
        customerName: data.customerName,
        customerMobile: data.customerMobile,
        itemDescription: data.itemDescription,
        issue: data.issue,
        estimatedCost: parseFloat(String(data.estimatedCost)),
        promisedDate: new Date(data.promisedDate).toISOString(),
        notes: data.notes || null,
        customerId: null,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRepairsQueryKey() });
        toast({ title: "Repair job logged" });
        setAddOpen(false);
        reset();
      },
      onError: () => toast({ title: "Failed to log repair", variant: "destructive" }),
    });
  };

  const nextStatus: Record<Status, Status | null> = {
    received: "in_progress",
    in_progress: "ready",
    ready: "delivered",
    delivered: null,
  };

  const advanceStatus = (id: number, currentStatus: string) => {
    const next = nextStatus[currentStatus as Status];
    if (!next) return;
    updateRepair.mutate({
      id,
      data: {
        status: next,
        ...(next === "delivered" ? { deliveredDate: new Date().toISOString() } : {}),
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRepairsQueryKey() });
        toast({ title: `Status updated to "${STATUS_LABELS[next]}"` });
      }
    });
  };

  const sendWhatsAppUpdate = (repair: typeof repairs extends Array<infer T> ? T : never) => {
    const msg = `Hello ${repair.customerName}! Your repair job (${repair.itemDescription}) is now "${STATUS_LABELS[repair.status as Status]}". Estimated cost: ${formatCurrency(repair.estimatedCost)}. Contact us at +91-99999-99999.`;
    window.open(`https://wa.me/91${repair.customerMobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Group by status for pipeline view
  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = (repairs ?? []).filter(r => r.status === s);
    return acc;
  }, {} as Record<Status, typeof repairs>);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Repairs</h1>
          <p className="text-muted-foreground text-sm">Track repair jobs through the pipeline</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2" data-testid="button-log-repair">
          <Plus className="w-4 h-4" />Log Repair
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        {STATUSES.map(s => (
          <div key={s} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${STATUS_COLORS[s]}`}>
            {STATUS_LABELS[s]}: {(byStatus[s] ?? []).length}
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map(status => (
          <div key={status} className="space-y-3">
            <div className={`text-xs font-semibold px-3 py-2 rounded-lg border ${STATUS_COLORS[status]}`}>
              {STATUS_LABELS[status]} ({(byStatus[status] ?? []).length})
            </div>
            {(byStatus[status] ?? []).map(repair => (
              <Card key={repair.id} className="border-border" data-testid={`card-repair-${repair.id}`}>
                <CardContent className="p-4 space-y-2.5">
                  <div className="font-medium text-sm">{repair.customerName}</div>
                  <div className="text-xs text-muted-foreground">{repair.customerMobile}</div>
                  <div className="text-xs font-medium border-l-2 border-primary pl-2">{repair.itemDescription}</div>
                  <div className="text-xs text-muted-foreground">{repair.issue}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-primary font-semibold">{formatCurrency(repair.estimatedCost)}</span>
                    <span className="text-muted-foreground">Due: {formatDate(repair.promisedDate)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {nextStatus[status as Status] && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs gap-1"
                        onClick={() => advanceStatus(repair.id, status)}
                        data-testid={`button-advance-${repair.id}`}
                      >
                        {STATUS_LABELS[nextStatus[status as Status]!]}
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                    <button
                      onClick={() => sendWhatsAppUpdate(repair)}
                      className="text-green-400 hover:text-green-300 p-1"
                      data-testid={`button-wa-repair-${repair.id}`}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log Repair Job</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Customer Name *</label>
                <Input {...register("customerName", { required: true })} data-testid="input-repair-customer" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mobile *</label>
                <Input {...register("customerMobile", { required: true })} data-testid="input-repair-mobile" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Item Description *</label>
                <Input {...register("itemDescription", { required: true })} placeholder="Gold necklace with pendant" data-testid="input-repair-item" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Issue / Work Required *</label>
                <Input {...register("issue", { required: true })} placeholder="Clasp broken, needs replacement" data-testid="input-repair-issue" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estimated Cost (₹) *</label>
                <Input type="number" {...register("estimatedCost", { required: true })} data-testid="input-repair-cost" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Promised Date *</label>
                <Input type="date" {...register("promisedDate", { required: true })} data-testid="input-repair-date" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <Input {...register("notes")} placeholder="Additional notes..." data-testid="input-repair-notes" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createRepair.isPending} data-testid="button-submit-repair">
                {createRepair.isPending ? "Logging..." : "Log Repair"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
