import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, ChevronDown, ChevronUp, CheckCircle2, Clock, IndianRupee, History, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("swarndesk_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

interface PendingSale {
  id: number;
  invoiceNumber: string;
  customerName: string;
  customerId: number | null;
  saleDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  paymentMode: string;
  status?: string;
}

interface PaymentTxn {
  id: number;
  amount: number;
  paymentMode: string;
  paidAt: string;
  notes: string | null;
}

function usePendingSales(search: string) {
  return useQuery<PendingSale[]>({
    queryKey: ["pending-sales", search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const r = await fetch(`/api/sales/pending/list${params}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    staleTime: 10_000,
  });
}

function useAllSales(search: string, enabled: boolean) {
  return useQuery<PendingSale[]>({
    queryKey: ["all-sales", search],
    queryFn: async () => {
      const r = await fetch(`/api/sales?limit=200`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load");
      const sales: PendingSale[] = await r.json();
      if (!search.trim()) return sales;
      const q = search.trim().toLowerCase();
      return sales.filter(s => s.customerName.toLowerCase().includes(q) || s.invoiceNumber.toLowerCase().includes(q));
    },
    enabled,
    staleTime: 10_000,
  });
}

function usePaymentHistory(saleId: number | null) {
  return useQuery<PaymentTxn[]>({
    queryKey: ["payment-history", saleId],
    queryFn: async () => {
      const r = await fetch(`/api/sales/${saleId}/payments`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    enabled: saleId !== null,
    staleTime: 5_000,
  });
}

function useRecordPayment() {
  return useMutation({
    mutationFn: async ({ saleId, amount, paymentMode, notes }: { saleId: number; amount: number; paymentMode: string; notes: string }) => {
      const r = await fetch(`/api/sales/${saleId}/payments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount, paymentMode, notes }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to record payment");
      }
      return r.json() as Promise<PendingSale>;
    },
  });
}

