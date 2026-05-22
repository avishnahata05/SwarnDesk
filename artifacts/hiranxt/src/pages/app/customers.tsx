import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
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
import { Plus, Search, Users, Gift, MessageCircle, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerForm {
  name: string; mobile: string; email: string; address: string;
  birthday: string; anniversary: string; gstin: string; notes: string;
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
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

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage your customer relationships</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2" data-testid="button-add-customer">
          <Plus className="w-4 h-4" />Add Customer
        </Button>
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

      {/* Table */}
      <Card className="border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Mobile</th>
                <th className="px-4 py-3 text-right font-medium">Total Purchases</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-center font-medium">Points</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && (!customers || customers.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No customers found.</td></tr>
              )}
              {(customers ?? []).map(c => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/10" data-testid={`row-customer-${c.id}`}>
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
