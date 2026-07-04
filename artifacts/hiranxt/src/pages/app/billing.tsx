import { useState, useRef, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  useListInventoryItems, useListCustomers, useCreateSale, useGetCurrentRates,
  useGetSettings, useCreateCustomer, useGetCustomer, useUpdateRates,
  getListInventoryItemsQueryKey, getListCustomersQueryKey, getGetCurrentRatesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Search, Plus, Trash2, MessageCircle, CheckCircle2,
  UserPlus, ChevronDown, ChevronUp, FileText, ClipboardList, History, Pencil,
  ScanLine, CheckCircle, XCircle, Zap, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMetalRateForm } from "@/hooks/use-metal-rate-form";

interface CartItem {
  inventoryItemId: number;
  itemName: string;
  huid: string | null; // BIS Hallmark Unique ID — must appear on the invoice for hallmarked jewellery
  quantity: number;
  availableQty: number; // max allowed; Infinity for quick-entry items
  unitPrice: number;
  metalRate: number;
  grossWeight: number;
  netWeight: number;
  makingCharges: number;
  stoneCharges: number;
  discount: number;
}

interface SaleComplete {
  invoiceNumber: string;
  total: number;
  customerName: string;
  customerMobile: string;
  cartSnapshot: CartItem[];
  subTotal: number;
  discountAmount: number;
  exchangeGoldWeight: number;
  exchangeGoldValue: number;
  taxableBase: number;
  gstAmount: number;
  paymentMode: string;
  paymentStatus: string;
}

// Escape user-entered text (item names, customer names, shop settings) before it lands
// in the print window's HTML — otherwise a crafted name could inject markup/script into
// the print popup, which retains a window.opener link back to the app.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const PURITIES = ["24K", "22K", "18K", "14K", "925", "999"];
const PURITY_MULTIPLIER: Record<string, number> = {
  "24K": 1, "22K": 22 / 24, "18K": 18 / 24, "14K": 14 / 24, "925": 0.925, "999": 0.999,
};

