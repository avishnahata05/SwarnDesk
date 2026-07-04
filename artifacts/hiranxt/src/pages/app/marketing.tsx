import { useState, useEffect, useCallback } from "react";
import { useListCustomers, useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle, Send, Users, CheckSquare, Square, Sparkles,
  Search, Info, ExternalLink, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

function friendlySendError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("meta") || /\b\d{3,}\b/.test(message) || lower.includes("graph.facebook")) {
    return "Couldn't send via WhatsApp API — check your WhatsApp settings and try again, or use the WhatsApp link fallback.";
  }
  return message;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("swarndesk_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Template {
  id: string;
  label: string;
  emoji: string;
  category: string;
  body: string;
  hint: string;
}

const TEMPLATES: Template[] = [
  {
    id: "sale",
    label: "Sale Announcement",
    emoji: "🎉",
    category: "Promotion",
    body: "Dear {name},\n\nWe have exciting news for you! We're running a special sale at {shopName} — exclusive discounts on gold, silver, and diamond jewellery.\n\nVisit us today and treat yourself or someone special. We'd love to see you! 💛\n\n— {shopName}",
    hint: "Send when running a sale or offer",
  },
  {
    id: "festival",
    label: "Festival Wishes",
    emoji: "🪔",
    category: "Festival",
    body: "Dear {name},\n\nWishing you and your family a very happy and prosperous festival! 🪔✨\n\nTo celebrate, we have beautiful new jewellery collections at {shopName}. Come and make this festival more special.\n\nHappy Festivities!\n— {shopName}",
    hint: "Perfect for Diwali, Navratri, Dhanteras, etc.",
  },
  {
    id: "birthday",
    label: "Birthday Wishes",
    emoji: "🎂",
    category: "Personal",
    body: "Dear {name},\n\nWishing you a very Happy Birthday! 🎂🎉\n\nWe at {shopName} feel grateful to have customers like you. To make your special day even more memorable, visit us for an exclusive birthday discount on our collection.\n\nMay this year bring you joy and prosperity! 💛\n\n— {shopName}",
    hint: "Send to customers on their birthday",
  },
  {
    id: "new_arrival",
    label: "New Collection",
    emoji: "✨",
    category: "Promotion",
    body: "Dear {name},\n\nExciting news! We've just received a stunning new jewellery collection at {shopName}.\n\nFrom elegant necklaces to intricate bangles — there's something for every occasion. Come and be the first to explore!\n\n📍 Visit us soon.\n— {shopName}",
    hint: "Send when new stock arrives",
  },
  {
    id: "anniversary",
    label: "Anniversary Wishes",
    emoji: "💍",
    category: "Personal",
    body: "Dear {name},\n\nWishing you and your partner a very Happy Anniversary! 💍💛\n\nCelebrate this beautiful milestone with a gift that lasts forever. Visit {shopName} for special anniversary jewellery and exclusive offers.\n\nHere's to many more years of love and happiness!\n— {shopName}",
    hint: "Send to customers on their anniversary",
  },
  {
    id: "reminder",
    label: "We Miss You",
    emoji: "💌",
    category: "Retention",
    body: "Dear {name},\n\nIt's been a while and we miss you at {shopName}! 😊\n\nWe have exciting new pieces you'd love to see. Come visit us whenever you're free — we always have something special waiting for you.\n\nLooking forward to seeing you soon!\n— {shopName}",
    hint: "Send to customers who haven't visited recently",
  },
];

interface SendResult {
  name: string;
  mobile: string;
  success: boolean;
}