export default function PendingPayments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"pending" | "all">("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [payDialogSale, setPayDialogSale] = useState<PendingSale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [returnSale, setReturnSale] = useState<PendingSale | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [pageHelpOpen, setPageHelpOpen] = useState(false);

  const { data: pendingSales = [], isLoading: pendingLoading } = usePendingSales(search);
  const { data: allSales = [], isLoading: allLoading } = useAllSales(search, view === "all");
  const sales = view === "pending" ? pendingSales : allSales;
  const isLoading = view === "pending" ? pendingLoading : allLoading;
  const { data: history = [] } = usePaymentHistory(expandedId);
  const recordPayment = useRecordPayment();

  const returnSaleMutation = useMutation({
    mutationFn: async ({ saleId, notes }: { saleId: number; notes: string }) => {
      const r = await fetch(`/api/sales/${saleId}/return`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ notes }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to return sale");
      return r.json() as Promise<PendingSale>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-sales"] });
      queryClient.invalidateQueries({ queryKey: ["all-sales"] });
      setReturnSale(null);
      toast({ title: "Sale returned — inventory restocked and books reversed" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const openPayDialog = (sale: PendingSale) => {
    setPayDialogSale(sale);
    setPayAmount(String(Math.round(sale.balanceAmount)));
    setPayMode("cash");
    setPayNotes("");
  };

  const handleRecordPayment = () => {
    if (!payDialogSale) return;
    const amount = parseFloat(payAmount);
    if (!isFinite(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" }); return;
    }
    if (amount > payDialogSale.balanceAmount + 0.01) {
      toast({ title: `Amount exceeds balance of ${formatCurrency(payDialogSale.balanceAmount)}`, variant: "destructive" }); return;
    }

    recordPayment.mutate({ saleId: payDialogSale.id, amount, paymentMode: payMode, notes: payNotes }, {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: ["pending-sales"] });
        queryClient.invalidateQueries({ queryKey: ["payment-history", payDialogSale.id] });
        setPayDialogSale(null);
        if (updated.paymentStatus === "paid") {
          toast({ title: `Payment complete! Invoice ${updated.invoiceNumber} is fully paid.` });
        } else {
          toast({ title: `₹${amount.toLocaleString("en-IN")} recorded. Balance: ${formatCurrency(updated.balanceAmount)}` });
        }
      },
      onError: (e) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const statusColor = (status: string) =>
    status === "pending" ? "text-red-700 border-red-200 bg-red-50" : "text-orange-700 border-orange-200 bg-orange-50";

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Pending Payments</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Track and collect outstanding balances from customers</p>
        <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Pending Bills</div>
            <div className="text-2xl font-bold text-foreground">{sales.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Outstanding</div>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(sales.reduce((s, x) => s + x.balanceAmount, 0))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Still Owed on Partial Bills</div>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(sales.filter(x => x.paymentStatus === "partial").reduce((s, x) => s + x.balanceAmount, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + view toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or invoice number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-pending-search"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden flex-shrink-0">
          <button className={`px-3 py-2 text-xs font-medium ${view === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => setView("pending")}>Pending Only</button>
          <button className={`px-3 py-2 text-xs font-medium ${view === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => setView("all")}>All Recent Sales</button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
        )}
        {!isLoading && sales.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <div className="font-semibold text-lg">All payments cleared!</div>
            <div className="text-muted-foreground text-sm mt-1">No pending or partial payments found.</div>
          </div>
        )}

        {sales.map(sale => (
          <Card key={sale.id} className="border-border">
            <CardContent className="p-4">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{sale.customerName}</span>
                    <Badge variant="outline" className={`text-[10px] h-4 ${statusColor(sale.paymentStatus)}`}>
                      {sale.paymentStatus}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono">{sale.invoiceNumber}</span>
                    <span className="mx-1.5">·</span>
                    {new Date(sale.saleDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Balance Due</div>
                  <div className="text-lg font-bold text-red-600">{formatCurrency(sale.balanceAmount)}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 mb-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Paid: {formatCurrency(sale.paidAmount)}</span>
                  <span>Total: {formatCurrency(sale.totalAmount)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, (sale.paidAmount / sale.totalAmount) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {sale.status !== "returned" && sale.balanceAmount > 0 && (
                  <Button size="sm" onClick={() => openPayDialog(sale)} className="gap-1.5" data-testid={`button-pay-${sale.id}`}>
                    <IndianRupee className="w-3.5 h-3.5" />
                    Collect Payment
                  </Button>
                )}
                {sale.status === "returned" ? (
                  <Badge variant="secondary" className="text-[10px]">Returned</Badge>
                ) : (
                  <Button size="sm" variant="outline" className="gap-1.5 text-red-600" onClick={() => { setReturnSale(sale); setReturnNotes(""); }} data-testid={`button-return-${sale.id}`}>
                    <Undo2 className="w-3.5 h-3.5" />
                    Return
                  </Button>
                )}
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                  onClick={() => setExpandedId(prev => prev === sale.id ? null : sale.id)}
                  data-testid={`button-history-${sale.id}`}
                >
                  <History className="w-3.5 h-3.5" />
                  History
                  {expandedId === sale.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Payment history */}
              {expandedId === sale.id && (
                <div className="mt-3 rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground border-b border-border flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Payment History
                  </div>
                  {history.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      No payments recorded yet
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {history.map(txn => (
                        <div key={txn.id} className="flex items-center justify-between px-3 py-2.5 text-xs">
                          <div>
                            <div className="font-medium">{formatCurrency(txn.amount)}</div>
                            <div className="text-muted-foreground capitalize">{txn.paymentMode}</div>
                            {txn.notes && <div className="text-muted-foreground italic">{txn.notes}</div>}
                          </div>
                          <div className="text-right text-muted-foreground">
                            {new Date(txn.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            <div>{new Date(txn.paidAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collect Payment Dialog */}
      <Dialog open={!!payDialogSale} onOpenChange={open => { if (!open) setPayDialogSale(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-primary" />
              Collect Payment
            </DialogTitle>
          </DialogHeader>
          {payDialogSale && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm space-y-1">
                <div className="font-semibold">{payDialogSale.customerName}</div>
                <div className="text-xs text-muted-foreground font-mono">{payDialogSale.invoiceNumber}</div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="font-bold text-red-600">{formatCurrency(payDialogSale.balanceAmount)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount Received (₹)</label>
                <Input
                  type="number"
                  min="1"
                  max={payDialogSale.balanceAmount}
                  step="1"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  data-testid="input-collect-amount"
                  autoFocus
                />
                {parseFloat(payAmount) > 0 && parseFloat(payAmount) < payDialogSale.balanceAmount && (
                  <div className="text-xs text-orange-600 mt-1">
                    Remaining after this: {formatCurrency(Math.max(0, payDialogSale.balanceAmount - (parseFloat(payAmount) || 0)))}
                  </div>
                )}
                {parseFloat(payAmount) >= payDialogSale.balanceAmount && parseFloat(payAmount) > 0 && (
                  <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> This will mark the sale as fully paid
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Payment Mode</label>
                <Select value={payMode} onValueChange={setPayMode}>
                  <SelectTrigger data-testid="select-collect-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cash", "upi", "card"].map(m => (
                      <SelectItem key={m} value={m} className="capitalize">{m.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
                <Input
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="e.g. Paid via HDFC UPI"
                  data-testid="input-collect-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogSale(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={recordPayment.isPending} data-testid="button-confirm-payment">
              {recordPayment.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Sale Dialog */}
      <Dialog open={!!returnSale} onOpenChange={open => { if (!open) setReturnSale(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-4 h-4 text-red-600" />
              Return Sale
            </DialogTitle>
          </DialogHeader>
          {returnSale && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm space-y-1">
                <div className="font-semibold">{returnSale.customerName}</div>
                <div className="text-xs text-muted-foreground font-mono">{returnSale.invoiceNumber}</div>
              </div>
              <p className="text-xs text-muted-foreground">
                This restocks all items back into inventory, reverses the accounting entries for this sale (and any payments already collected), and refunds {formatCurrency(returnSale.paidAmount)}. This cannot be undone.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
                <Input value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Reason for return" data-testid="input-return-notes" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnSale(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={returnSaleMutation.isPending}
              onClick={() => returnSale && returnSaleMutation.mutate({ saleId: returnSale.id, notes: returnNotes })}
              data-testid="button-confirm-return"
            >
              {returnSaleMutation.isPending ? "Returning..." : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Pending Payments"
        description="Every sale that hasn't been fully paid for — customers who took goods on partial payment or credit. Chase these down here."
        sections={[
          {
            heading: "What you can do here",
            items: [
              "Collect Payment — record a payment against a specific bill's remaining balance",
              "Return — undo a sale entirely: restocks inventory and reverses the accounting, including any payments already collected",
              "History — see every payment collected against a bill so far",
              "Pending Only / All Recent Sales — switch between just-unpaid bills and your full recent sales list",
            ],
          },
          {
            heading: "Terms you'll see",
            items: [
              "pending — no payment collected yet",
              "partial — some but not all of the bill has been paid",
            ],
          },
        ]}
      />
    </div>
  );
}
