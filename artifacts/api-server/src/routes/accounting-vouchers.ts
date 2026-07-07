import { Router } from "express";
import { db } from "@workspace/db";
import { journalVouchersTable, journalLinesTable, chartOfAccountsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { postJournalEntry, reverseVoucher, safeFloat, type JournalLineInput, type PartyType } from "./accounting-helpers";

const router = Router();

const VALID_VOUCHER_TYPES = new Set(["sales", "purchase", "receipt", "payment", "journal", "contra"]);
const VALID_PARTY_TYPES = new Set(["none", "customer", "supplier", "karigar", "girvi_customer"]);

function mapVoucher(v: typeof journalVouchersTable.$inferSelect) {
  return {
    id: v.id,
    voucherNumber: v.voucherNumber,
    voucherType: v.voucherType,
    voucherDate: v.voucherDate.toISOString(),
    narration: v.narration,
    sourceModule: v.sourceModule,
    sourceId: v.sourceId,
    reversesVoucherId: v.reversesVoucherId,
    reversedByVoucherId: v.reversedByVoucherId,
    createdAt: v.createdAt.toISOString(),
  };
}

function mapLine(l: typeof journalLinesTable.$inferSelect, accountName?: string, accountCode?: string) {
  return {
    id: l.id,
    voucherId: l.voucherId,
    accountId: l.accountId,
    accountName: accountName ?? null,
    accountCode: accountCode ?? null,
    debit: safeFloat(l.debit),
    credit: safeFloat(l.credit),
    partyType: l.partyType,
    partyId: l.partyId,
    particulars: l.particulars,
  };
}

// GET / — paginated list with filters
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { from, to, voucherType, sourceModule, limit } = req.query as Record<string, string>;
    const limitNum = Math.min(2000, Math.max(1, parseInt(limit) || 200));
    const conditions = [eq(journalVouchersTable.userId, userId)];
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) conditions.push(gte(journalVouchersTable.voucherDate, d));
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); conditions.push(lte(journalVouchersTable.voucherDate, d)); }
    }
    if (voucherType && VALID_VOUCHER_TYPES.has(voucherType)) conditions.push(eq(journalVouchersTable.voucherType, voucherType));
    if (sourceModule) conditions.push(eq(journalVouchersTable.sourceModule, sourceModule));

    const vouchers = await db.select().from(journalVouchersTable)
      .where(and(...conditions))
      .orderBy(desc(journalVouchersTable.voucherDate), desc(journalVouchersTable.id))
      .limit(limitNum);

    if (vouchers.length === 0) return res.json([]);
    const lines = await db.select().from(journalLinesTable)
      .where(and(eq(journalLinesTable.userId, userId), inArray(journalLinesTable.voucherId, vouchers.map(v => v.id))));
    const accounts = await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.userId, userId));
    const accountById = new Map(accounts.map(a => [a.id, a]));
    const linesByVoucher = new Map<number, typeof lines>();
    for (const l of lines) {
      const arr = linesByVoucher.get(l.voucherId) ?? [];
      arr.push(l);
      linesByVoucher.set(l.voucherId, arr);
    }

    res.json(vouchers.map(v => ({
      ...mapVoucher(v),
      lines: (linesByVoucher.get(v.id) ?? []).map(l => {
        const acc = accountById.get(l.accountId);
        return mapLine(l, acc?.name, acc?.code);
      }),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list vouchers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [voucher] = await db.select().from(journalVouchersTable)
      .where(and(eq(journalVouchersTable.id, id), eq(journalVouchersTable.userId, userId)));
    if (!voucher) return res.status(404).json({ error: "Not found" });
    const lines = await db.select().from(journalLinesTable)
      .where(and(eq(journalLinesTable.voucherId, id), eq(journalLinesTable.userId, userId)));
    const accounts = await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.userId, userId));
    const accountById = new Map(accounts.map(a => [a.id, a]));
    res.json({
      ...mapVoucher(voucher),
      lines: lines.map(l => {
        const acc = accountById.get(l.accountId);
        return mapLine(l, acc?.name, acc?.code);
      }),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get voucher");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST / — manual Journal Voucher (also used for "Quick Expense" entries from the UI,
// which just submit a pre-filled 2-line body).
router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const voucherType = VALID_VOUCHER_TYPES.has(data.voucherType) ? data.voucherType : "journal";
    const voucherDate = data.voucherDate ? new Date(data.voucherDate) : new Date();
    if (isNaN(voucherDate.getTime())) return res.status(400).json({ error: "Invalid voucher date" });
    const narration = data.narration ? String(data.narration).slice(0, 500) : null;

    const rawLines: Array<{ accountId: number; debit?: number; credit?: number; partyType?: PartyType; partyId?: number; particulars?: string }> =
      Array.isArray(data.lines) ? data.lines : [];
    if (rawLines.length < 2) return res.status(400).json({ error: "At least two lines are required" });

    const lines: JournalLineInput[] = [];
    for (const l of rawLines) {
      const accountId = parseInt(String(l.accountId));
      if (isNaN(accountId)) return res.status(400).json({ error: "Every line needs a valid accountId" });
      const debit = safeFloat(l.debit, 0);
      const credit = safeFloat(l.credit, 0);
      if (debit < 0 || credit < 0) return res.status(400).json({ error: "Debit/credit cannot be negative" });
      if (debit > 0 && credit > 0) return res.status(400).json({ error: "A single line cannot have both debit and credit" });
      const partyType = VALID_PARTY_TYPES.has(l.partyType as string) ? (l.partyType as PartyType) : "none";
      lines.push({
        accountId, debit, credit, partyType,
        partyId: partyType === "none" ? null : (parseInt(String(l.partyId)) || null),
        particulars: l.particulars ? String(l.particulars).slice(0, 500) : null,
      });
    }

    // Verify every account belongs to this user before posting.
    const accountIds = [...new Set(lines.map(l => l.accountId))];
    const accounts = await db.select().from(chartOfAccountsTable)
      .where(and(eq(chartOfAccountsTable.userId, userId), inArray(chartOfAccountsTable.id, accountIds)));
    if (accounts.length !== accountIds.length) return res.status(400).json({ error: "One or more accounts are invalid" });

    const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: `Entry is not balanced: debit ₹${totalDebit.toFixed(2)} vs credit ₹${totalCredit.toFixed(2)}` });
    }

    const voucher = await db.transaction(async (tx) =>
      postJournalEntry(tx, { userId, voucherDate, voucherType, narration, sourceModule: "manual", lines })
    );
    res.status(201).json(mapVoucher(voucher));
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to create journal voucher");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:id/void — reverses a voucher instead of deleting it (audit trail preserved)
router.post("/:id/void", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const narration = req.body?.narration ? String(req.body.narration).slice(0, 500) : undefined;
    const reversal = await reverseVoucher(userId, id, narration);
    res.json(mapVoucher(reversal));
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    req.log.error({ err }, "Failed to void voucher");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
