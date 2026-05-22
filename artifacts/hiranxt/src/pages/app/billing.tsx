import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  useListInventoryItems, useListCustomers, useCreateSale, useGetCurrentRates,
  getListInventoryItemsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Trash2, PrinterIcon, MessageCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  inventoryItemId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  metalRate: number;
  goldWeight: number;
  makingCharges: number;
  discount: number;
}

export default function Billing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [customerSearch, setCustomerSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string; mobile: string } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [discount, setDiscount] = useState(0);
  const [exchangeGoldWeight, setExchangeGoldWeight] = useState(0);
  const [saleComplete, setSaleComplete] = useState<{ invoiceNumber: string; total: number } | null>(null);

  const { data: rates } = useGetCurrentRates();
  const { data: customers } = useListCustomers({ ...(customerSearch ? { search: customerSearch } : {}) });
  const { data: items } = useListInventoryItems({ ...(itemSearch ? { search: itemSearch } : {}) });
  const createSale = useCreateSale();

  const goldRate = rates?.gold22k ?? 7250;
  const silverRate = rates?.silver ?? 95;
  const GST_RATE = 0.03;

  const subTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0);
  const exchangeGoldValue = exchangeGoldWeight * goldRate;
  const gstAmount = (subTotal - discount - exchangeGoldValue) * GST_RATE;
  const totalAmount = subTotal - discount - exchangeGoldValue + gstAmount;

  const addToCart = (item: { id: number; name: string; metalRate: number; grossWeight: number; makingCharges: number; totalValue: number }) => {
    setCart(prev => {
      const existing = prev.find(c => c.inventoryItemId === item.id);
      if (existing) {
        return prev.map(c => c.inventoryItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        inventoryItemId: item.id,
        itemName: item.name,
        quantity: 1,
        unitPrice: item.totalValue,
        metalRate: item.metalRate,
        goldWeight: item.grossWeight,
        makingCharges: item.makingCharges,
        discount: 0,
      }];
    });
    setItemSearch("");
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(c => c.inventoryItemId !== id));

  const completeSale = () => {
    if (cart.length === 0) { toast({ title: "Add items to cart first", variant: "destructive" }); return; }
    createSale.mutate({
      data: {
        customerId: selectedCustomer?.id ?? null,
        customerName: selectedCustomer?.name ?? "Walk-in Customer",
        totalAmount,
        gstAmount,
        discountAmount: discount,
        exchangeGoldWeight,
        exchangeGoldValue,
        paymentMode,
        paymentStatus,
        notes: null,
        items: cart.map(c => ({
          inventoryItemId: c.inventoryItemId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          metalRate: c.metalRate,
          goldWeight: c.goldWeight,
          makingCharges: c.makingCharges,
          discount: c.discount,
        })),
      }
    }, {
      onSuccess: (sale) => {
        setSaleComplete({ invoiceNumber: sale.invoiceNumber, total: sale.totalAmount });
        setCart([]);
        setSelectedCustomer(null);
        setDiscount(0);
        setExchangeGoldWeight(0);
        queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
        toast({ title: "Sale completed!", description: `Invoice: ${sale.invoiceNumber}` });
      },
      onError: () => toast({ title: "Sale failed", variant: "destructive" }),
    });
  };

  const sendInvoiceWhatsApp = () => {
    if (!saleComplete || !selectedCustomer) return;
    const msg = `Dear ${selectedCustomer.name}, your invoice ${saleComplete.invoiceNumber} for ${formatCurrency(saleComplete.total)} has been generated. Thank you for shopping with us!`;
    window.open(`https://wa.me/91${selectedCustomer.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (saleComplete) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-6">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Sale Complete!</h2>
          <p className="text-muted-foreground mt-2">Invoice {saleComplete.invoiceNumber}</p>
          <p className="text-3xl font-bold text-primary mt-3">{formatCurrency(saleComplete.total)}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" className="gap-2" onClick={() => window.print()} data-testid="button-print-invoice">
            <PrinterIcon className="w-4 h-4" />Print Invoice
          </Button>
          {selectedCustomer && (
            <Button variant="outline" className="gap-2 text-green-400" onClick={sendInvoiceWhatsApp} data-testid="button-wa-invoice">
              <MessageCircle className="w-4 h-4" />WhatsApp
            </Button>
          )}
          <Button onClick={() => setSaleComplete(null)} data-testid="button-new-bill">New Bill</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid xl:grid-cols-3 gap-5 max-w-7xl">
      {/* Left: Customer + Items */}
      <div className="xl:col-span-2 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Billing & POS</h1>
          <p className="text-muted-foreground text-sm">Create GST invoice</p>
        </div>

        {/* Customer search */}
        <Card className="border-border">
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Customer</div>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div>
                  <div className="font-medium">{selectedCustomer.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedCustomer.mobile}</div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-muted-foreground hover:text-foreground text-xs">Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-customer-search"
                />
                {customerSearch && (customers ?? []).length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    <div
                      className="px-3 py-2 text-xs text-muted-foreground border-b border-border cursor-pointer hover:bg-muted/20"
                      onClick={() => { setSelectedCustomer({ id: 0, name: "Walk-in Customer", mobile: "" }); setCustomerSearch(""); }}
                    >
                      Walk-in Customer
                    </div>
                    {(customers ?? []).slice(0, 6).map(c => (
                      <div
                        key={c.id}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-muted/20 flex justify-between"
                        onClick={() => { setSelectedCustomer({ id: c.id, name: c.name, mobile: c.mobile }); setCustomerSearch(""); }}
                        data-testid={`option-customer-${c.id}`}
                      >
                        <span>{c.name}</span>
                        <span className="text-muted-foreground text-xs">{c.mobile}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Item search */}
        <Card className="border-border">
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Add Items</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search item or scan barcode..."
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="pl-9"
                data-testid="input-item-search"
              />
              {itemSearch && (items ?? []).length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                  {(items ?? []).filter(i => i.quantity > 0).slice(0, 8).map(item => (
                    <div
                      key={item.id}
                      className="px-3 py-2.5 cursor-pointer hover:bg-muted/20 flex justify-between items-center border-b border-border/50 last:border-0"
                      onClick={() => addToCart(item)}
                      data-testid={`option-item-${item.id}`}
                    >
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.category} • {item.purity} • {item.grossWeight}g</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-primary">{formatCurrency(item.totalValue)}</div>
                        <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live rates display */}
            <div className="flex gap-3 text-xs">
              <div className="px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
                22K Gold: <span className="font-semibold text-primary">₹{goldRate.toLocaleString("en-IN")}/g</span>
              </div>
              <div className="px-3 py-1.5 bg-muted rounded-lg border border-border">
                Silver: <span className="font-semibold">₹{Math.round(silverRate)}/g</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        {cart.length > 0 && (
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Cart ({cart.length} items)</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Item</th>
                    <th className="px-4 py-2 text-center font-medium">Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Price</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.inventoryItemId} className="border-b border-border/50">
                      <td className="px-4 py-2.5 font-medium">{item.itemName}</td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setCart(prev => prev.map(c => c.inventoryItemId === item.inventoryItemId ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))} className="w-5 h-5 rounded bg-muted text-foreground flex items-center justify-center">-</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => setCart(prev => prev.map(c => c.inventoryItemId === item.inventoryItemId ? { ...c, quantity: c.quantity + 1 } : c))} className="w-5 h-5 rounded bg-muted text-foreground flex items-center justify-center">+</button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => removeFromCart(item.inventoryItemId)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Right: Summary + Payment */}
      <div className="space-y-4">
        <Card className="border-border">
          <CardContent className="p-4 space-y-4">
            <div className="text-sm font-semibold">Order Summary</div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sub Total</span>
                <span>{formatCurrency(subTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Discount (₹)</span>
                <input
                  type="number"
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-24 text-right bg-background border border-border rounded px-2 py-1 text-sm"
                  data-testid="input-discount"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Exchange Gold (g)</span>
                <input
                  type="number"
                  step="0.001"
                  value={exchangeGoldWeight}
                  onChange={e => setExchangeGoldWeight(parseFloat(e.target.value) || 0)}
                  className="w-24 text-right bg-background border border-border rounded px-2 py-1 text-sm"
                  data-testid="input-exchange-gold"
                />
              </div>
              {exchangeGoldWeight > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Exchange Value</span>
                  <span>-{formatCurrency(exchangeGoldValue)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>GST (3%)</span>
                <span>{formatCurrency(gstAmount)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(Math.max(0, totalAmount))}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Payment Mode</label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger data-testid="select-payment-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cash", "upi", "card", "credit", "partial"].map(m => (
                      <SelectItem key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Payment Status</label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger data-testid="select-payment-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={completeSale}
              disabled={createSale.isPending || cart.length === 0}
              data-testid="button-complete-sale"
            >
              {createSale.isPending ? "Processing..." : `Complete Sale ${cart.length > 0 ? `· ${formatCurrency(Math.max(0, totalAmount))}` : ""}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
