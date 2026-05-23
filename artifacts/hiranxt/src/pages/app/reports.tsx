import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  useGetDailySalesStats, useGetSalesByCategory, useGetInventoryStatsByCategory, useGetDashboardSummary
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { TrendingUp, Package, ShoppingCart, DollarSign, Download, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["#f4c542", "#e94560", "#4fc3f7", "#81c784", "#ce93d8"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const HSN_CODE = "7113";
const GST_RATE = 0.03;

async function downloadGSTR1(month: number, year: number, toast: ReturnType<typeof useToast>["toast"]) {
  try {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
    const res = await fetch(`/api/sales?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
    const sales: Array<{
      invoiceNumber: string;
      saleDate: string;
      customerName: string;
      totalAmount: number;
      gstAmount: number;
      paymentMode: string;
      paymentStatus: string;
    }> = await res.json();

    if (sales.length === 0) {
      toast({ title: "No sales found for selected period", variant: "destructive" });
      return;
    }

    const rows = [
      ["GSTR-1 Export — B2C Sales"],
      [`Period: ${MONTHS[month - 1]} ${year}`],
      [`Generated: ${new Date().toLocaleDateString("en-IN")}`],
      [],
      [
        "Invoice No.", "Invoice Date", "Customer Name",
        "HSN Code", "Taxable Value (₹)", "CGST 1.5% (₹)", "SGST 1.5% (₹)",
        "Total GST (₹)", "Invoice Value (₹)", "Payment Mode", "Payment Status"
      ],
      ...sales.map(s => {
        const taxable = s.totalAmount / (1 + GST_RATE);
        const cgst = taxable * (GST_RATE / 2);
        const sgst = taxable * (GST_RATE / 2);
        const totalGst = cgst + sgst;
        return [
          s.invoiceNumber,
          new Date(s.saleDate).toLocaleDateString("en-IN"),
          s.customerName,
          HSN_CODE,
          taxable.toFixed(2),
          cgst.toFixed(2),
          sgst.toFixed(2),
          totalGst.toFixed(2),
          s.totalAmount.toFixed(2),
          s.paymentMode,
          s.paymentStatus,
        ];
      }),
      [],
      ["SUMMARY"],
      ["Total Invoices", sales.length.toString()],
      ["Total Taxable Value", (sales.reduce((a, s) => a + s.totalAmount / (1 + GST_RATE), 0)).toFixed(2)],
      ["Total CGST (1.5%)", (sales.reduce((a, s) => a + (s.totalAmount / (1 + GST_RATE)) * (GST_RATE / 2), 0)).toFixed(2)],
      ["Total SGST (1.5%)", (sales.reduce((a, s) => a + (s.totalAmount / (1 + GST_RATE)) * (GST_RATE / 2), 0)).toFixed(2)],
      ["Total Invoice Value", sales.reduce((a, s) => a + s.totalAmount, 0).toFixed(2)],
    ];

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1_${MONTHS[month - 1]}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `GSTR-1 exported — ${sales.length} invoices for ${MONTHS[month - 1]} ${year}` });
  } catch {
    toast({ title: "Failed to export GSTR-1", variant: "destructive" });
  }
}

export default function Reports() {
  const { toast } = useToast();
  const { data: dailyStats } = useGetDailySalesStats();
  const { data: salesByCategory } = useGetSalesByCategory();
  const { data: inventoryByCategory } = useGetInventoryStatsByCategory();
  const { data: summary } = useGetDashboardSummary();

  const now = new Date();
  const [gstrMonth, setGstrMonth] = useState(String(now.getMonth() + 1));
  const [gstrYear, setGstrYear] = useState(String(now.getFullYear()));
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    await downloadGSTR1(parseInt(gstrMonth), parseInt(gstrYear), toast);
    setExporting(false);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm">Business performance insights</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Total Inventory Value", value: formatCurrency(summary?.totalInventoryValue ?? 0), icon: Package, color: "text-purple-400" },
          { label: "Total Customers", value: (summary?.totalCustomers ?? 0).toLocaleString("en-IN"), icon: ShoppingCart, color: "text-blue-400" },
          { label: "Today's Revenue", value: formatCurrency(summary?.todaySales ?? 0), icon: TrendingUp, color: "text-primary" },
          { label: "Today's Profit", value: formatCurrency(summary?.todayProfit ?? 0), icon: DollarSign, color: "text-green-400" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border">
            <CardContent className="p-3 md:p-4 flex items-center gap-3">
              <kpi.icon className={`w-7 h-7 md:w-8 md:h-8 ${kpi.color} flex-shrink-0`} />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground leading-tight">{kpi.label}</div>
                <div className="text-base md:text-lg font-bold">{kpi.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily sales trend */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Daily Sales (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyStats ?? []}>
              <defs>
                <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f4c542" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f4c542" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profitArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#81c784" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#81c784" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#888" }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#888" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} width={38} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [formatCurrency(v), name.charAt(0).toUpperCase() + name.slice(1)]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="sales" stroke="#f4c542" strokeWidth={2} fill="url(#salesArea)" name="Sales" />
              <Area type="monotone" dataKey="profit" stroke="#81c784" strokeWidth={2} fill="url(#profitArea)" name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
        {/* Sales by category */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesByCategory ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#888" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} width={38} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {(salesByCategory ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Inventory by category */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Inventory Stock Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={inventoryByCategory ?? []}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  nameKey="category"
                  label={({ category, percent }) => `${category} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {(inventoryByCategory ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatCurrency(v), "Value"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {(inventoryByCategory ?? []).map((s, i) => (
                <div key={s.category} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="capitalize">{s.category}</span>
                  <span className="text-muted-foreground ml-auto">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GST Summary — fix: single col on mobile */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">GST Summary (Today's Estimate)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-sm mb-4">
            {[
              { label: "Taxable Value (Sales)", value: formatCurrency((summary?.todaySales ?? 0) / 1.03) },
              { label: "CGST (1.5%)", value: formatCurrency(((summary?.todaySales ?? 0) / 1.03) * 0.015) },
              { label: "SGST (1.5%)", value: formatCurrency(((summary?.todaySales ?? 0) / 1.03) * 0.015) },
            ].map(item => (
              <div key={item.label} className="p-4 rounded-xl bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                <div className="text-xl font-bold text-primary">{item.value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">* Estimated figures for today. Use GSTR-1 export below for complete period data.</p>
        </CardContent>
      </Card>

      {/* GSTR-1 Export */}
      <Card className="border-border bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            GSTR-1 Export
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">GST Filing Ready</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Export B2C sales data in GSTR-1 format (HSN: 7113, Jewellery). Includes invoice number, date, customer, taxable value, CGST (1.5%), SGST (1.5%), and totals. Upload directly to the GST portal.
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Month</label>
              <Select value={gstrMonth} onValueChange={setGstrMonth}>
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Year</label>
              <Select value={gstrYear} onValueChange={setGstrYear}>
                <SelectTrigger className="w-28 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExport} disabled={exporting} className="gap-2 h-9">
              <Download className="w-4 h-4" />
              {exporting ? "Generating..." : `Export ${MONTHS[parseInt(gstrMonth) - 1]} ${gstrYear}`}
            </Button>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "HSN Code", val: "7113 (Jewellery)" },
              { label: "GST Rate", val: "3% (CGST 1.5% + SGST 1.5%)" },
              { label: "Format", val: "CSV (GST portal compatible)" },
              { label: "BOM", val: "UTF-8 with BOM for Excel" },
            ].map(({ label, val }) => (
              <div key={label}>
                <div className="text-muted-foreground mb-0.5">{label}</div>
                <div className="font-medium text-foreground">{val}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
