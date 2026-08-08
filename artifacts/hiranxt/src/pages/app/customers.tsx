import { useState, useCallback, useEffect } from "react";
import { useSearch as useQueryString, useLocation } from "wouter";
import { useBackClose } from "@/hooks/use-back-close";
import { formatCurrency } from "@/lib/utils";
import {
  useListCustomers, useCreateCustomer, useUpdateCustomer, useGetUpcomingOccasions,
  useGetCustomer, useGetSettings,
  getListCustomersQueryKey, getGetUpcomingOccasionsQueryKey
} from "@workspace/api-client-react";
import type { Customer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import {
  Plus, Search, Gift, MessageCircle, Star, Send, CheckSquare, Square, Users,
  Eye, ShoppingBag, Wrench, X, Banknote, History, Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";
import { InfoTooltip } from "@/components/InfoTooltip";

interface CustomerForm {
  name: string; mobile: string; email: string; address: string;
  birthday: string; anniversary: string; gstin: string; pan: string; stateCode: string; notes: string;
  openingBalance: string; openingBalanceType: "debit" | "credit";
}

const DEFAULT_TEMPLATE = "Dear {name}, thank you for being a valued customer at our jewellery store! We'd love to see you again. Visit us for our latest collection and exclusive offers.";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("swarndesk_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function CustomerLedger({ customerId, onClose, loyaltyEnabled }: { customerId: number; onClose: () => void; loyaltyEnabled: boolean }) {
  const { data, isLoading } = useGetCustomer(customerId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
    );
  }

  if (!data) return null;

  const { customer, recentSales, pendingRepairs } = data;
  const totalPending = recentSales.filter(s => s.paymentStatus !== "paid").reduce((a, s) => a + s.totalAmount, 0);

  return (
    <div className="space-y-5">
      {/* Customer summary */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">{customer.name}</h2>
          <div className="text-sm text-muted-foreground">{customer.mobile}</div>
          {customer.email && <div className="text-xs text-muted-foreground">{customer.email}</div>}
          {customer.address && <div className="text-xs text-muted-foreground mt-0.5">{customer.address}</div>}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stats row */}
      <div className={`grid gap-3 ${loyaltyEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
          <div className="text-xs text-muted-foreground mb-1">Total Purchases</div>
          <div className="text-base font-bold text-primary">{formatCurrency(customer.totalPurchases)}</div>
        </div>
        <div className={`p-3 rounded-xl border text-center ${customer.balance >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="text-xs text-muted-foreground mb-1">Balance</div>
          <div className={`text-base font-bold ${customer.balance >= 0 ? "text-green-700" : "text-red-600"}`}>
            {customer.balance >= 0 ? "+" : ""}{formatCurrency(Math.abs(customer.balance))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{customer.balance >= 0 ? "Advance (you owe them)" : "Due (they owe you)"}</div>
        </div>
        {loyaltyEnabled && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
            <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Star className="w-3 h-3" />Points</div>
            <div className="text-base font-bold text-amber-700">{customer.loyaltyPoints ?? 0}</div>
          </div>
        )}
      </div>

      {/* Occasions */}
      {(customer.birthday || customer.anniversary) && (
        <div className="flex gap-2 flex-wrap">
          {customer.birthday && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-50 border border-pink-200 text-xs text-pink-700">
              <Gift className="w-3.5 h-3.5" />Birthday: {customer.birthday}
            </div>
          )}
          {customer.anniversary && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-700">
              <Gift className="w-3.5 h-3.5" />Anniversary: {customer.anniversary}
            </div>
          )}
        </div>
      )}

      {/* Purchase history */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-primary" />
            Purchase History
          </div>
          {totalPending > 0 && (
            <Badge variant="destructive" className="text-xs">
              Pending: {formatCurrency(totalPending)}
            </Badge>
          )}
        </div>
        {recentSales.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
            No purchase history yet.
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Invoice</th>
                  <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Date</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                  <th className="px-3 py-2 text-center font-medium hidden sm:table-cell">Payment</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map(sale => (
                  <tr key={sale.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-2 font-mono">{sale.invoiceNumber}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                      {new Date(sale.saleDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-primary">{formatCurrency(sale.totalAmount)}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge
                        className={`text-[10px] h-4 ${sale.paymentStatus === "paid" ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : sale.paymentStatus === "pending" ? "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100"}`}
                        variant="outline"
                      >
                        {sale.paymentStatus.charAt(0).toUpperCase() + sale.paymentStatus.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground capitalize hidden sm:table-cell">{sale.paymentMode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending repairs */}
      {pendingRepairs.length > 0 && (
        <div>
          <div className="text-sm font-semibold flex items-center gap-1.5 mb-2">
            <Wrench className="w-4 h-4 text-primary" />
            Active Repairs ({pendingRepairs.length})
          </div>
          <div className="space-y-2">
            {pendingRepairs.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/10 text-xs">
                <div>
                  <div className="font-medium">{r.itemDescription}</div>
                  <div className="text-muted-foreground mt-0.5">
                    {r.issue} • Due: {new Date(r.promisedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 flex-1 border-green-500/40 text-green-600 hover:bg-green-50"
          onClick={() => {
            const msg = `Hello ${customer.name}! Thank you for your continued trust in us.`;
            const digits = customer.mobile.replace(/\D/g, "");
            const fullMobile = digits.length === 10 ? `91${digits}` : digits;
            window.open(`https://wa.me/${fullMobile}?text=${encodeURIComponent(msg)}`, "_blank");
          }}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}

// ─── Customer History (by phone number) ────────────────────────────────────────
// Works even for people who never got a formal Customer record — Girvi loans are
// matched directly by the mobile number they were pledged under.

type HistorySale = {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  paymentStatus: string;
  paymentMode: string;
  saleDate: string;
};

type HistoryGirviLoan = {
  id: number;
  loanNumber: string;
  status: string;
  loanAmount: number;
  currentPrincipal: number;
  outstandingInterest: number;
  totalDue: number;
  itemDescription: string | null;
  startDate: string;
  dueDate: string;
  redeemedDate: string | null;
  redeemedAmount: number | null;
};

type CustomerHistoryResult = {
  customer: { id: number; name: string; mobile: string; loyaltyPoints: number; totalPurchases: number } | null;
  sales: HistorySale[];
  girviLoans: HistoryGirviLoan[];
};

const GIRVI_STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  extended: "bg-blue-100 text-blue-700 border-blue-200",
  redeemed: "bg-muted text-muted-foreground border-border",
  forfeited: "bg-red-100 text-red-700 border-red-200",
};

function CustomerHistorySearch({ loyaltyEnabled }: { loyaltyEnabled: boolean }) {
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CustomerHistoryResult | null>(null);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const closeResult = useCallback(() => setSearched(false), []);
  useBackClose(searched, closeResult);

  const runSearch = async () => {
    const digits = mobile.replace(/\D/g, "");
    if (digits.length < 4) {
      toast({ title: "Enter at least 4 digits of the mobile number to search", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/customers/history?mobile=${encodeURIComponent(digits)}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to fetch history");
      const data: CustomerHistoryResult = await r.json();
      setResult(data);
      setSearched(true);
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to fetch history", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalSalesValue = (result?.sales ?? []).reduce((s, sale) => s + sale.totalAmount, 0);
  const activeLoans = (result?.girviLoans ?? []).filter(l => l.status === "active" || l.status === "extended");

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
          <History className="w-4 h-4" />
          Customer History Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Look up a person's full history by mobile number — purchases and Girvi loans together,
          even if they were never added as a Customer.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Enter mobile number..."
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") runSearch(); }}
            className="max-w-xs"
            data-testid="input-history-mobile"
          />
          <Button size="sm" onClick={runSearch} disabled={loading} className="gap-1.5" data-testid="button-history-search">
            <Search className="w-3.5 h-3.5" />
            {loading ? "Searching..." : "View History"}
          </Button>
        </div>
      </CardContent>

      <Dialog open={searched} onOpenChange={v => !v && setSearched(false)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {result && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">{result.customer?.name ?? "Unknown Person"}</h2>
                  <div className="text-sm text-muted-foreground">{mobile}</div>
                  {!result.customer && (
                    <div className="text-xs text-amber-600 mt-1">No saved Customer profile for this number — showing available records.</div>
                  )}
                </div>
                <button onClick={() => setSearched(false)} className="text-muted-foreground hover:text-foreground p-1 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Purchases</div>
                  <div className="text-base font-bold text-primary">{formatCurrency(result.customer?.totalPurchases ?? totalSalesValue)}</div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Girvi Loans</div>
                  <div className="text-base font-bold text-blue-700">{result.girviLoans.length} {activeLoans.length > 0 ? `(${activeLoans.length} active)` : ""}</div>
                </div>
                {loyaltyEnabled ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Star className="w-3 h-3" />Points</div>
                    <div className="text-base font-bold text-amber-700">{result.customer?.loyaltyPoints ?? 0}</div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-muted/20 border border-border text-center">
                    <div className="text-xs text-muted-foreground mb-1">Sales Count</div>
                    <div className="text-base font-bold">{result.sales.length}</div>
                  </div>
                )}
              </div>

              {/* Purchase history */}
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                  Purchase History
                </div>
                {result.sales.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
                    {result.customer ? "No purchase history yet." : "Purchase history requires this number to be saved as a Customer."}
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                          <th className="px-3 py-2 text-left font-medium">Invoice</th>
                          <th className="px-3 py-2 text-left font-medium">Date</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                          <th className="px-3 py-2 text-center font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.sales.map(sale => (
                          <tr key={sale.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                            <td className="px-3 py-2 font-mono">{sale.invoiceNumber}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {new Date(sale.saleDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-primary">{formatCurrency(sale.totalAmount)}</td>
                            <td className="px-3 py-2 text-center">
                              <Badge
                                className={`text-[10px] h-4 ${sale.paymentStatus === "paid" ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100"}`}
                                variant="outline"
                              >
                                {sale.paymentStatus.charAt(0).toUpperCase() + sale.paymentStatus.slice(1)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Girvi loan history */}
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Banknote className="w-4 h-4 text-primary" />
                  Girvi Loan History
                </div>
                {result.girviLoans.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
                    No Girvi loans for this number.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {result.girviLoans.map(loan => {
                      const isActive = loan.status === "active" || loan.status === "extended";
                      return (
                        <div key={loan.id} className="p-3 rounded-xl border border-border bg-muted/10 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold">{loan.loanNumber}</span>
                            <Badge variant="outline" className={`text-[10px] ${GIRVI_STATUS_STYLE[loan.status] ?? ""}`}>
                              {loan.status.toUpperCase()}
                            </Badge>
                          </div>
                          {loan.itemDescription && <div className="text-muted-foreground">{loan.itemDescription}</div>}
                          <div className="flex justify-between text-muted-foreground">
                            <span>Loan: {formatCurrency(loan.loanAmount)}</span>
                            <span>{new Date(loan.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })} → {new Date(loan.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</span>
                          </div>
                          {isActive ? (
                            <div className="font-semibold text-primary">Total due today: {formatCurrency(loan.totalDue)}</div>
                          ) : loan.status === "redeemed" ? (
                            <div className="text-green-700">Redeemed {loan.redeemedDate ? `on ${new Date(loan.redeemedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}` : ""} · Collected {formatCurrency(loan.redeemedAmount ?? 0)}</div>
                          ) : (
                            <div className="text-destructive">Forfeited</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [ledgerCustomerId, setLedgerCustomerId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState(DEFAULT_TEMPLATE);
  const [bulkSending, setBulkSending] = useState(false);
  const [waApiEnabled, setWaApiEnabled] = useState<boolean | null>(null);
  const [pageHelpOpen, setPageHelpOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const closeLedger = useCallback(() => setLedgerCustomerId(null), []);
  useBackClose(ledgerCustomerId !== null, closeLedger);

  // Supports a Dashboard quick action linking straight to "/app/customers?new=1"
  // that auto-opens the Add Customer dialog.
  const queryString = useQueryString();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (new URLSearchParams(queryString).get("new") === "1") {
      setAddOpen(true);
      navigate("/app/customers", { replace: true });
    }
  }, [queryString, navigate]);

  const { data: customers, isLoading } = useListCustomers({ ...(search ? { search } : {}) });
  const { data: occasions } = useGetUpcomingOccasions();
  const { data: settings } = useGetSettings();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const loyaltyEnabled = (settings as unknown as { loyaltyPointsEnabled?: boolean } | undefined)?.loyaltyPointsEnabled ?? true;

  const { register, handleSubmit, reset, watch, setValue } = useForm<CustomerForm>({
    defaultValues: { openingBalance: "0", openingBalanceType: "debit" },
  });
  const openingBalanceTypeWatch = watch("openingBalanceType") ?? "debit";

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { register: registerEdit, handleSubmit: handleEditSubmit, reset: resetEdit, watch: watchEdit, setValue: setEditValue } = useForm<CustomerForm>();
  const editOpeningBalanceTypeWatch = watchEdit("openingBalanceType") ?? "debit";

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    resetEdit({
      name: c.name,
      mobile: c.mobile,
      email: c.email ?? "",
      address: c.address ?? "",
      birthday: c.birthday ?? "",
      anniversary: c.anniversary ?? "",
      gstin: c.gstin ?? "",
      pan: c.pan ?? "",
      stateCode: c.stateCode ?? "",
      notes: c.notes ?? "",
      openingBalance: String(Math.abs(c.balance)),
      openingBalanceType: c.balance >= 0 ? "credit" : "debit",
    });
  };

  const onEditSubmit = (data: CustomerForm) => {
    if (!editingCustomer) return;
    const mag = parseFloat(data.openingBalance) || 0;
    updateCustomer.mutate({
      id: editingCustomer.id,
      data: {
        name: data.name,
        mobile: data.mobile,
        email: data.email || null,
        address: data.address || null,
        birthday: data.birthday || null,
        anniversary: data.anniversary || null,
        gstin: data.gstin || null,
        pan: data.pan ? data.pan.trim().toUpperCase() || null : null,
        stateCode: data.stateCode || null,
        notes: data.notes || null,
        balance: data.openingBalanceType === "credit" ? mag : -mag,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        toast({ title: "Customer updated" });
        setEditingCustomer(null);
      },
      onError: () => toast({ title: "Failed to update customer", variant: "destructive" }),
    });
  };

  const onSubmit = (data: CustomerForm) => {
    const mag = parseFloat(data.openingBalance) || 0;
    createCustomer.mutate({
      data: {
        name: data.name,
        mobile: data.mobile,
        email: data.email || null,
        address: data.address || null,
        birthday: data.birthday || null,
        anniversary: data.anniversary || null,
        gstin: data.gstin || null,
        pan: data.pan ? data.pan.trim().toUpperCase() || null : null,
        stateCode: data.stateCode || null,
        notes: data.notes || null,
        // balance sign convention (see mapCustomer on the backend): positive = credit
        // (advance, shop owes them), negative = debit (due, they owe the shop).
        balance: data.openingBalanceType === "credit" ? mag : -mag,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        toast({ title: "Customer added" });
        setAddOpen(false);
        reset();
      },
      onError: () => toast({ title: "Failed to add customer", variant: "destructive" }),
    });
  };

  const sendWhatsApp = (mobile: string, name: string) => {
    const msg = `Hello ${name}! Thank you for your continued patronage at our jewellery store. We appreciate your business!`;
    const digits = mobile.replace(/\D/g, "");
    const fullMobile = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${fullMobile}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const allIds = (customers ?? []).map(c => c.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const openBulkDialog = async () => {
    if (selectedIds.size === 0) { toast({ title: "Select at least one customer" }); return; }
    if (waApiEnabled === null) {
      const token = localStorage.getItem("swarndesk_token");
      const r = await fetch("/api/whatsapp/config", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const d = await r.json() as { whatsappApiEnabled: boolean };
      setWaApiEnabled(d.whatsappApiEnabled);
    }
    setBulkOpen(true);
  };

  const selectedCustomers = (customers ?? []).filter(c => selectedIds.has(c.id));

  const buildMessage = (name: string) => bulkTemplate.replace(/{name}/g, name);

  const sendViaLinks = () => {
    if (selectedCustomers.length === 0) return;
    selectedCustomers.forEach(c => {
      const digits = c.mobile.replace(/\D/g, "");
      const fullMobile = digits.length === 10 ? `91${digits}` : digits;
      window.open(`https://wa.me/${fullMobile}?text=${encodeURIComponent(buildMessage(c.name))}`, "_blank");
    });
    toast({ title: `Opened WhatsApp for ${selectedCustomers.length} customer(s)` });
    setBulkOpen(false);
    setSelectedIds(new Set());
  };

  const sendViaApi = async () => {
    setBulkSending(true);
    try {
      const recipients = selectedCustomers.map(c => ({ mobile: c.mobile, name: c.name, message: buildMessage(c.name) }));
      const r = await fetch("/api/whatsapp/send-bulk", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ recipients }),
      });
      const d = await r.json() as { sent: number; failed: number; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast({ title: `Sent: ${d.sent} | Failed: ${d.failed}` });
      setBulkOpen(false);
      setSelectedIds(new Set());
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to send via API", variant: "destructive" });
    } finally {
      setBulkSending(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage your customer relationships</p>
          <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button onClick={openBulkDialog} className="gap-2 bg-green-600 hover:bg-green-700" size="sm">
              <MessageCircle className="w-4 h-4" />
              WhatsApp ({selectedIds.size})
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)} className="gap-2" data-testid="button-add-customer">
            <Plus className="w-4 h-4" />Add Customer
          </Button>
        </div>
      </div>

      {/* Customer history lookup by phone number */}
      <CustomerHistorySearch loyaltyEnabled={loyaltyEnabled} />

      {/* Upcoming occasions */}
      {occasions && occasions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
              <Gift className="w-4 h-4" />
              Upcoming Occasions ({occasions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {occasions.slice(0, 6).map(o => (
              <div key={`${o.customerId}-${o.occasionType}`} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs">
                <Gift className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium">{o.customerName}</span>
                <span className="text-muted-foreground capitalize">({o.occasionType})</span>
                <Badge variant="outline" className="text-primary border-primary/40">{o.daysUntil}d</Badge>
                <button
                  onClick={() => sendWhatsApp(o.mobile, o.customerName)}
                  className="text-green-600 hover:text-green-700"
                  data-testid={`button-wa-occasion-${o.customerId}`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name or mobile..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-customers"
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm">
          <Users className="w-4 h-4 text-green-600" />
          <span className="text-green-700 font-medium">{selectedIds.size} customer{selectedIds.size > 1 ? "s" : ""} selected</span>
          <button className="text-xs text-muted-foreground hover:text-foreground ml-auto" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      {/* Table */}
      <Card className="border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left w-10">
                  <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                    {allSelected ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Mobile</th>
                <th className="px-4 py-3 text-right font-medium">Purchases</th>
                <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Balance</th>
                {loyaltyEnabled && <th className="px-4 py-3 text-center font-medium hidden md:table-cell">Points</th>}
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={loyaltyEnabled ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && (!customers || customers.length === 0) && (
                <tr><td colSpan={loyaltyEnabled ? 7 : 6} className="px-4 py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <div className="text-muted-foreground">No customers found.</div>
                </td></tr>
              )}
              {(customers ?? []).map(c => (
                <tr
                  key={c.id}
                  className={`border-b border-border hover:bg-muted/10 ${selectedIds.has(c.id) ? "bg-green-50/50" : ""}`}
                  data-testid={`row-customer-${c.id}`}
                >
                  <td className="px-4 py-3">
                    <button onClick={() => toggleOne(c.id)} className="text-muted-foreground hover:text-foreground">
                      {selectedIds.has(c.id) ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="text-left hover:text-primary transition-colors"
                      onClick={() => setLedgerCustomerId(c.id)}
                      data-testid={`button-ledger-${c.id}`}
                    >
                      <div className="font-medium hover:underline">{c.name}</div>
                      {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.mobile}</td>
                  <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(c.totalPurchases)}</td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className={c.balance >= 0 ? "text-green-600" : "text-destructive"}>
                      {c.balance >= 0 ? "+" : ""}{formatCurrency(Math.abs(c.balance))}
                    </span>
                    <div className="text-[10px] text-muted-foreground">{c.balance >= 0 ? "Advance" : "Due"}</div>
                  </td>
                  {loyaltyEnabled && (
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <div className="flex items-center justify-center gap-1 text-amber-600">
                        <Star className="w-3 h-3 fill-amber-500" />{c.loyaltyPoints}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setLedgerCustomerId(c.id)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="View Ledger / Khata"
                        data-testid={`button-view-${c.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Edit Customer"
                        data-testid={`button-edit-${c.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => sendWhatsApp(c.mobile, c.name)}
                        className="text-green-600 hover:text-green-700"
                        title="Send WhatsApp"
                        data-testid={`button-wa-customer-${c.id}`}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Customer Ledger Dialog */}
      <Dialog open={ledgerCustomerId !== null} onOpenChange={v => !v && setLedgerCustomerId(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {ledgerCustomerId !== null && (
            <CustomerLedger
              customerId={ledgerCustomerId}
              onClose={() => setLedgerCustomerId(null)}
              loyaltyEnabled={loyaltyEnabled}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk WhatsApp Dialog */}
      <Dialog open={bulkOpen} onOpenChange={v => { if (!bulkSending) setBulkOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Bulk WhatsApp ({selectedIds.size} Recipient{selectedIds.size > 1 ? "s" : ""})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {selectedCustomers.map(c => (
                <span key={c.id} className="px-2 py-0.5 bg-muted/40 border border-border rounded-full text-xs">{c.name}</span>
              ))}
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Message Template — type <code className="bg-muted px-1 rounded">{"{name}"}</code> anywhere in the message and it will be replaced with each customer's name automatically.
              </label>
              <textarea
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                rows={5}
                value={bulkTemplate}
                onChange={e => setBulkTemplate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">{bulkTemplate.length} chars</p>
            </div>

            {selectedCustomers[0] && (
              <div className="p-3 rounded-lg bg-muted/20 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Preview for {selectedCustomers[0].name}:</div>
                <div className="text-xs">{buildMessage(selectedCustomers[0].name)}</div>
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground mb-2">Quick templates:</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Thank you", msg: "Dear {name}, thank you for your continued trust in us! Your patronage means a lot. Visit us soon for our latest jewellery collection." },
                  { label: "Festival offer", msg: "Dear {name}, wishing you a joyful festive season! Enjoy special discounts on gold jewellery this week. Visit our store or call us for details." },
                  { label: "New arrivals", msg: "Hello {name}! We have exciting new arrivals in our jewellery collection. Come in and explore — we'd love to show you something special." },
                ].map(t => (
                  <button
                    key={t.label}
                    onClick={() => setBulkTemplate(t.msg)}
                    className="px-2 py-1 text-xs rounded border border-border hover:border-primary hover:text-primary transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(false)} disabled={bulkSending}>Cancel</Button>
            <Button size="sm" variant="outline" onClick={sendViaLinks} disabled={bulkSending} className="gap-1.5 border-green-500/40 text-green-600 hover:bg-green-50">
              <MessageCircle className="w-3.5 h-3.5" />
              Open WhatsApp Links
            </Button>
            {waApiEnabled && (
              <Button
                size="sm"
                onClick={sendViaApi}
                disabled={bulkSending}
                className="gap-1.5 bg-green-600 hover:bg-green-700"
                title="Sends automatically in the background — needs WhatsApp Business API set up in Settings"
              >
                <Send className="w-3.5 h-3.5" />
                {bulkSending ? "Sending..." : "Send Automatically"}
              </Button>
            )}
          </DialogFooter>
          {!waApiEnabled && (
            <p className="text-xs text-muted-foreground text-center -mt-1">
              Want to send automatically without opening WhatsApp for each customer? That's an optional paid upgrade — needs WhatsApp Business API set up in Settings; otherwise use "Open WhatsApp Links" above to send manually.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                <Input {...register("name", { required: true })} placeholder="Ramesh Sharma" data-testid="input-customer-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mobile *</label>
                <Input {...register("mobile", { required: true })} placeholder="+91 98765 43210" data-testid="input-customer-mobile" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                <Input {...register("email")} placeholder="email@example.com" data-testid="input-customer-email" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                <Input {...register("address")} placeholder="123 Main St, Mumbai" data-testid="input-customer-address" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Birthday (Month-Day, e.g. 15 June = 06-15)</label>
                <Input {...register("birthday")} placeholder="MM-DD, e.g. 06-15" data-testid="input-customer-birthday" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Anniversary (Month-Day, e.g. 20 Nov = 11-20)</label>
                <Input {...register("anniversary")} placeholder="MM-DD, e.g. 11-20" data-testid="input-customer-anniversary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">GSTIN</label>
                <Input {...register("gstin")} placeholder="27AAACR5055K1ZS" data-testid="input-customer-gstin" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">GST State Code</label>
                <Input {...register("stateCode")} placeholder="27" maxLength={2} data-testid="input-customer-state-code" />
                <p className="text-[10px] text-muted-foreground mt-1">For B2B invoices — decides CGST+SGST vs IGST</p>
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  PAN
                  <InfoTooltip text="Required on file for any cash sale of ₹2 lakh or more to this customer (Sec. 269ST) — collect it ahead of time so you're not scrambling at billing." />
                </Label>
                <Input {...register("pan")} placeholder="ABCDE1234F" maxLength={10} className="uppercase" data-testid="input-customer-pan" />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  Opening Balance
                  <InfoTooltip text="What this customer already owed you (or had already paid in advance) before you started using this software — not touched by future sales/payments recorded here." />
                </Label>
                <Input type="number" {...register("openingBalance")} placeholder="0" />
              </div>
              <div>
                <Label>Balance Side</Label>
                <Select value={openingBalanceTypeWatch} onValueChange={v => setValue("openingBalanceType", v as "debit" | "credit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Due (they owe you)</SelectItem>
                    <SelectItem value="credit">Advance (you owe them)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createCustomer.isPending} data-testid="button-submit-customer">
                {createCustomer.isPending ? "Adding..." : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={v => !v && setEditingCustomer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                <Input {...registerEdit("name", { required: true })} placeholder="Ramesh Sharma" data-testid="input-edit-customer-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Mobile *</label>
                <Input {...registerEdit("mobile", { required: true })} placeholder="+91 98765 43210" data-testid="input-edit-customer-mobile" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                <Input {...registerEdit("email")} placeholder="email@example.com" data-testid="input-edit-customer-email" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                <Input {...registerEdit("address")} placeholder="123 Main St, Mumbai" data-testid="input-edit-customer-address" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Birthday (Month-Day, e.g. 15 June = 06-15)</label>
                <Input {...registerEdit("birthday")} placeholder="MM-DD, e.g. 06-15" data-testid="input-edit-customer-birthday" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Anniversary (Month-Day, e.g. 20 Nov = 11-20)</label>
                <Input {...registerEdit("anniversary")} placeholder="MM-DD, e.g. 11-20" data-testid="input-edit-customer-anniversary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">GSTIN</label>
                <Input {...registerEdit("gstin")} placeholder="27AAACR5055K1ZS" data-testid="input-edit-customer-gstin" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">GST State Code</label>
                <Input {...registerEdit("stateCode")} placeholder="27" maxLength={2} data-testid="input-edit-customer-state-code" />
                <p className="text-[10px] text-muted-foreground mt-1">For B2B invoices — decides CGST+SGST vs IGST</p>
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  PAN
                  <InfoTooltip text="Required on file for any cash sale of ₹2 lakh or more to this customer (Sec. 269ST) — collect it ahead of time so you're not scrambling at billing." />
                </Label>
                <Input {...registerEdit("pan")} placeholder="ABCDE1234F" maxLength={10} className="uppercase" data-testid="input-edit-customer-pan" />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  Balance
                  <InfoTooltip text="This customer's current running balance — correct it here if it's ever out of sync (e.g. an opening-balance mistake). Not touched automatically by future sales/payments." />
                </Label>
                <Input type="number" {...registerEdit("openingBalance")} placeholder="0" />
              </div>
              <div>
                <Label>Balance Side</Label>
                <Select value={editOpeningBalanceTypeWatch} onValueChange={v => setEditValue("openingBalanceType", v as "debit" | "credit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Due (they owe you)</SelectItem>
                    <SelectItem value="credit">Advance (you owe them)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <Input {...registerEdit("notes")} data-testid="input-edit-customer-notes" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
              <Button type="submit" disabled={updateCustomer.isPending} data-testid="button-submit-edit-customer">
                {updateCustomer.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Customers"
        description="Your main shop customer directory — contact details, GST info for B2B billing, birthdays/anniversaries for occasion reminders, and quick WhatsApp outreach."
        sections={[
          {
            heading: "What you can do here",
            items: [
              "Add Customer — create a new customer record",
              "Customer history lookup — search by phone number to pull up someone's full purchase/repair/order history",
              "Select customers (checkboxes) then WhatsApp — send a bulk message to everyone selected",
              "Upcoming Occasions — customers with a birthday/anniversary coming up, with a one-click WhatsApp button",
            ],
          },
          {
            heading: "Terms you'll see",
            items: [
              "GSTIN / GST State Code — only needed for B2B invoices; decides whether CGST+SGST or IGST applies",
            ],
          },
        ]}
      />
    </div>
  );
}
