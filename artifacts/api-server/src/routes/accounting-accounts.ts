import { Router } from "express";
import { db } from "@workspace/db";
import { chartOfAccountsTable, journalLinesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getOrCreateDefaultAccounts, safeFloat } from "./accounting-helpers";

const router = Router();

const VALID_ACCOUNT_TYPES = new Set(["asset", "liability", "equity", "income", "expense"]);
const VALID_SUB_TYPES = new Set([
  "cash", "bank", "accounts_receivable", "accounts_payable", "inventory", "fixed_asset",
  "capital", "direct_income", "indirect_income", "direct_expense", "indirect_expense", "other",
]);

function mapAccount(a: typeof chartOfAccountsTable.$inferSelect) {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    accountType: a.accountType,
    accountSubType: a.accountSubType,
    isSystemAccount: a.isSystemAccount,
    openingBalance: safeFloat(a.openingBalance),
    openingBalanceType: a.openingBalanceType,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
  };
}

// GET / — list all accounts, seeding the default Chart of Accounts on first call
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    await getOrCreateDefaultAccounts(userId);
    const accounts = await db.select().from(chartOfAccountsTable)
      .where(eq(chartOfAccountsTable.userId, userId))
      .orderBy(chartOfAccountsTable.code);
    res.json(accounts.map(mapAccount));
  } catch (err) {
    req.log.error({ err }, "Failed to list accounts");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST / — create a custom (non-system) account
router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const code = String(data.code ?? "").trim();
    const name = String(data.name ?? "").trim();
    if (!code) return res.status(400).json({ error: "Account code is required" });
    if (!name) return res.status(400).json({ error: "Account name is required" });
    if (!VALID_ACCOUNT_TYPES.has(data.accountType)) return res.status(400).json({ error: "Invalid account type" });
    const accountSubType = VALID_SUB_TYPES.has(data.accountSubType) ? data.accountSubType : "other";
    const openingBalanceType = data.openingBalanceType === "credit" ? "credit" : "debit";

    const [existing] = await db.select().from(chartOfAccountsTable)
      .where(and(eq(chartOfAccountsTable.userId, userId), eq(chartOfAccountsTable.code, code)));
    if (existing) return res.status(409).json({ error: `Account code "${code}" already exists` });

    const [created] = await db.insert(chartOfAccountsTable).values({
      userId,
      code,
      name,
      accountType: data.accountType,
      accountSubType,
      isSystemAccount: false,
      openingBalance: safeFloat(data.openingBalance, 0).toFixed(2),
      openingBalanceType,
    }).returning();
    res.status(201).json(mapAccount(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create account");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /:id — rename or (de)activate. System accounts can be renamed but
// never deactivated/deleted — other modules post to them by id.
router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [account] = await db.select().from(chartOfAccountsTable)
      .where(and(eq(chartOfAccountsTable.id, id), eq(chartOfAccountsTable.userId, userId)));
    if (!account) return res.status(404).json({ error: "Not found" });

    const data = req.body;
    const updates: Partial<typeof chartOfAccountsTable.$inferInsert> = {};
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) return res.status(400).json({ error: "Account name cannot be empty" });
      updates.name = name;
    }
    if (data.isActive !== undefined) {
      if (account.isSystemAccount && data.isActive === false) {
        return res.status(400).json({ error: "System accounts cannot be deactivated" });
      }
      updates.isActive = !!data.isActive;
    }
    if (data.openingBalance !== undefined) updates.openingBalance = safeFloat(data.openingBalance, 0).toFixed(2);
    if (data.openingBalanceType !== undefined) updates.openingBalanceType = data.openingBalanceType === "credit" ? "credit" : "debit";

    const [updated] = await db.update(chartOfAccountsTable).set(updates)
      .where(and(eq(chartOfAccountsTable.id, id), eq(chartOfAccountsTable.userId, userId)))
      .returning();
    res.json(mapAccount(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update account");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /:id — hard-delete a custom account, but only if it's never been posted to.
// System accounts can never be deleted (other modules post to them by id).
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [account] = await db.select().from(chartOfAccountsTable)
      .where(and(eq(chartOfAccountsTable.id, id), eq(chartOfAccountsTable.userId, userId)));
    if (!account) return res.status(404).json({ error: "Not found" });
    if (account.isSystemAccount) return res.status(400).json({ error: "System accounts cannot be deleted" });

    const [line] = await db.select({ id: journalLinesTable.id }).from(journalLinesTable)
      .where(and(eq(journalLinesTable.userId, userId), eq(journalLinesTable.accountId, id))).limit(1);
    if (line) return res.status(400).json({ error: "Cannot delete an account that already has journal entries — deactivate it instead" });

    await db.delete(chartOfAccountsTable).where(and(eq(chartOfAccountsTable.id, id), eq(chartOfAccountsTable.userId, userId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
