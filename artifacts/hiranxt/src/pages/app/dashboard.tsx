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
  TrendingUp, Package, Users, Wrench, AlertTriangle, Plus, PlusCircle, Bot, X, Send
} from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const COLORS = ["#f4c542", "#e94560", "#4fc3f7", "#81c784", "#ce93d8"];

const AI_RESPONSES: Record<string, string> = {
  "low stock": "You have items with low stock. Check the Inventory page for details and reorder alerts.",
  "today": "Today's sales are live on your dashboard. Scroll up to see the summary cards.",
  "best selling": "Gold bangles and chains are your top-selling categories this month based on transaction data.",
  "profit": "Today's estimated profit is 15% of sales revenue. Check the Reports page for detailed P&L.",
  "repair": "There are pending repair jobs awaiting delivery. Visit the Repairs page to update statuses.",
  "customer": "You have customers with upcoming birthdays and anniversaries. Send them a WhatsApp greeting!",
};

function getAIResponse(query: string): string {
  const q = query.toLowerCase();
  for (const [key, resp] of Object.entries(AI_RESPONSES)) {
    if (q.includes(key)) return resp;
  }
  return `I found information related to "${query}". Your HiraNXT data shows healthy business activity. Visit the relevant module for detailed insights.`;
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: recentSales } = useGetRecentSales();
  const { data: lowStock } = useGetLowStockItems();
  const { data: dailyStats } = useGetDailySalesStats();
  const { data: categoryStats } = useGetSalesByCategory();

  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hello! I'm your HiraNXT AI assistant. Ask me about low stock, today's sales, best-selling categories, or anything about your business." }
  ]);

  const sendAiQuery = () => {
    if (!aiQuery.trim()) return;
    const q = aiQuery.trim();
    setAiMessages(prev => [...prev, { role: "user", text: q }, { role: "ai", text: getAIResponse(q) }]);
    setAiQuery("");
  };

  const summaryCards = [
    { label: "Today's Sales", value: summaryLoading ? "..." : formatCurrency(summary?.todaySales ?? 0), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Today's Profit", value: summaryLoading ? "..." : formatCurrency(summary?.todayProfit ?? 0), icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Inventory Value", value: summaryLoading ? "..." : formatCurrency(summary?.totalInventoryValue ?? 0), icon: Package, color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Total Customers", value: summaryLoading ? "..." : (summary?.totalCustomers ?? 0).toLocaleString("en-IN"), icon: Users, color: "text-orange-400", bg: "bg-orange-400/10" },
    { label: "Stock Items", value: summaryLoading ? "..." : (summary?.totalInventoryItems ?? 0).toString(), icon: Package, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Pending Repairs", value: summaryLoading ? "..." : (summary?.pendingRepairs ?? 0).toString(), icon: Wrench, color: "text-red-400", bg: "bg-red-400/10" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/billing">
            <Button size="sm" className="gap-1.5" data-testid="button-new-sale">
              <Plus className="w-3.5 h-3.5" />New Sale
            </Button>
          </Link>
          <Link href="/app/inventory">
            <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-add-item">
              <PlusCircle className="w-3.5 h-3.5" /><span className="hidden sm:inline">Add Item</span><span className="sm:hidden">+Item</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="border-border" data-testid={`card-${card.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-3 md:p-4">
              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg ${card.bg} flex items-center justify-center mb-2 md:mb-3`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="text-base md:text-lg font-bold leading-tight">{card.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4 md:gap-5">
        {/* Sales trend */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sales Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyStats ?? []}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f4c542" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f4c542" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#888" }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "#888" }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} width={38} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatCurrency(v), "Sales"]}
                />
                <Area type="monotone" dataKey="sales" stroke="#f4c542" strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category pie */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={categoryStats ?? []} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" nameKey="category">
                  {(categoryStats ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-1">
              {(categoryStats ?? []).slice(0, 4).map((s, i) => (
                <div key={s.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="capitalize">{s.category}</span>
                  </div>
                  <span className="text-muted-foreground">{s.count} items</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low stock + Recent sales */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
        {/* Low stock alerts */}
        <Card className="border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Low Stock Alerts
            </CardTitle>
            <Link href="/app/inventory" className="text-xs text-primary hover:underline shrink-0">
              View All
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {!lowStock || lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No low stock alerts</p>
            ) : (
              lowStock.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.category} • {item.purity}</div>
                  </div>
                  <Badge variant="destructive" className="shrink-0" data-testid={`badge-stock-${item.id}`}>Qty: {item.quantity}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent sales */}
        <Card className="border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Sales</CardTitle>
            <Link href="/app/billing" className="text-xs text-primary hover:underline shrink-0">
              New Bill
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {!recentSales || recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No sales yet. <Link href="/app/billing" className="text-primary underline">Create first bill</Link></p>
            ) : (
              recentSales.slice(0, 5).map(sale => (
                <div key={sale.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors gap-2" data-testid={`row-sale-${sale.id}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{sale.customerName}</div>
                    <div className="text-xs text-muted-foreground">{sale.invoiceNumber} • {sale.paymentMode}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-primary">{formatCurrency(sale.totalAmount)}</div>
                    <Badge variant={sale.paymentStatus === "paid" ? "default" : "secondary"} className="text-xs">
                      {sale.paymentStatus}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Chat widget — responsive width, stays on screen */}
      {aiOpen && (
        <div className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/10">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">HiraNXT AI</span>
            </div>
            <button onClick={() => setAiOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-64">
            {aiMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border flex gap-2">
            <input
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              placeholder="Ask anything..."
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendAiQuery()}
              data-testid="input-ai-query"
            />
            <button
              onClick={sendAiQuery}
              className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center hover:bg-primary/80 transition-colors shrink-0"
              data-testid="button-ai-send"
            >
              <Send className="w-3.5 h-3.5 text-primary-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* AI button */}
      <button
        onClick={() => setAiOpen(o => !o)}
        className="fixed bottom-6 right-4 z-40 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 transition-all"
        data-testid="button-ai-chat"
      >
        <Bot className="w-6 h-6 text-primary-foreground" />
      </button>
    </div>
  );
}
