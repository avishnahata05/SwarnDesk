import { formatCurrency } from "@/lib/utils";
import {
  useGetDailySalesStats, useGetSalesByCategory, useGetInventoryStatsByCategory, useGetDashboardSummary
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { TrendingUp, Package, ShoppingCart, DollarSign } from "lucide-react";

const COLORS = ["#f4c542", "#e94560", "#4fc3f7", "#81c784", "#ce93d8"];

export default function Reports() {
  const { data: dailyStats } = useGetDailySalesStats();
  const { data: salesByCategory } = useGetSalesByCategory();
  const { data: inventoryByCategory } = useGetInventoryStatsByCategory();
  const { data: summary } = useGetDashboardSummary();

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm">Business performance insights</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Inventory Value", value: formatCurrency(summary?.totalInventoryValue ?? 0), icon: Package, color: "text-purple-400" },
          { label: "Total Customers", value: (summary?.totalCustomers ?? 0).toLocaleString("en-IN"), icon: ShoppingCart, color: "text-blue-400" },
          { label: "Today's Revenue", value: formatCurrency(summary?.todaySales ?? 0), icon: TrendingUp, color: "text-primary" },
          { label: "Today's Profit", value: formatCurrency(summary?.todayProfit ?? 0), icon: DollarSign, color: "text-green-400" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={`w-8 h-8 ${kpi.color} flex-shrink-0`} />
              <div>
                <div className="text-xs text-muted-foreground">{kpi.label}</div>
                <div className="text-lg font-bold">{kpi.value}</div>
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
          <ResponsiveContainer width="100%" height={260}>
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
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: number, name: string) => [formatCurrency(v), name.charAt(0).toUpperCase() + name.slice(1)]}
              />
              <Legend />
              <Area type="monotone" dataKey="sales" stroke="#f4c542" strokeWidth={2} fill="url(#salesArea)" name="Sales" />
              <Area type="monotone" dataKey="profit" stroke="#81c784" strokeWidth={2} fill="url(#profitArea)" name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Sales by category */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={salesByCategory ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#888" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
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
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={inventoryByCategory ?? []}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
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
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => [formatCurrency(v), "Value"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {(inventoryByCategory ?? []).map((s, i) => (
                <div key={s.category} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="capitalize">{s.category}</span>
                  <span className="text-muted-foreground ml-auto">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GST summary */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">GST Summary (Estimated)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              { label: "Taxable Value (Sales)", value: formatCurrency((summary?.todaySales ?? 0) / 1.03) },
              { label: "Output GST (3%)", value: formatCurrency(((summary?.todaySales ?? 0) / 1.03) * 0.03) },
              { label: "Total Tax Collected", value: formatCurrency(((summary?.todaySales ?? 0) / 1.03) * 0.03) },
            ].map(item => (
              <div key={item.label} className="p-4 rounded-xl bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                <div className="text-xl font-bold text-primary">{item.value}</div>
                <div className="text-xs text-muted-foreground mt-1">Today's estimate</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">* These are estimated figures for today. Run full GSTR-1 report from Settings for the complete period.</p>
        </CardContent>
      </Card>
    </div>
  );
}