// ─── Print bill/estimate in a new window ───────────────────────────────────
function openPrintWindow(params: {
  isEstimate: boolean;
  invoiceNumber: string;
  date: string;
  shop: { name: string; gstin: string; address: string; mobile: string };
  customer: { name: string; mobile: string };
  items: CartItem[];
  subTotal: number;
  discountAmount: number;
  exchangeGoldWeight: number;
  exchangeGoldValue: number;
  taxableBase: number;
  gstAmount: number;
  totalAmount: number;
  paymentMode: string;
}) {
  const { isEstimate, invoiceNumber, date, shop, customer, items,
    subTotal, discountAmount, exchangeGoldWeight, exchangeGoldValue,
    taxableBase, gstAmount, totalAmount, paymentMode } = params;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemRows = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="desc">${escapeHtml(item.itemName)}${item.huid ? `<br/><span class="huid">HUID: ${escapeHtml(item.huid)}</span>` : ""}</td>
      <td class="center">${item.quantity}</td>
      <td class="right">${item.grossWeight.toFixed(3)}g</td>
      <td class="right">${item.netWeight.toFixed(3)}g</td>
      <td class="right">${fmt(item.makingCharges)}</td>
      <td class="right">${item.stoneCharges > 0 ? fmt(item.stoneCharges) : "—"}</td>
      <td class="right">${fmt(item.unitPrice * item.quantity)}</td>
    </tr>
  `).join("");

  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${isEstimate ? "Estimate" : "Tax Invoice"} – ${invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; font-size: 13px; }
  .page { max-width: 780px; margin: 0 auto; padding: 32px 28px; }

  /* Header */
  .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
  .shop-name { font-size: 22px; font-weight: 800; color: #1a6640; letter-spacing: -0.5px; }
  .shop-sub { font-size: 11px; color: #555; margin-top: 3px; line-height: 1.5; }
  .doc-type { text-align: right; }
  .doc-label { font-size: 15px; font-weight: 700; color: #1a6640; text-transform: uppercase; letter-spacing: 1px; }
  ${isEstimate ? `.doc-label { color: #b45309; }` : ""}
  .doc-num { font-size: 12px; color: #555; margin-top: 4px; }
  .doc-date { font-size: 12px; color: #555; margin-top: 2px; }

  hr { border: none; border-top: 2px solid #1a6640; margin: 14px 0; }
  ${isEstimate ? `hr { border-color: #d97706; }` : ""}

  /* Customer info */
  .info-row { display: flex; gap: 24px; margin-bottom: 18px; }
  .info-box { flex: 1; background: #f6f9f7; border: 1px solid #d1e7da; border-radius: 8px; padding: 10px 14px; }
  ${isEstimate ? `.info-box { background: #fefce8; border-color: #fde68a; }` : ""}
  .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; font-weight: 600; margin-bottom: 4px; }
  .info-value { font-size: 13px; font-weight: 600; }
  .info-sub { font-size: 11px; color: #555; margin-top: 2px; }

  /* Items table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
  thead tr { background: #1a6640; color: white; }
  ${isEstimate ? `thead tr { background: #d97706; }` : ""}
  thead th { padding: 8px 10px; font-weight: 600; text-align: left; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  td.desc { max-width: 200px; }
  .huid { font-size: 10px; color: #777; font-weight: 400; }
  tfoot td { padding: 8px 10px; font-weight: 600; border-top: 2px solid #e5e7eb; }

  /* Summary */
  .summary-wrap { display: flex; justify-content: flex-end; margin-top: 4px; }
  .summary { width: 280px; }
  .sum-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .sum-row.light { color: #555; }
  .sum-row.discount { color: #16a34a; }
  .sum-row.exchange { color: #2563eb; }
  .sum-row.total { font-size: 16px; font-weight: 800; color: #1a6640; border-top: 2px solid #1a6640; padding-top: 8px; margin-top: 4px; }
  ${isEstimate ? `.sum-row.total { color: #d97706; border-color: #d97706; }` : ""}

  /* GST note */
  .gst-note { font-size: 10px; color: #888; margin-top: 8px; text-align: right; }

  /* Payment */
  .payment-badge { display: inline-block; margin-top: 12px; padding: 4px 12px; border-radius: 100px;
    font-size: 11px; font-weight: 600; background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
  ${isEstimate ? `.payment-badge { background: #fef9c3; color: #92400e; border-color: #fcd34d; }` : ""}

  /* Footer */
  .footer { margin-top: 32px; border-top: 1px dashed #ccc; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-left { font-size: 11px; color: #666; line-height: 1.6; }
  .footer-right { font-size: 11px; color: #888; text-align: right; }
  .sig-line { border-top: 1px solid #999; width: 140px; margin-bottom: 4px; }

  /* Watermark for estimate */
  ${isEstimate ? `
  .watermark {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg);
    font-size: 72px; font-weight: 900; color: rgba(217,119,6,0.08);
    pointer-events: none; user-select: none; z-index: 0; white-space: nowrap;
  }` : ""}

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
${isEstimate ? '<div class="watermark">ESTIMATE</div>' : ""}
<div class="page">

  <!-- Print button (hidden on print) -->
  <div class="no-print" style="text-align:right;margin-bottom:16px;">
    <button onclick="window.print()" style="background:#1a6640;color:white;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="shop-name">${escapeHtml(shop.name)}</div>
      <div class="shop-sub">
        ${escapeHtml(shop.address)}<br/>
        Mobile: ${escapeHtml(shop.mobile)}${shop.gstin ? ` &nbsp;|&nbsp; GSTIN: ${escapeHtml(shop.gstin)}` : ""}
      </div>
    </div>
    <div class="doc-type">
      <div class="doc-label">${isEstimate ? "Estimate / Quotation" : "Tax Invoice"}</div>
      <div class="doc-num">${isEstimate ? "Est. Ref" : "Invoice"}: ${escapeHtml(invoiceNumber)}</div>
      <div class="doc-date">Date: ${escapeHtml(date)}</div>
      <div class="doc-date">HSN: 7113 · GST: 3%${isEstimate ? " (estimated)" : ""}</div>
    </div>
  </div>

  <hr/>

  <!-- Bill to / Bill from info -->
  <div class="info-row">
    <div class="info-box">
      <div class="info-label">Bill To</div>
      <div class="info-value">${escapeHtml(customer.name || "Walk-in Customer")}</div>
      ${customer.mobile ? `<div class="info-sub">📞 ${escapeHtml(customer.mobile)}</div>` : ""}
    </div>
    <div class="info-box">
      <div class="info-label">${isEstimate ? "Valid Until" : "Payment Mode"}</div>
      <div class="info-value" style="text-transform:capitalize">${isEstimate ? getEstimateExpiry() : paymentMode}</div>
      ${!isEstimate ? `<div class="info-sub">Invoice Date: ${date}</div>` : `<div class="info-sub">Prices subject to change with gold rates</div>`}
    </div>
  </div>

  <!-- Items table -->
  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>Description</th>
        <th class="center">Qty</th>
        <th class="right">Gross Wt</th>
        <th class="right">Net Wt</th>
        <th class="right">Making</th>
        <th class="right">Stone/Other</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Summary -->
  <div class="summary-wrap">
    <div class="summary">
      <div class="sum-row light">
        <span>Sub Total</span><span>${fmt(subTotal)}</span>
      </div>
      ${discountAmount > 0 ? `<div class="sum-row discount"><span>Discount</span><span>− ${fmt(discountAmount)}</span></div>` : ""}
      ${exchangeGoldWeight > 0 ? `<div class="sum-row exchange"><span>Exchange Gold (${exchangeGoldWeight.toFixed(3)}g)</span><span>− ${fmt(exchangeGoldValue)}</span></div>` : ""}
      <div class="sum-row light"><span>Taxable Value</span><span>${fmt(taxableBase)}</span></div>
      <div class="sum-row light"><span>CGST @ 1.5%${isEstimate ? " (est.)" : ""}</span><span>${fmt(cgst)}</span></div>
      <div class="sum-row light"><span>SGST @ 1.5%${isEstimate ? " (est.)" : ""}</span><span>${fmt(sgst)}</span></div>
      <div class="sum-row total">
        <span>${isEstimate ? "Estimated Total" : "Grand Total"}</span>
        <span>${fmt(totalAmount)}</span>
      </div>
    </div>
  </div>
  <div class="gst-note">${isEstimate ? "Estimated amount in words" : "Amount in words"}: ${amountToWords(totalAmount)}</div>

  ${!isEstimate ? `<div class="payment-badge">✓ ${escapeHtml(paymentMode.toUpperCase())} Payment</div>` : `<div class="payment-badge">⏳ Estimate Valid for 7 Days</div>`}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      ${isEstimate
        ? "This is an estimate/quotation only, not a tax invoice.<br/>Final price may vary based on gold rates on the day of purchase."
        : "Thank you for your purchase! All goods sold are subject to our terms & conditions.<br/>This is a computer-generated document. No signature required."}
    </div>
    <div class="footer-right">
      <div class="sig-line"></div>
      <div>Authorised Signatory</div>
      <div style="font-weight:600;margin-top:2px;">${escapeHtml(shop.name)}</div>
    </div>
  </div>

</div>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function getEstimateExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function amountToWords(amount: number): string {
  const rounded = Math.round(amount);
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  }
  return `${convert(rounded)} Rupees Only`;
}

// ─── Main component ────────────────────────────────────────────────────────
export default function Billing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rates } = useGetCurrentRates();

  const [tab, setTab] = useState<"stock" | "quick" | "scan">("stock");
  const [customerSearch, setCustomerSearch] = useState("");

  // Barcode scan state
  const [scanInput, setScanInput] = useState("");
  const [scanPending, setScanPending] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<{ name: string; success: boolean } | null>(null);
  const [scanLog, setScanLog] = useState<{ name: string; price: number; qty: number }[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string; mobile: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [paidNow, setPaidNow] = useState<string>("");
  const [discount, setDiscount] = useState(0);
  const [exchangeGoldWeight, setExchangeGoldWeight] = useState(0);
  const [saleComplete, setSaleComplete] = useState<SaleComplete | null>(null);
  const [confirmSaleOpen, setConfirmSaleOpen] = useState(false);

  // Quick add customer
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [qaName, setQaName] = useState("");
  const [qaMobile, setQaMobile] = useState("");
  const [qaEmail, setQaEmail] = useState("");

  // Quick entry state
  const [quickName, setQuickName] = useState("");
  const [quickMetal, setQuickMetal] = useState<"gold" | "silver">("gold");
  const [quickPurity, setQuickPurity] = useState("22K");
  const [quickWeight, setQuickWeight] = useState("");
  const [quickStoneWeight, setQuickStoneWeight] = useState("");
  const [quickMakingPct, setQuickMakingPct] = useState("10");
  const [quickStoneCharges, setQuickStoneCharges] = useState("");
  const [quickQty, setQuickQty] = useState("1");

  // Rate edit dialog state
  const [rateEditOpen, setRateEditOpen] = useState(false);
  const { rateForm, setGoldRate, setSilver, buildRatePayload } = useMetalRateForm(rates);
  const updateRates = useUpdateRates();

  const openRateEdit = () => setRateEditOpen(true);

  const saveRateEdit = () => {
    const payload = buildRatePayload();
    if (Object.keys(payload).length === 0) {
      toast({ title: "Enter at least one valid rate", variant: "destructive" }); return;
    }
    updateRates.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentRatesQueryKey() });
        setRateEditOpen(false);
        toast({ title: "Rates updated" });
      },
      onError: () => toast({ title: "Failed to update rates", variant: "destructive" }),
    });
  };

  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const itemDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerSearch("");
      }
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target as Node)) {
        setItemSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-focus scan input when entering scan tab
  useEffect(() => {
    if (tab === "scan") {
      setScanPending(null);
      setTimeout(() => scanInputRef.current?.focus(), 80);
    }
  }, [tab]);

  // Global keydown: while scan tab is active, any printable keypress redirects to scan input
  useEffect(() => {
    if (tab !== "scan") return;
    const handler = (e: KeyboardEvent) => {
      if (e.target === scanInputRef.current) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.length === 1) scanInputRef.current?.focus();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [tab]);


  const { data: settings } = useGetSettings();
  const { data: customers } = useListCustomers({ ...(customerSearch ? { search: customerSearch } : {}) });
  const { data: items, isFetching: itemsFetching } = useListInventoryItems({ ...(itemSearch ? { search: itemSearch } : {}) });
  const { data: customerDetail } = useGetCustomer(
    selectedCustomer?.id ?? 0,
    { query: { enabled: !!(selectedCustomer?.id && selectedCustomer.id > 0), queryKey: [] as unknown[] } }
  );
  const createSale = useCreateSale();
  const createCustomer = useCreateCustomer();

  const goldRate22k = rates?.gold22k ?? 7250;
  const silverRate = rates?.silver ?? 95;

  const getLiveRate = (category: string, purity: string) => {
    if (category === "silver") return silverRate;
    if (category === "platinum") return 3500;
    if (purity === "24K") return rates?.gold24k ?? 7900;
    if (purity === "18K") return rates?.gold18k ?? 5940;
    if (purity === "14K") return Math.round((rates?.gold18k ?? 5940) * 14 / 18);
    return goldRate22k;
  };

  // Same rounding order as addToCart/the scan handler below — round making charges first,
  // then round the grand total — so the price shown before adding an item always matches
  // the price it's actually added to the cart at.
  const previewItemPrice = (item: { category: string; purity: string; netWeight: number; stoneWeight: number; makingCharges: number; stoneValue?: number | null }) => {
    const liveRate = getLiveRate(item.category, item.purity);
    const metalVal = Math.max(0, item.netWeight - item.stoneWeight) * liveRate;
    const makingAmt = Math.round(metalVal * item.makingCharges / 100);
    return Math.round(metalVal + makingAmt + (item.stoneValue ?? 0));
  };

  // Process scan results once the API returns data for the pending barcode query
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!scanPending || itemsFetching) return;
    const available = (items ?? []).filter(i => i.quantity > 0);
    const exactBarcode = available.find(i => i.barcode && i.barcode.toLowerCase() === scanPending.toLowerCase());
    const exactHuid = available.find(i => i.huid && i.huid.toLowerCase() === scanPending.toLowerCase());
    const target = exactBarcode ?? exactHuid ?? (available.length === 1 ? available[0] : null);
    setScanPending(null);
    setItemSearch("");
    if (target) {
      const liveRate = getLiveRate(target.category, target.purity);
      const pureMetalWeight = Math.max(0, target.netWeight - target.stoneWeight);
      const liveMetalVal = pureMetalWeight * liveRate;
      const liveMakingAmt = Math.round(liveMetalVal * target.makingCharges / 100);
      const livePrice = Math.round(liveMetalVal + liveMakingAmt + (target.stoneValue ?? 0));
      let blockedByStock = false;
      setCart(prev => {
        const existing = prev.find(c => c.inventoryItemId === target.id);
        if (existing) {
          if (existing.quantity >= existing.availableQty) { blockedByStock = true; return prev; }
          return prev.map(c => c.inventoryItemId === target.id ? { ...c, quantity: c.quantity + 1 } : c);
        }
        return [...prev, {
          inventoryItemId: target.id, itemName: target.name, huid: target.huid ?? null, quantity: 1,
          availableQty: target.quantity, unitPrice: livePrice, metalRate: liveRate,
          grossWeight: target.grossWeight, netWeight: target.netWeight,
          makingCharges: liveMakingAmt, stoneCharges: target.stoneValue ?? 0, discount: 0,
        }];
      });
      if (blockedByStock) {
        setLastScanned({ name: target.name, success: false });
        toast({ title: `Only ${target.quantity} of "${target.name}" in stock`, variant: "destructive", duration: 2000 });
      } else {
        setLastScanned({ name: target.name, success: true });
        setScanLog(prev => [{ name: target.name, price: livePrice, qty: 1 }, ...prev].slice(0, 10));
      }
    } else {
      setLastScanned({ name: scanPending, success: false });
      toast({ title: `"${scanPending}" not found or out of stock`, variant: "destructive", duration: 2000 });
    }
    setScanInput("");
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }, [scanPending, itemsFetching, items]); // getLiveRate intentionally omitted — stable within render

  const GST_RATE = 0.03;

  const GOLD_PURITIES = ["24K", "22K", "18K", "14K"];
  const SILVER_PURITIES = ["999", "925"];
  const quickGrossWeight = parseFloat(quickWeight || "0");
  const quickMetalRate = getLiveRate(quickMetal, quickPurity);
  const quickStoneWeightVal = parseFloat(quickStoneWeight || "0");
  const quickNetWeight = Math.max(0, quickGrossWeight - quickStoneWeightVal);
  const quickMetalValue = quickNetWeight * quickMetalRate;
  const quickMakingVal = Math.round(quickMetalValue * parseFloat(quickMakingPct || "0") / 100);
  const quickStoneChargesVal = parseFloat(quickStoneCharges || "0");
  const quickUnitPrice = Math.round(quickMetalValue + quickMakingVal + quickStoneChargesVal);

  const addQuickItemToCart = () => {
    if (!quickName || !quickWeight || parseFloat(quickWeight) <= 0) {
      toast({ title: "Enter item name and weight", variant: "destructive" }); return;
    }
    const qty = parseInt(quickQty || "1");
    const tempId = -(Date.now());
    setCart(prev => [...prev, {
      inventoryItemId: tempId,
      itemName: `${quickName} (${quickMetal === "gold" ? "Gold" : "Silver"} ${quickPurity}, ${parseFloat(quickWeight).toFixed(3)}g)`,
      huid: null,
      quantity: qty,
      availableQty: Infinity,
      unitPrice: quickUnitPrice,
      metalRate: quickMetalRate,
      grossWeight: quickGrossWeight,
      netWeight: quickNetWeight,
      makingCharges: quickMakingVal,
      stoneCharges: quickStoneChargesVal,
      discount: 0,
    }]);
    setQuickName(""); setQuickWeight(""); setQuickStoneWeight(""); setQuickMakingPct("10"); setQuickStoneCharges(""); setQuickQty("1"); setQuickMetal("gold"); setQuickPurity("22K");
    toast({ title: "Added to cart" });
  };

  const subTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0);
  const exchangeGoldValue = exchangeGoldWeight * goldRate22k;
  const taxableBase = Math.max(0, subTotal - discount - exchangeGoldValue);
  const gstAmount = taxableBase * GST_RATE;
  const totalAmount = taxableBase + gstAmount;

  const handleScanEnter = useCallback(() => {
    const q = scanInput.trim();
    if (!q) return;
    setItemSearch(q);
    setScanPending(q);
    setScanInput("");
  }, [scanInput]);

  const addToCart = (item: { id: number; name: string; category: string; purity: string; metalRate: number; grossWeight: number; netWeight: number; stoneWeight: number; makingCharges: number; stoneValue?: number | null; totalValue: number; quantity: number; huid?: string | null }) => {
    const liveRate = getLiveRate(item.category, item.purity);
    const pureMetalWeight = Math.max(0, item.netWeight - item.stoneWeight);
    const liveMetalVal = pureMetalWeight * liveRate;
    const liveMakingAmt = Math.round(liveMetalVal * item.makingCharges / 100);
    const livePrice = Math.round(liveMetalVal + liveMakingAmt + (item.stoneValue ?? 0));
    let blockedByStock = false;
    setCart(prev => {
      const existing = prev.find(c => c.inventoryItemId === item.id);
      if (existing) {
        if (existing.quantity >= existing.availableQty) { blockedByStock = true; return prev; }
        return prev.map(c => c.inventoryItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        inventoryItemId: item.id, itemName: item.name, huid: item.huid ?? null, quantity: 1,
        availableQty: item.quantity,
        unitPrice: livePrice, metalRate: liveRate,
        grossWeight: item.grossWeight, netWeight: item.netWeight,
        makingCharges: liveMakingAmt, stoneCharges: item.stoneValue ?? 0, discount: 0,
      }];
    });
    if (blockedByStock) toast({ title: `Only ${item.quantity} of "${item.name}" in stock`, variant: "destructive" });
    setItemSearch("");
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(c => c.inventoryItemId !== id));

  const shopInfo = {
    name: settings?.businessName ?? "SwarnDesk Jewellers",
    gstin: settings?.gstin ?? "",
    address: settings?.address ?? "",
    mobile: settings?.mobile ?? "",
  };

  const printBill = (isEstimate: boolean, snap?: SaleComplete) => {
    const s = snap ?? saleComplete;
    const cartItems = s?.cartSnapshot ?? cart;
    const invoiceNum = s?.invoiceNumber ?? `EST-${Date.now().toString().slice(-6)}`;
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const custName = s?.customerName ?? selectedCustomer?.name ?? "Walk-in Customer";
    const custMobile = s?.customerMobile ?? selectedCustomer?.mobile ?? "";
    const st = s?.subTotal ?? subTotal;
    const disc = s?.discountAmount ?? discount;
    const exchW = s?.exchangeGoldWeight ?? exchangeGoldWeight;
    const exchV = s?.exchangeGoldValue ?? exchangeGoldValue;
    const taxBase = s?.taxableBase ?? taxableBase;
    const gst = s?.gstAmount ?? gstAmount;
    const total = s?.total ?? totalAmount;
    const pMode = s?.paymentMode ?? paymentMode;

    openPrintWindow({
      isEstimate,
      invoiceNumber: invoiceNum,
      date,
      shop: shopInfo,
      customer: { name: custName, mobile: custMobile },
      items: cartItems,
      subTotal: st,
      discountAmount: disc,
      exchangeGoldWeight: exchW,
      exchangeGoldValue: exchV,
      taxableBase: taxBase,
      gstAmount: gst,
      totalAmount: total,
      paymentMode: pMode,
    });
  };

  const handleQuickAddCustomer = () => {
    if (!qaName || !qaMobile) { toast({ title: "Name and mobile are required", variant: "destructive" }); return; }
    createCustomer.mutate({ data: { name: qaName, mobile: qaMobile, email: qaEmail || null } }, {
      onSuccess: (newCust) => {
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setSelectedCustomer({ id: newCust.id, name: newCust.name, mobile: newCust.mobile });
        setQuickAddOpen(false);
        setQaName(""); setQaMobile(""); setQaEmail("");
        setCustomerSearch("");
        toast({ title: `${newCust.name} added and selected` });
      },
      onError: () => toast({ title: "Failed to add customer", variant: "destructive" }),
    });
  };

  // Validates the cart/payment inputs and, if everything checks out, opens the "Confirm Sale"
  // dialog instead of saving immediately — so a stray click can't finalize a sale by accident.
  const requestCompleteSale = () => {
    if (cart.length === 0) { toast({ title: "Add items to cart first", variant: "destructive" }); return; }

    // The server derives the actual paymentStatus from paidAmount alone (it ignores the
    // paymentStatus field). If "Partial" is selected but no amount was typed, defaulting to
    // the full total would silently record the sale as fully paid — contradicting what the
    // user picked and losing track of the balance owed. Require an explicit amount instead.
    if (paymentStatus === "partial") {
      const entered = parseFloat(paidNow);
      if (paidNow === "" || !isFinite(entered) || entered <= 0) {
        toast({ title: "Enter the amount paid now for a partial payment", variant: "destructive" });
        return;
      }
      if (entered >= totalAmount) {
        toast({ title: "This amount covers the full total or more — please select \"Paid\" instead of \"Partial\".", variant: "destructive" });
        return;
      }
    }

    setConfirmSaleOpen(true);
  };

  const completeSale = () => {
    let paidAmount: number;
    if (paymentStatus === "pending") {
      paidAmount = 0;
    } else if (paymentStatus === "partial") {
      paidAmount = parseFloat(paidNow);
    } else {
      paidAmount = paidNow !== "" ? parseFloat(paidNow) || 0 : totalAmount;
    }

    const cartSnap = [...cart];
    createSale.mutate({
      data: {
        customerId: selectedCustomer?.id && selectedCustomer.id > 0 ? selectedCustomer.id : null,
        customerName: selectedCustomer?.name ?? "Walk-in Customer",
        totalAmount, gstAmount, discountAmount: discount,
        exchangeGoldWeight, exchangeGoldValue, paymentMode, paymentStatus,
        paidAmount,
        notes: null,
        items: cart.map(c => ({
          inventoryItemId: c.inventoryItemId > 0 ? c.inventoryItemId : 0,
          itemName: c.itemName,
          quantity: c.quantity, unitPrice: c.unitPrice, metalRate: c.metalRate,
          goldWeight: c.grossWeight, makingCharges: c.makingCharges, discount: c.discount,
        })),
      }
    }, {
      onSuccess: (sale) => {
        setConfirmSaleOpen(false);
        setSaleComplete({
          invoiceNumber: sale.invoiceNumber,
          total: sale.totalAmount,
          customerName: selectedCustomer?.name ?? "",
          customerMobile: selectedCustomer?.mobile ?? "",
          cartSnapshot: cartSnap,
          subTotal, discountAmount: discount,
          exchangeGoldWeight, exchangeGoldValue,
          taxableBase, gstAmount, paymentMode, paymentStatus,
        });
        setCart([]);
        setSelectedCustomer(null);
        setDiscount(0);
        setExchangeGoldWeight(0);
        setPaidNow("");
        queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
        toast({ title: "Sale completed!", description: `Invoice: ${sale.invoiceNumber}` });
      },
      onError: () => {
        setConfirmSaleOpen(false);
        toast({ title: "Sale failed", variant: "destructive" });
      },
    });
  };

  const sendInvoiceWhatsApp = () => {
    if (!saleComplete?.customerMobile) return;
    const msg = `Dear ${saleComplete.customerName}, your invoice ${saleComplete.invoiceNumber} for ${formatCurrency(saleComplete.total)} has been generated. Thank you for shopping with ${shopInfo.name}!`;
    const digits = saleComplete.customerMobile.replace(/\D/g, "");
    const fullMobile = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${fullMobile}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // ── Sale Complete Screen ────────────────────────────────────────────────
  if (saleComplete) {
    return (
      <div className="max-w-lg mx-auto mt-8 md:mt-16 text-center space-y-6 px-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Sale Complete!</h2>
          <p className="text-muted-foreground mt-2">Invoice {saleComplete.invoiceNumber}</p>
          <p className="text-3xl font-bold text-primary mt-3">{formatCurrency(saleComplete.total)}</p>
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => printBill(false, saleComplete)}
            data-testid="button-print-bill"
          >
            <FileText className="w-4 h-4" />Print Bill
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50"
            onClick={() => printBill(true, saleComplete)}
            data-testid="button-print-estimate"
          >
            <ClipboardList className="w-4 h-4" />Estimate Copy
          </Button>
          {saleComplete.customerMobile && (
            <Button
              variant="outline"
              className="gap-2 text-green-600 border-green-500/40 hover:bg-green-50"
              onClick={sendInvoiceWhatsApp}
              data-testid="button-wa-invoice"
            >
              <MessageCircle className="w-4 h-4" />WhatsApp
            </Button>
          )}
          <Button onClick={() => setSaleComplete(null)} data-testid="button-new-bill">New Bill</Button>
        </div>
      </div>
    );
  }

  // ── Main Billing UI ─────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Billing & POS</h1>
        <p className="text-muted-foreground text-sm">{shopInfo.name}</p>
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="xl:col-span-2 space-y-4">

          {/* ── Customer section ── */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Customer</div>
                {!selectedCustomer && (
                  <button
                    onClick={() => setQuickAddOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    data-testid="button-quick-add-customer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    New Customer
                  </button>
                )}
              </div>

              {selectedCustomer ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div>
                      <div className="font-medium">{selectedCustomer.name}</div>
                      <div className="text-xs text-muted-foreground">{selectedCustomer.mobile}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCustomer.id > 0 && (
                        <button
                          onClick={() => setShowHistory(v => !v)}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                          data-testid="button-toggle-history"
                        >
                          <History className="w-3.5 h-3.5" />
                          History
                          {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                      <button onClick={() => { setSelectedCustomer(null); setShowHistory(false); }} className="text-muted-foreground hover:text-foreground text-xs">Change</button>
                    </div>
                  </div>

                  {/* Inline purchase history */}
                  {showHistory && selectedCustomer.id > 0 && (
                    <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border bg-muted/20">
                        Past Purchases
                      </div>
                      {!customerDetail ? (
                        <div className="px-3 py-3 text-xs text-muted-foreground">Loading...</div>
                      ) : customerDetail.recentSales.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-muted-foreground text-center">No past purchases</div>
                      ) : (
                        <div className="divide-y divide-border">
                          {customerDetail.recentSales.slice(0, 5).map(sale => (
                            <div key={sale.id} className="flex items-center justify-between px-3 py-2 text-xs">
                              <div>
                                <span className="font-mono text-muted-foreground">{sale.invoiceNumber}</span>
                                <span className="text-muted-foreground ml-2">
                                  {new Date(sale.saleDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-primary">{formatCurrency(sale.totalAmount)}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-4 ${sale.paymentStatus === "paid" ? "text-green-700 border-green-200" : "text-orange-700 border-orange-200"}`}
                                >
                                  {sale.paymentStatus.charAt(0).toUpperCase() + sale.paymentStatus.slice(1)}
                                </Badge>
                              </div>
                            </div>
                          ))}
                          {customerDetail.recentSales.length > 0 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground flex justify-between border-t border-border bg-muted/10">
                              <span>Total spent</span>
                              <span className="font-semibold text-foreground">{formatCurrency(customerDetail.customer.totalPurchases)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative" ref={customerDropdownRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or mobile, or leave blank for walk-in..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-customer-search"
                  />
                  {customerSearch && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                      <div
                        className="px-3 py-2 text-xs text-muted-foreground border-b border-border cursor-pointer hover:bg-muted/20"
                        onClick={() => { setSelectedCustomer({ id: 0, name: "Walk-in Customer", mobile: "" }); setCustomerSearch(""); }}
                      >
                        Walk-in Customer
                      </div>
                      {(customers ?? []).slice(0, 6).map(c => (
                        <div
                          key={c.id}
                          className="px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/20 flex justify-between gap-2"
                          onClick={() => { setSelectedCustomer({ id: c.id, name: c.name, mobile: c.mobile }); setCustomerSearch(""); }}
                          data-testid={`option-customer-${c.id}`}
                        >
                          <span className="font-medium truncate">{c.name}</span>
                          <span className="text-muted-foreground text-xs shrink-0">{c.mobile}</span>
                        </div>
                      ))}
                      {/* Add new customer shortcut at bottom of dropdown */}
                      <div
                        className="px-3 py-2.5 border-t border-border cursor-pointer hover:bg-primary/5 flex items-center gap-2 text-primary"
                        onClick={() => { setQaName(customerSearch); setQuickAddOpen(true); }}
                        data-testid="option-add-new-customer"
                      >
                        <UserPlus className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-xs font-medium">Add "{customerSearch}" as new customer</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Item entry section ── */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit flex-wrap">
                <button
                  onClick={() => setTab("stock")}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${tab === "stock" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid="tab-stock-items"
                >
                  From Stock
                </button>
                <button
                  onClick={() => setTab("scan")}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all ${tab === "scan" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid="tab-scan"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  Barcode Scan
                  {tab === "scan" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                </button>
                <button
                  onClick={() => setTab("quick")}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${tab === "quick" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid="tab-quick-entry"
                >
                  Quick Entry (By Weight)
                </button>
              </div>

              {tab === "scan" ? (
                <>
                  {/* Scan mode — ready to receive barcode scanner input */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          Ready to Scan
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Point scanner at any barcode or HUID tag. Press Enter to confirm.</p>
                      </div>
                      {scanLog.length > 0 && (
                        <button onClick={() => setScanLog([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                          Clear log
                        </button>
                      )}
                    </div>

                    {/* Scan input */}
                    <div className="relative">
                      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                      <input
                        ref={scanInputRef}
                        value={scanInput}
                        onChange={e => setScanInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleScanEnter(); } }}
                        placeholder="Scan barcode here — scanner sends Enter automatically"
                        className="w-full pl-10 pr-4 py-3 text-sm bg-background border-2 border-primary/30 focus:border-primary rounded-xl outline-none transition-colors placeholder:text-muted-foreground/50 font-mono tracking-wide"
                        autoComplete="off"
                        data-testid="input-barcode-scan"
                      />
                      {scanPending && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Looking up...
                        </div>
                      )}
                    </div>

                    {/* Last scan result feedback */}
                    {lastScanned && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        lastScanned.success
                          ? "bg-green-50 border border-green-200 text-green-800"
                          : "bg-red-50 border border-red-200 text-red-800"
                      }`}>
                        {lastScanned.success
                          ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        <span className="font-medium truncate">{lastScanned.name}</span>
                        <span className="text-xs ml-auto shrink-0">{lastScanned.success ? "added to cart" : "not found"}</span>
                      </div>
                    )}

                    {/* Scan log for this session */}
                    {scanLog.length > 0 && (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border bg-muted/20 flex items-center gap-1.5">
                          <Zap className="w-3 h-3" />
                          Scan Log ({scanLog.length})
                        </div>
                        <div className="divide-y divide-border/50">
                          {scanLog.map((entry, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                              <span className="font-medium truncate">{entry.name}</span>
                              <span className="text-primary font-semibold shrink-0 ml-2">{formatCurrency(entry.price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground mb-1.5">How to use the barcode scanner:</div>
                      <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">1.</span> Click the "Barcode Scan" tab — the input activates automatically.</div>
                      <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">2.</span> Point your USB/Bluetooth scanner at the barcode or HUID sticker on the jewellery.</div>
                      <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">3.</span> The scanner beeps and the item is added to cart instantly.</div>
                      <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">4.</span> Scan multiple items one by one — each appears in the cart and the log above.</div>
                    </div>
                  </div>
                </>
              ) : tab === "stock" ? (
                <>
                  <div className="text-sm font-medium">Add from Inventory</div>
                  <div className="relative" ref={itemDropdownRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search item by name, HUID or barcode..."
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const available = (items ?? []).filter(i => i.quantity > 0);
                          if (available.length === 1) {
                            addToCart(available[0]);
                            toast({ title: `"${available[0].name}" added via scan` });
                          }
                        }
                      }}
                      className="pl-9"
                      data-testid="input-item-search"
                    />
                    {itemSearch && (items ?? []).length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                        {(items ?? []).filter(i => i.quantity > 0).slice(0, 8).map(item => (
                          <div
                            key={item.id}
                            className="px-3 py-2.5 cursor-pointer hover:bg-muted/20 flex justify-between items-center border-b border-border/50 last:border-0 gap-3"
                            onClick={() => addToCart(item)}
                            data-testid={`option-item-${item.id}`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.category} · {item.purity} · {item.grossWeight}g</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-semibold text-primary">{formatCurrency(previewItemPrice(item))}</div>
                              <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium">Quick Entry by Weight</div>
                  <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs -mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>For items not in stock. This will <strong>NOT</strong> deduct from inventory.</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="col-span-2 sm:col-span-3">
                      <label className="text-xs text-muted-foreground mb-1 block">Item Name *</label>
                      <Input placeholder="e.g. Gold Bangle, Old Necklace" value={quickName} onChange={e => setQuickName(e.target.value)} data-testid="input-quick-name" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Metal *</label>
                      <Select
                        value={quickMetal}
                        onValueChange={(v: "gold" | "silver") => {
                          setQuickMetal(v);
                          setQuickPurity(v === "silver" ? "925" : "22K");
                        }}
                      >
                        <SelectTrigger data-testid="select-quick-metal"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gold">Gold</SelectItem>
                          <SelectItem value="silver">Silver</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Purity</label>
                      <Select value={quickPurity} onValueChange={setQuickPurity}>
                        <SelectTrigger data-testid="select-quick-purity"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(quickMetal === "gold" ? GOLD_PURITIES : SILVER_PURITIES).map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Weight (g) *</label>
                      <Input type="number" step="0.001" placeholder="e.g. 10.500" value={quickWeight} onChange={e => setQuickWeight(e.target.value)} data-testid="input-quick-weight" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Stone Weight (g)</label>
                      <Input type="number" step="0.001" placeholder="e.g. 0.500 (optional)" value={quickStoneWeight} onChange={e => setQuickStoneWeight(e.target.value)} data-testid="input-quick-stone-weight" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                      <Input type="number" min="1" value={quickQty} onChange={e => setQuickQty(e.target.value)} data-testid="input-quick-qty" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Making (%)</label>
                      <Input type="number" step="0.1" placeholder="e.g. 10" value={quickMakingPct} onChange={e => setQuickMakingPct(e.target.value)} data-testid="input-quick-making" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Stone/Other (₹)</label>
                      <Input type="number" placeholder="e.g. 500" value={quickStoneCharges} onChange={e => setQuickStoneCharges(e.target.value)} data-testid="input-quick-stone" />
                    </div>
                    {parseFloat(quickWeight || "0") > 0 && (
                      <div className="col-span-2 sm:col-span-3">
                        <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs flex gap-4 flex-wrap">
                          <div>
                            <div className="text-muted-foreground">Rate ({quickMetal === "gold" ? "Gold" : "Silver"} {quickPurity})</div>
                            <div className="font-semibold text-primary">
                              {quickMetal === "gold"
                                ? `₹${Math.round(quickMetalRate * 10).toLocaleString("en-IN")}/10g`
                                : `₹${Math.round(quickMetalRate * 1000).toLocaleString("en-IN")}/kg`}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Net wt. ({quickNetWeight.toFixed(3)}g)</div>
                            <div className="font-semibold text-primary">{formatCurrency(quickMetalValue)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Making ({quickMakingPct}%)</div>
                            <div className="font-semibold text-primary">{formatCurrency(quickMakingVal)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Unit price</div>
                            <div className="font-bold text-primary text-sm">{formatCurrency(quickUnitPrice)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={addQuickItemToCart}
                    className="gap-2 w-full sm:w-auto"
                    data-testid="button-add-quick-item"
                    disabled={!quickName || !quickWeight || parseFloat(quickWeight || "0") <= 0}
                  >
                    <Plus className="w-4 h-4" />
                    Add to Cart ({quickUnitPrice > 0 ? formatCurrency(quickUnitPrice) : "₹0"})
                  </Button>
                </>
              )}

              <div className="flex gap-2 flex-wrap text-xs">
                <button
                  type="button"
                  onClick={openRateEdit}
                  title="Click to update today's gold rate"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 hover:border-amber-400 rounded-lg hover:bg-amber-100 transition-colors group cursor-pointer"
                  data-testid="button-edit-gold-rate"
                >
                  <span className="text-amber-700 group-hover:underline">22K Gold</span>
                  <span className="font-semibold text-amber-800">₹{Math.round(goldRate22k * 10).toLocaleString("en-IN")}/10g</span>
                  <Pencil className="w-3 h-3 text-amber-400 group-hover:text-amber-600 transition-colors" />
                </button>
                <button
                  type="button"
                  onClick={openRateEdit}
                  title="Click to update today's silver rate"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border hover:border-foreground/30 rounded-lg hover:bg-muted/80 transition-colors group cursor-pointer"
                  data-testid="button-edit-silver-rate"
                >
                  <span className="text-muted-foreground group-hover:underline">Silver</span>
                  <span className="font-semibold">₹{Math.round(silverRate * 1000).toLocaleString("en-IN")}/kg</span>
                  <Pencil className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* ── Cart ── */}
          {cart.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Cart ({cart.length} item{cart.length > 1 ? "s" : ""})</CardTitle>
                  <button
                    onClick={() => printBill(true)}
                    className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-600 transition-colors"
                    title="Prints a non-binding price quote, not a final invoice."
                    data-testid="button-print-estimate-cart"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />Estimate
                  </button>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Item</th>
                      <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Gross Wt</th>
                      <th className="px-4 py-2 text-right font-medium hidden md:table-cell">Net Wt</th>
                      <th className="px-4 py-2 text-right font-medium hidden md:table-cell">Making</th>
                      <th className="px-4 py-2 text-right font-medium hidden lg:table-cell">Stone</th>
                      <th className="px-4 py-2 text-center font-medium">Qty</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                      <th className="px-4 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.inventoryItemId} className="border-b border-border/50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium max-w-[150px] truncate">{item.itemName}</div>
                          {item.inventoryItemId < 0 && <Badge variant="outline" className="text-[9px] h-4 mt-0.5">Custom</Badge>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground hidden sm:table-cell">{item.grossWeight.toFixed(3)}g</td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground hidden md:table-cell">{item.netWeight.toFixed(3)}g</td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground hidden md:table-cell">{formatCurrency(item.makingCharges)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground hidden lg:table-cell">{item.stoneCharges > 0 ? formatCurrency(item.stoneCharges) : "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setCart(prev => prev.map(c => c.inventoryItemId === item.inventoryItemId ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))} className="w-5 h-5 rounded bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">-</button>
                            <span className="w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => {
                                if (item.quantity >= item.availableQty) {
                                  toast({ title: `Only ${item.availableQty} in stock`, variant: "destructive" });
                                  return;
                                }
                                setCart(prev => prev.map(c => c.inventoryItemId === item.inventoryItemId ? { ...c, quantity: c.quantity + 1 } : c));
                              }}
                              className="w-5 h-5 rounded bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40"
                              disabled={item.quantity >= item.availableQty}
                            >+</button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => removeFromCart(item.inventoryItemId)} className="text-muted-foreground hover:text-destructive transition-colors">
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

        {/* Right: Order Summary */}
        <div className="space-y-4">
          <Card className="border-border xl:sticky xl:top-4">
            <CardContent className="p-4 space-y-4">
              <div className="text-sm font-semibold">Order Summary</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sub Total</span>
                  <span>{formatCurrency(subTotal)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Discount (₹)</span>
                  <input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right bg-background border border-border rounded px-2 py-1 text-sm focus:border-primary outline-none" data-testid="input-discount" />
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Exchange Gold (g)</span>
                  <input type="number" step="0.001" value={exchangeGoldWeight} onChange={e => setExchangeGoldWeight(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right bg-background border border-border rounded px-2 py-1 text-sm focus:border-primary outline-none" data-testid="input-exchange-gold" />
                </div>
                {exchangeGoldWeight > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Exchange Value</span><span>-{formatCurrency(exchangeGoldValue)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxable Base</span><span>{formatCurrency(taxableBase)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>CGST 1.5%</span><span>{formatCurrency(gstAmount / 2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>SGST 1.5%</span><span>{formatCurrency(gstAmount / 2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Payment Mode</label>
                  <Select value={paymentMode} onValueChange={v => { setPaymentMode(v); if (v === "partial") { setPaidNow(""); } }}>
                    <SelectTrigger data-testid="select-payment-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["cash", "upi", "card", "credit", "partial"].map(m => (
                        <SelectItem key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(paymentMode === "partial" || paymentStatus === "partial" || paymentStatus === "pending") && (
                  <div className="space-y-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <div>
                      <label className="text-xs font-medium text-orange-800 mb-1 block">Amount Paid Now (₹)</label>
                      <input
                        type="number"
                        min="0"
                        max={totalAmount}
                        step="1"
                        value={paidNow}
                        onChange={e => setPaidNow(e.target.value)}
                        placeholder={`e.g. ${Math.round(totalAmount / 2)}`}
                        className="w-full text-right bg-white border border-orange-300 rounded px-2 py-1.5 text-sm focus:border-orange-500 outline-none"
                        data-testid="input-paid-now"
                      />
                    </div>
                    {paidNow !== "" && parseFloat(paidNow) < totalAmount && (
                      <div className="flex justify-between text-xs font-semibold text-orange-800">
                        <span>Balance Due</span>
                        <span>{formatCurrency(Math.max(0, totalAmount - (parseFloat(paidNow) || 0)))}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-orange-600">Remaining balance will go to Pending Payments (see Pending Payments in the sidebar).</p>
                  </div>
                )}

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Payment Status</label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger data-testid="select-payment-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="pending">Pending (₹0 now)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">Payment Status decides what gets saved (Payment Mode is just how they paid).</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => printBill(true)}
                  disabled={cart.length === 0}
                  title="Prints a non-binding price quote, not a final invoice."
                  data-testid="button-print-estimate-summary"
                >
                  <ClipboardList className="w-4 h-4" />Print Estimate
                </Button>
                <Button
                  className="flex-1"
                  onClick={requestCompleteSale}
                  disabled={createSale.isPending || cart.length === 0}
                  data-testid="button-complete-sale"
                >
                  {createSale.isPending ? "Processing..." : cart.length === 0 ? "Add items to cart" : `Complete Sale (${formatCurrency(totalAmount)})`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirm Sale Dialog */}
      <Dialog open={confirmSaleOpen} onOpenChange={setConfirmSaleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Confirm Sale
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{selectedCustomer?.name ?? "Walk-in Customer"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{cart.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Status</span>
              <span className="font-medium capitalize">{paymentStatus}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-bold text-base">
              <span>Total Amount</span>
              <span className="text-primary">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSaleOpen(false)} disabled={createSale.isPending}>Cancel</Button>
            <Button onClick={completeSale} disabled={createSale.isPending} data-testid="button-confirm-sale">
              {createSale.isPending ? "Processing..." : "Confirm & Complete Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Edit Dialog */}
      <Dialog open={rateEditOpen} onOpenChange={setRateEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-600" />
              Update Today's Metal Rates
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Gold rate <strong>per 10 grams</strong>, Silver rate <strong>per kg</strong>. Enter any one gold rate and the others auto-fill — edit a field to override it.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Gold 22K (₹/10g)</label>
                <Input
                  type="number"
                  step="1"
                  value={rateForm.gold22k}
                  onChange={e => setGoldRate("gold22k", e.target.value)}
                  placeholder="e.g. 72500"
                  data-testid="input-billing-rate-gold22k"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Gold 24K (₹/10g)</label>
                <Input
                  type="number"
                  step="1"
                  value={rateForm.gold24k}
                  onChange={e => setGoldRate("gold24k", e.target.value)}
                  placeholder="e.g. 79500"
                  data-testid="input-billing-rate-gold24k"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Gold 18K (₹/10g)</label>
                <Input
                  type="number"
                  step="1"
                  value={rateForm.gold18k}
                  onChange={e => setGoldRate("gold18k", e.target.value)}
                  placeholder="e.g. 59400"
                  data-testid="input-billing-rate-gold18k"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Silver (₹/kg)</label>
                <Input
                  type="number"
                  step="1"
                  value={rateForm.silver}
                  onChange={e => setSilver(e.target.value)}
                  placeholder="e.g. 95000"
                  data-testid="input-billing-rate-silver"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateEditOpen(false)}>Cancel</Button>
            <Button onClick={saveRateEdit} disabled={updateRates.isPending}>
              {updateRates.isPending ? "Saving..." : "Update Rates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Customer Dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add New Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
              <Input
                placeholder="e.g. Ramesh Sharma"
                value={qaName}
                onChange={e => setQaName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleQuickAddCustomer()}
                data-testid="input-qa-name"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mobile *</label>
              <Input
                placeholder="e.g. 98765 43210"
                value={qaMobile}
                onChange={e => setQaMobile(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleQuickAddCustomer()}
                data-testid="input-qa-mobile"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email (optional)</label>
              <Input
                placeholder="email@example.com"
                value={qaEmail}
                onChange={e => setQaEmail(e.target.value)}
                data-testid="input-qa-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddOpen(false)}>Cancel</Button>
            <Button
              onClick={handleQuickAddCustomer}
              disabled={createCustomer.isPending}
              data-testid="button-qa-submit"
            >
              {createCustomer.isPending ? "Adding..." : "Add & Select"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
