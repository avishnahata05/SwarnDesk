export type Account = {
  id: number;
  code: string;
  name: string;
  accountType: "asset" | "liability" | "equity" | "income" | "expense";
  accountSubType: string;
  isSystemAccount: boolean;
  openingBalance: number;
  openingBalanceType: "debit" | "credit";
  isActive: boolean;
  createdAt: string;
};

export type JournalLine = {
  id?: number;
  voucherId?: number;
  accountId: number;
  accountName?: string | null;
  accountCode?: string | null;
  debit: number;
  credit: number;
  partyType: "none" | "customer" | "supplier" | "karigar" | "girvi_customer";
  partyId: number | null;
  particulars: string | null;
};

export type Voucher = {
  id: number;
  voucherNumber: string;
  voucherType: string;
  voucherDate: string;
  narration: string | null;
  sourceModule: string;
  sourceId: number | null;
  reversesVoucherId: number | null;
  reversedByVoucherId: number | null;
  createdAt: string;
  lines?: JournalLine[];
};

export type LedgerEntry = {
  voucherId: number;
  voucherNumber: string;
  voucherDate: string;
  voucherType: string;
  narration: string | null;
  particulars: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type Ledger = {
  account?: { id: number; code: string; name: string; accountType: string };
  partyType?: string;
  partyId?: number;
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
};

export type DayBookEntry = {
  id: number;
  voucherNumber: string;
  voucherType: string;
  voucherDate: string;
  narration: string | null;
  sourceModule: string;
  lines: { accountName: string; accountCode: string; debit: number; credit: number; particulars: string | null }[];
};

export type TrialBalanceRow = { accountId: number; code: string; name: string; accountType: string; debit: number; credit: number };
export type TrialBalance = { asOf: string; rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; balanced: boolean };

export type ProfitLoss = {
  period: { from: string; to: string };
  income: { accountId: number; code: string; name: string; amount: number }[];
  expense: { accountId: number; code: string; name: string; amount: number }[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
};

export type BalanceSheet = {
  asOf: string;
  assets: { accountId: number; code: string; name: string; balance: number }[];
  liabilities: { accountId: number; code: string; name: string; balance: number }[];
  equity: { accountId: number; code: string; name: string; balance: number }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
};

export type OutstandingRow = { type: string; id: number; name: string; reference: string; amount: number };
export type Outstanding = { debtors: OutstandingRow[]; creditors: OutstandingRow[]; totalDebtors: number; totalCreditors: number };

export type AccountingSettings = {
  financialYearStartMonth: number;
  journalPrefix: string;
  receiptPrefix: string;
  paymentPrefix: string;
  booksLockedBefore: string | null;
  updatedAt: string;
};