export default function Marketing() {
  const { toast } = useToast();
  const { data: allCustomers, isLoading } = useListCustomers({});
  const { data: settingsData } = useGetSettings();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeTemplate, setActiveTemplate] = useState<Template>(TEMPLATES[0]);
  const [customMessage, setCustomMessage] = useState(TEMPLATES[0].body);
  const [shopName, setShopName] = useState("Our Jewellery Store");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);

  // Derive WhatsApp API status from cached settings (null = still loading)
  const waEnabled: boolean | null = settingsData === undefined
    ? null
    : ((settingsData as unknown as { whatsappApiEnabled?: boolean }).whatsappApiEnabled ?? false);

  // Populate shop name once settings load
  useEffect(() => {
    if (settingsData?.businessName) setShopName(settingsData.businessName);
  }, [settingsData]);

  const customers = (allCustomers ?? []).filter(c => c.mobile);
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q);
  });

  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      // Remove only the filtered customers — preserve any selections outside the current filter
      setSelectedIds(prev => {
        const n = new Set(prev);
        filtered.forEach(c => n.delete(c.id));
        return n;
      });
    } else {
      // Add filtered customers to whatever is already selected
      setSelectedIds(prev => new Set([...prev, ...filtered.map(c => c.id)]));
    }
    setResults(null);
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setResults(null);
  };

  const applyTemplate = useCallback((t: Template) => {
    setActiveTemplate(t);
    setCustomMessage(t.body);
    setResults(null);
  }, []);

  const buildMessage = (name: string) =>
    customMessage.replace(/\{name\}/g, name).replace(/\{shopName\}/g, shopName);

  const selectedCustomers = customers.filter(c => selectedIds.has(c.id));

  const handleSend = async () => {
    if (selectedCustomers.length === 0) {
      toast({ title: "Select at least one customer", variant: "destructive" }); return;
    }
    if (!customMessage.trim()) {
      toast({ title: "Write a message before sending", variant: "destructive" }); return;
    }

    if (!waEnabled) {
      // Fallback: open WhatsApp links
      selectedCustomers.forEach(c => {
        const digits = c.mobile.replace(/\D/g, "");
        const fullMobile = digits.length === 10 ? `91${digits}` : digits;
        window.open(`https://wa.me/${fullMobile}?text=${encodeURIComponent(buildMessage(c.name))}`, "_blank");
      });
      toast({ title: `Opened WhatsApp for ${selectedCustomers.length} customer(s)` });
      return;
    }

    setSending(true);
    setResults(null);
    try {
      const recipients = selectedCustomers.map(c => ({
        mobile: c.mobile,
        name: c.name,
        message: buildMessage(c.name),
      }));
      const r = await fetch("/api/whatsapp/send-bulk", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ recipients }),
      });
      const d = await r.json() as { sent: number; failed: number; results?: { mobile: string; success: boolean }[]; error?: string };
      if (!r.ok) throw new Error(d.error ? friendlySendError(d.error) : "Failed to send");

      const resultMap = new Map((d.results ?? []).map(x => [x.mobile, x.success]));
      setResults(selectedCustomers.map(c => ({
        name: c.name,
        mobile: c.mobile,
        success: resultMap.get(c.mobile) ?? true,
      })));
      toast({ title: `✓ Sent: ${d.sent}  ✗ Failed: ${d.failed}` });
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to send", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const categoryColors: Record<string, string> = {
    Promotion: "bg-amber-100 text-amber-800",
    Festival: "bg-orange-100 text-orange-800",
    Personal: "bg-pink-100 text-pink-800",
    Retention: "bg-violet-100 text-violet-800",
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-500" />
            WhatsApp Marketing
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Send personalised WhatsApp messages to your customers — promotions, festivals, birthday wishes, and more.
          </p>
        </div>
        {waEnabled === false && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>Direct sending isn't set up yet — we'll open a WhatsApp chat for each customer instead so you can send manually. <a href="/app/settings" className="underline font-medium">Set it up in Settings</a> to send automatically instead.</span>
          </div>
        )}
        {waEnabled === true && (
          <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
            <CheckCircle2 className="w-3 h-3" />WhatsApp API Active
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* LEFT — Templates + Message Editor */}
        <div className="space-y-5">
          {/* Template picker */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Pick a Ready-Made Template
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    activeTemplate.id === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/10"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{t.emoji}</span>
                    <span className="text-sm font-medium">{t.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColors[t.category] ?? "bg-muted text-muted-foreground"}`}>
                      {t.category}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{t.hint}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Message editor */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Edit Your Message</CardTitle>
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{"{name}"}</code> for customer's name and{" "}
                <code className="bg-muted px-1 rounded">{"{shopName}"}</code> for your shop name.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Your Shop Name</label>
                <Input
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  placeholder="Enter your shop name"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Message</label>
                <textarea
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none min-h-[200px] font-mono"
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="Write your message here..."
                />
                <div className="text-xs text-muted-foreground mt-1">{customMessage.length} characters — longer messages may be less likely to be read</div>
              </div>

              {/* Preview */}
              {selectedCustomers.length > 0 && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                  <div className="text-xs font-medium text-green-800 mb-1.5 flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Preview for {selectedCustomers[0].name}:
                  </div>
                  <div className="text-xs text-green-900 whitespace-pre-line leading-relaxed">
                    {buildMessage(selectedCustomers[0].name)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Customer Selector */}
        <div className="space-y-5">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Select Recipients ({selectedIds.size} selected)
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search customers..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs w-44"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Loading customers...</div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm space-y-2">
                  <p>No customers with phone numbers found.</p>
                  <p>
                    <Link href="/app/customers" className="text-primary underline font-medium">
                      Add phone numbers to your customers first — go to Customers.
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  {/* Select all row */}
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/20 cursor-pointer hover:bg-muted/30 sticky top-0"
                    onClick={toggleAll}
                  >
                    {allSelected
                      ? <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
                      : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <span className="text-xs font-medium text-muted-foreground">
                      {allSelected ? "Deselect all" : `Select all (${filtered.length})`}
                    </span>
                  </div>
                  {filtered.map(c => (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/50 cursor-pointer transition-colors last:border-0 ${
                        selectedIds.has(c.id) ? "bg-primary/5" : "hover:bg-muted/10"
                      }`}
                      onClick={() => toggleOne(c.id)}
                    >
                      {selectedIds.has(c.id)
                        ? <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
                        : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.mobile}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send button */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleSend}
              disabled={sending || selectedIds.size === 0}
              className="gap-2 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {sending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
                : waEnabled
                  ? <><Send className="w-4 h-4" />Send via WhatsApp API ({selectedIds.size})</>
                  : <><ExternalLink className="w-4 h-4" />Open WhatsApp Links ({selectedIds.size})</>}
            </Button>
            {selectedIds.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} customer{selectedIds.size !== 1 ? "s" : ""} will receive this message
              </span>
            )}
          </div>

          {/* Results */}
          {results && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Send Results
                  <Badge className="bg-green-100 text-green-800">{results.filter(r => r.success).length} sent</Badge>
                  {results.some(r => !r.success) && (
                    <Badge variant="destructive">{results.filter(r => !r.success).length} failed</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-48 overflow-y-auto space-y-1.5">
                {results.map(r => (
                  <div key={r.mobile} className="flex items-center gap-2 text-xs">
                    {r.success
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                    <span className={r.success ? "text-foreground" : "text-destructive"}>{r.name}</span>
                    <span className="text-muted-foreground">{r.mobile}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* How it works section */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">How does this work?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            {[
              { step: "1", title: "Pick a template", desc: "Choose from ready-made messages for sales, festivals, birthdays, and more — or write your own." },
              { step: "2", title: "Select customers", desc: "Choose which customers should receive the message. Use search to find specific people." },
              { step: "3", title: "Hit Send", desc: "Messages are personalised with each customer's name and sent via WhatsApp API or opened as links." },
            ].map(s => (
              <div key={s.step} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {s.step}
                </div>
                <div>
                  <div className="font-medium text-foreground">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
