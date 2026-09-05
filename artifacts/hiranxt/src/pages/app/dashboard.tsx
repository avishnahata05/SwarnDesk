import { useState } from "react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import {
  useGetDashboardSummary, useGetRecentSales, useGetLowStockItems,
  useGetDailySalesStats, useGetSalesByCategory,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, Package, Users, Wrench, AlertTriangle, Plus,
  ShoppingCart, IndianRupee, ArrowUpRight,
  Banknote, UserPlus,
} from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PageHelpButton, PageHelpDialog } from "@/components/PageHelp";
import { InfoTooltip } from "@/components/InfoTooltip";

const PIE_COLORS = ["#16a34a", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444"];
const CHART_GREEN = "#16a34a";

const statCards = [
  {
    label: "Today's Sales",
    hint: "Total revenue today",
    key: "todaySales" as const,
    format: "currency",
    icon: IndianRupee,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    accent: "text-emerald-600",
  },
  {
    label: "Today's Profit",
    hint: "Making charges earned today (profit estimate)",
    key: "todayProfit" as const,
    format: "currency",
    icon: TrendingUp,
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    accent: "text-green-600",
  },
  {
    label: "Inventory Value",
    hint: "Total stock worth",
    key: "totalInventoryValue" as const,
    format: "currency",
    icon: Package,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    accent: "text-amber-600",
  },
  {
    label: "Total Customers",
    hint: "Registered customers",
    key: "totalCustomers" as const,
    format: "number",
    icon: Users,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    accent: "text-blue-600",
  },
  {
    label: "Stock Items",
    hint: "Items in inventory",
    key: "totalInventoryItems" as const,
    format: "number",
    icon: ShoppingCart,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    accent: "text-violet-600",
  },
  {
    label: "Active Repairs",
    hint: "Repair jobs not yet delivered",
    key: "pendingRepairs" as const,
    format: "number",
    icon: Wrench,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    accent: "text-red-500",
  },
];

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: recentSales } = useGetRecentSales();
  const { data: lowStock } = useGetLowStockItems();
  const { data: dailyStats } = useGetDailySalesStats();
  const { data: categoryStats } = useGetSalesByCategory();

  const [pageHelpOpen, setPageHelpOpen] = useState(false);

  function getStatValue(card: typeof statCards[0]): string {
    if (summaryLoading) return "—";
    const raw = summary?.[card.key] ?? 0;
    if (card.format === "currency") return formatCurrency(raw as number);
    return (raw as number).toLocaleString("en-IN");
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <div className="mt-1"><PageHelpButton onClick={() => setPageHelpOpen(true)} /></div>
        </div>
        <div className="flex gap-2 flex-wrap" data-tour="quick-actions">
          <Link href="/app/billing">
            <Button size="sm" className="gap-1.5 shadow-sm" data-testid="button-new-sale">
              <Plus className="w-4 h-4" />
              New Sale
            </Button>
          </Link>
          <Link href="/app/girvi?new=1">
            <Button size="sm" variant="outline" className="gap-1.5 shadow-xs" data-testid="button-new-girvi-loan">
              <Banknote className="w-4 h-4" />
              <span className="hidden sm:inline">New Girvi Loan</span>
              <span className="sm:hidden">Girvi</span>
            </Button>
          </Link>
          <Link href="/app/customers?new=1">
            <Button size="sm" variant="outline" className="gap-1.5 shadow-xs" data-testid="button-new-customer">
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">New Customer</span>
              <span className="sm:hidden">Customer</span>
            </Button>
          </Link>
          <Link href="/app/inventory">
            <Button size="sm" variant="outline" className="gap-1.5 shadow-xs" data-testid="button-add-item">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Add Item</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4" data-tour="stat-cards">
        {statCards.map((card) => (
          <Card
            key={card.label}
            className="border-card-border shadow-xs hover:shadow-sm transition-shadow"
            data-testid={`card-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <CardContent className="p-4 md:p-5">
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center mb-3 flex-shrink-0`}>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <div className={`text-lg md:text-xl font-bold leading-tight tracking-tight ${summaryLoading ? "animate-pulse text-muted-foreground" : ""}`}>
                {getStatValue(card)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-medium leading-tight flex items-center gap-1">
                {card.label}
                <InfoTooltip text={card.hint} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4 md:gap-5">
        {/* Sales trend */}
        <Card className="lg:col-span-2 border-card-border shadow-xs">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <div>
              <CardTitle className="text-[15px] font-semibold">Sales Trend</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              Live
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyStats ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9ca3af", fontFamily: "Plus Jakarta Sans" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af", fontFamily: "Plus Jakarta Sans" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 12,
                    fontFamily: "Plus Jakarta Sans",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                  formatter={(v: number) => [formatCurrency(v), "Sales"]}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke={CHART_GREEN}
                  strokeWidth={2.5}
                  fill="url(#salesGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: CHART_GREEN, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category pie */}
        <Card className="border-card-border shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold">Sales by Category</CardTitle>
            <p className="text-xs text-muted-foreground">Revenue breakdown</p>
          </CardHeader>
          <CardContent className="pt-0">
            {!categoryStats || categoryStats.length === 0 ? (
              <div className="h-[180px] flex flex-col items-center justify-center gap-2">
                <Package className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground text-center">No sales data yet.<br />Start billing to see categories.</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      dataKey="value"
                      nameKey="category"
                      paddingAngle={2}
                    >
                      {categoryStats.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        fontSize: 12,
                        fontFamily: "Plus Jakarta Sans",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-1">
                  {categoryStats.slice(0, 4).map((s, i) => (
                    <div key={s.category} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="capitalize truncate text-foreground">{s.category}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-muted-foreground">{s.count} sold</span>
                        <span className="font-medium text-foreground">{formatCurrency(s.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts + Recent sales */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
        {/* Low stock alerts */}
        <Card className="border-card-border shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                </div>
                Low Stock Alerts
              </CardTitle>
              <Link href="/app/inventory" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                View All <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!lowStock || lowStock.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <Package className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Stock levels are healthy.<br />No alerts right now.
                </p>
              </div>
            ) : (
              lowStock.slice(0, 5).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-red-50/60 border border-red-100 gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.category} · {item.purity}</div>
                  </div>
                  <Badge variant="destructive" className="shrink-0 text-[11px]" data-testid={`badge-stock-${item.id}`}>
                    Qty: {item.quantity}{typeof item.lowStockThreshold === "number" ? ` (below reorder level of ${item.lowStockThreshold})` : ""}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent sales */}
        <Card className="border-card-border shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                Recent Sales
              </CardTitle>
              <Link href="/app/billing" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                New Bill <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!recentSales || recentSales.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-sm text-muted-foreground text-center">No sales yet today.</p>
                <Link href="/app/billing">
                  <Button size="sm" variant="outline" className="mt-1 gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" />
                    Create First Bill
                  </Button>
                </Link>
              </div>
            ) : (
              recentSales.slice(0, 5).map(sale => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/40 transition-colors gap-3"
                  data-testid={`row-sale-${sale.id}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{sale.customerName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{sale.invoiceNumber} · {sale.paymentMode}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-emerald-600">{formatCurrency(sale.totalAmount)}</div>
                    <Badge
                      variant={sale.paymentStatus === "paid" ? "default" : "secondary"}
                      className="text-[10px] mt-0.5"
                    >
                      {sale.paymentStatus.charAt(0).toUpperCase() + sale.paymentStatus.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <PageHelpDialog
        open={pageHelpOpen}
        onClose={() => setPageHelpOpen(false)}
        title="Dashboard"
        description="Your shop's home screen — a live snapshot of today's business plus quick shortcuts to the things you do most."
        sections={[
          {
            heading: "What you can do here",
            items: [
              "New Sale / New Girvi Loan / New Customer / Add Item — jump straight into the most common actions",
              "Sales Trend — revenue over the last 30 days",
              "Ask the AI assistant (bottom-right chat button) — quick questions about stock, sales, or profit",
            ],
          },
          {
            heading: "What the numbers mean",
            items: [
              "Today's Profit — an estimate based on making charges earned today, not a full accounting P&L",
              "Inventory Value — total worth of everything currently in stock",
              "Active Repairs — repair jobs that haven't been delivered back to the customer yet",
            ],
          },
        ]}
      />
    </div>
  );
}
