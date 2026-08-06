import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BankAccount = {
  id: number;
  name: string;
  bankName: string | null;
  bankAccountNumber: string | null;
  isDefaultBank: boolean;
};

const BANK_LIKE_MODES = new Set(["bank", "upi", "card", "cheque"]);

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("swarndesk_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function label(a: BankAccount): string {
  return a.bankName ? `${a.name} (${a.bankName}${a.bankAccountNumber ? ` •${a.bankAccountNumber.slice(-4)}` : ""})` : a.name;
}

// Shows a bank-account picker whenever `paymentMode` is a bank-like mode (bank/upi/card/
// cheque) AND the shop has more than one bank account on file — with exactly one, it's
// auto-selected silently so single-bank shops see no extra UI, same as before this existed.
export function BankAccountSelect({
  paymentMode, bankAccountId, onChange, className,
}: {
  paymentMode: string;
  bankAccountId: number | null;
  onChange: (id: number | null) => void;
  className?: string;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/accounting/accounts/banks", { headers: authHeader() })
      .then(r => (r.ok ? r.json() : []))
      .then((data: BankAccount[]) => { if (!cancelled) setAccounts(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const isBankLike = BANK_LIKE_MODES.has(paymentMode);

  useEffect(() => {
    if (!isBankLike || accounts.length === 0) return;
    if (accounts.length === 1 && bankAccountId !== accounts[0].id) {
      onChange(accounts[0].id);
      return;
    }
    if (accounts.length > 1 && bankAccountId == null) {
      const def = accounts.find(a => a.isDefaultBank);
      if (def) onChange(def.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBankLike, accounts]);

  if (!isBankLike || accounts.length < 2) return null;

  return (
    <div className={className}>
      <Label>Bank Account</Label>
      <Select value={bankAccountId != null ? String(bankAccountId) : ""} onValueChange={v => onChange(v ? parseInt(v) : null)}>
        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select bank account" /></SelectTrigger>
        <SelectContent>
          {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{label(a)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
