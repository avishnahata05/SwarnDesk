import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen } from "lucide-react";
import { apiGet, apiGetOther } from "./api";
import type { Account, DayBookEntry, Ledger } from "./types";

type ViewKey = "account" | "party" | "day" | "cash" | "bank";
const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "account", label: "Account Ledger" },
  { key: "party", label: "Party Ledger" },
  { key: "day", label: "Day Book" },
  { key: "cash", label: "Cash Book" },
  { key: "bank", label: "Bank Book" },
];

type Party = { id: number; name: string };

export default function LedgersTab() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewKey>("cash");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [partyType, setPartyType] = useState<"customer" | "supplier" | "karigar">("customer");
  const [partyId, setPartyId] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [dayBook, setDayBook] = useState<DayBookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    apiGet<Account[]>("/accounts").then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    const endpoint = partyType === "customer" ? "/customers" : partyType === "supplier" ? "/suppliers" : "/karigars";
    apiGetOther<Party[]>(endpoint).then(setParties).catch(() => setParties([]));
    setPartyId("");
  }, [partyType]);

  const load = useCallback(async () => {
    const myId = ++requestIdRef.current;
    setLoading(true);
    try {
      if (view === "account") {
        if (!accountId) { setLedger(null); return; }
        const r = await apiGet<Ledger>(`/reports/ledger?accountId=${accountId}&from=${from}&to=${to}`);
        if (requestIdRef.current === myId) setLedger(r);
      } else if (view === "party") {
        if (!partyId) { setLedger(null); return; }
        const r = await apiGet<Ledger>(`/reports/party-ledger?partyType=${partyType}&partyId=${partyId}&from=${from}&to=${to}`);
        if (requestIdRef.current === myId) setLedger(r);
      } else if (view === "cash") {
        const r = await apiGet<Ledger>(`/reports/cash-book?from=${from}&to=${to}`);
        if (requestIdRef.current === myId) setLedger(r);
      } else if (view === "bank") {
        const r = await apiGet<Ledger>(`/reports/bank-book?from=${from}&to=${to}`);
        if (requestIdRef.current === myId) setLedger(r);
      } else if (view === "day") {
        const r = await apiGet<DayBookEntry[]>(`/reports/day-book?date=${date}`);
        if (requestIdRef.current === myId) setDayBook(r);
      }
    } catch {
      if (requestIdRef.current === myId) toast({ title: "Failed to load", variant: "destructive" });
    } finally {
      if (requestIdRef.current === myId) setLoading(false);
    }
  }, [view, accountId, partyType, partyId, from, to, date]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Ledgers &amp; Books
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Running-balance ledgers for any account or party, plus the Day Book, Cash Book, and Bank Book</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${view === v.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3 flex flex-row items-center gap-2 flex-wrap">
          {view === "account" && (
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-8 text-xs w-56"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.isActive).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {view === "party" && (
            <>
              <Select value={partyType} onValueChange={v => setPartyType(v as typeof partyType)}>
                <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="karigar">Karigar</SelectItem>
                </SelectContent>
              </Select>
              <Select value={partyId} onValueChange={setPartyId}>
                <SelectTrigger className="h-8 text-xs w-56"><SelectValue placeholder="Select party" /></SelectTrigger>
                <SelectContent>
                  {parties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
          {(view === "account" || view === "party" || view === "cash" || view === "bank") && (
            <>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-xs w-36" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs w-36" />
            </>
          )}
          {view === "day" && <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs w-36" />}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
          ) : view === "day" ? (
            <DayBookView entries={dayBook} />
          ) : (
            <LedgerView ledger={ledger} needsSelection={(view === "account" && !accountId) || (view === "party" && !partyId)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-2 py-1.5 font-medium text-muted-foreground border-b border-border ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-2 py-1.5 border-b border-border/50 ${right ? "text-right" : ""}`}>{children}</td>;
}

function LedgerView({ ledger, needsSelection }: { ledger: Ledger | null; needsSelection: boolean }) {
  if (needsSelection) return <p className="text-sm text-muted-foreground py-8 text-center">Select an account or party to view its ledger.</p>;
  if (!ledger) return <p className="text-sm text-muted-foreground py-8 text-center">No data.</p>;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Opening Balance: {formatCurrency(ledger.openingBalance)}</span>
        <span>Closing Balance: {formatCurrency(ledger.closingBalance)}</span>
      </div>
      {ledger.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No transactions in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><Th>Date</Th><Th>Voucher #</Th><Th>Particulars</Th><Th right>Debit</Th><Th right>Credit</Th><Th right>Balance</Th></tr></thead>
            <tbody>
              {ledger.entries.map((e, i) => (
                <tr key={i}>
                  <Td>{new Date(e.voucherDate).toLocaleDateString("en-IN")}</Td>
                  <Td>{e.voucherNumber}</Td>
                  <Td>{e.particulars ?? e.narration ?? "—"}</Td>
                  <Td right>{e.debit > 0 ? formatCurrency(e.debit) : ""}</Td>
                  <Td right>{e.credit > 0 ? formatCurrency(e.credit) : ""}</Td>
                  <Td right>{formatCurrency(e.balance)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DayBookView({ entries }: { entries: DayBookEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No transactions on this date.</p>;
  return (
    <div className="space-y-3">
      {entries.map(v => (
        <div key={v.id} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-mono text-muted-foreground">{v.voucherNumber}</span>
            <span>{v.narration ?? `${v.sourceModule} entry`}</span>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {v.lines.map((l, i) => (
                <tr key={i}>
                  <Td>{l.accountName}</Td>
                  <Td right>{l.debit > 0 ? formatCurrency(l.debit) : ""}</Td>
                  <Td right>{l.credit > 0 ? formatCurrency(l.credit) : ""}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
