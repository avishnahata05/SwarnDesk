import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  useListCustomers, useCreateCustomer, useDeleteCustomer, useGetUpcomingOccasions,
  getListCustomersQueryKey, getGetUpcomingOccasionsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Plus, Search, Gift, MessageCircle, Star, Send, CheckSquare, Square, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerForm {
  name: string; mobile: string; email: string; address: string;
  birthday: string; anniversary: string; gstin: string; notes: string;
}

const DEFAULT_TEMPLATE = "Dear {name}, thank you for being a valued customer at our jewellery store! We'd love to see you again. Visit us for our latest collection and exclusive offers.";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState(DEFAULT_TEMPLATE);
  const [bulkSending, setBulkSending] = useState(false);
  const [waApiEnabled, setWaApiEnabled] = useState<boolean | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: customers, isLoading } = useListCustomers({ ...(search ? { search } : {}) });
  const { data: occasions } = useGetUpcomingOccasions();
  const createCustomer = useCreateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const { register, handleSubmit, reset } = useForm<CustomerForm>();

  const onSubmit = (data: CustomerForm) => {
    createCustomer.mutate({
      data: {
        name: data.name,
        mobile: data.mobile,
        email: data.email || null,
        address: data.address || null,
        birthday: data.birthday || null,
        anniversary: data.anniversary || null,
        gstin: data.gstin || null,
        notes: data.notes || null,
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
    window.open(`https://wa.me/91${mobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
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
      const r = await fetch("/api/whatsapp/config");
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
      window.open(`https://wa.me/91${c.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(buildMessage(c.name))}`, "_blank");
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
        headers: { "Content-Type": "application/json" },
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
                  className="text-green-400 hover:text-green-300"
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
          placeholder="Search customers by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-customers"
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
          <Users className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-medium">{selectedIds.size} customer{selectedIds.size > 1 ? "s" : ""} selected</span>
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
                    {allSelected ? <CheckSquare className="w-4 h-4 text-green-400" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Mobile</th>
                <th className="px-4 py-3 text-right font-medium">Total Purchases</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-center font-medium">Points</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && (!customers || customers.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No customers found.</td></tr>
              )}
              {(customers ?? []).map(c => (
                <tr key={c.id} className={`border-b border-border hover:bg-muted/10 ${selectedIds.has(c.id) ? "bg-green-500/5" : ""}`} data-testid={`row-customer-${c.id}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleOne(c.id)} className="text-muted-foreground hover:text-foreground">
                      {selectedIds.has(c.id) ? <CheckSquare className="w-4 h-4 text-green-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.mobile}</td>
                  <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(c.totalPurchases)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={c.balance >= 0 ? "text-green-400" : "text-destructive"}>
                      {c.balance >= 0 ? "+" : ""}{formatCurrency(Math.abs(c.balance))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-primary">
                      <Star className="w-3 h-3 fill-primary" />{c.loyaltyPoints}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => sendWhatsApp(c.mobile, c.name)}
                      className="text-green-400 hover:text-green-300 mx-2"
                      title="Send WhatsApp"
                      data-testid={`button-wa-customer-${c.id}`}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bulk WhatsApp Dialog */}
      <Dialog open={bulkOpen} onOpenChange={v => { if (!bulkSending) setBulkOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-400" />
              Bulk WhatsApp — {selectedIds.size} Recipient{selectedIds.size > 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Recipient preview chips */}
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {selectedCustomers.map(c => (
                <span key={c.id} className="px-2 py-0.5 bg-muted/40 border border-border rounded-full text-xs">{c.name}</span>
              ))}
            </div>

            {/* Template editor */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Message Template — use <code className="bg-muted px-1 rounded">{"{name}"}</code> for customer name
              </label>
              <textarea
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                rows={5}
                value={bulkTemplate}
                onChange={e => setBulkTemplate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">{bulkTemplate.length} chars</p>
            </div>

            {/* Preview */}
            {selectedCustomers[0] && (
              <div className="p-3 rounded-lg bg-muted/20 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Preview for {selectedCustomers[0].name}:</div>
                <div className="text-xs">{buildMessage(selectedCustomers[0].name)}</div>
              </div>
            )}

            {/* Templates */}
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
            <Button size="sm" variant="outline" onClick={sendViaLinks} disabled={bulkSending} className="gap-1.5 border-green-500/40 text-green-400 hover:bg-green-500/10">
              <MessageCircle className="w-3.5 h-3.5" />
              Open WhatsApp Links
            </Button>
            {waApiEnabled && (
              <Button size="sm" onClick={sendViaApi} disabled={bulkSending} className="gap-1.5 bg-green-600 hover:bg-green-700">
                <Send className="w-3.5 h-3.5" />
                {bulkSending ? "Sending..." : "Send via API"}
              </Button>
            )}
          </DialogFooter>
          {!waApiEnabled && (
            <p className="text-xs text-muted-foreground text-center -mt-1">
              To send directly via API (no window pop-ups), configure WhatsApp Business API in Settings.
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
                <label className="text-xs text-muted-foreground mb-1 block">Birthday (MM-DD)</label>
                <Input {...register("birthday")} placeholder="06-15" data-testid="input-customer-birthday" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Anniversary (MM-DD)</label>
                <Input {...register("anniversary")} placeholder="11-20" data-testid="input-customer-anniversary" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">GSTIN</label>
                <Input {...register("gstin")} placeholder="27AAACR5055K1ZS" data-testid="input-customer-gstin" />
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
    </div>
  );
}
