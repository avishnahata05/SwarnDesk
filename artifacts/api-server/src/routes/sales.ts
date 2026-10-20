import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, saleLineItemsTable, inventoryItemsTable, customersTable, paymentTransactionsTable, businessSettingsTable, saleReturnsTable, journalVouchersTable } from "@workspace/db";
import { eq, and, gte, lte, ne, or, ilike, sql, desc, inArray } from "drizzle-orm";
import { postJournalEntry, getOrCreateDefaultAccounts, resolveMoneyAccountId, isValidBankAccount, nextVoucherNumber, reverseVoucherTx, safeFloat } from "./accounting-helpers";

const router = Router();

// Shops work in IST. A bare "2026-03-31" from a date picker must mean the whole of that
// Indian day — parsing it as UTC midnight (what `new Date("2026-03-31")` does) made an
// end-date filter drop every sale made on the end date itself.
function parseDateBound(value: string, endOfDay: boolean): Date | null {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`)
    : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function mapSale(s: typeof salesTable.$inferSelect) {
  const total = parseFloat(s.totalAmount) || 0;
  const paid = parseFloat(s.paidAmount) || 0;
  return {
    id: s.id,
    customerId: s.customerId,
    customerName: s.customerName,
    totalAmount: total,
    paidAmount: paid,
    // A returned sale was cancelled — whatever was unpaid is no longer owed.
    balanceAmount: s.status === "returned" ? 0 : Math.max(0, total - paid),
    gstAmount: parseFloat(s.gstAmount) || 0,
    discountAmount: parseFloat(s.discountAmount) || 0,
    exchangeGoldWeight: parseFloat(s.exchangeGoldWeight) || 0,
    exchangeGoldValue: parseFloat(s.exchangeGoldValue) || 0,
    paymentMode: s.paymentMode,
    bankAccountId: s.bankAccountId,
    salespersonId: s.salespersonId,
    salespersonName: s.salespersonName,
    paymentStatus: s.paymentStatus,
    status: s.status,
    invoiceNumber: s.invoiceNumber,
    saleDate: s.saleDate.toISOString(),
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
  };
}

function mapTransaction(t: typeof paymentTransactionsTable.$inferSelect) {
  return {
    id: t.id,
    saleId: t.saleId,
    customerId: t.customerId,
    customerName: t.customerName,
    amount: parseFloat(t.amount) || 0,
    paymentMode: t.paymentMode,
    bankAccountId: t.bankAccountId,
    paidAt: t.paidAt.toISOString(),
    notes: t.notes,
  };
}

router.get("/stats/by-category", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const stats = await db
      .select({
        category: inventoryItemsTable.category,
        count: sql<number>`count(${saleLineItemsTable.id})::int`,
        value: sql<number>`sum(${saleLineItemsTable.lineTotal})::numeric`,
      })
      .from(saleLineItemsTable)
      .innerJoin(salesTable, and(eq(saleLineItemsTable.saleId, salesTable.id), eq(salesTable.userId, userId)))
      .leftJoin(inventoryItemsTable, eq(saleLineItemsTable.inventoryItemId, inventoryItemsTable.id))
      .where(and(eq(saleLineItemsTable.userId, userId), ne(salesTable.status, "returned")))
      .groupBy(inventoryItemsTable.category);
    res.json(stats.map(s => ({
      category: s.category ?? "unknown",
      count: s.count,
      value: parseFloat(String(s.value)) || 0,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get sales by category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats/daily", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [salesStats, profitStats] = await Promise.all([
      db.select({
        date: sql<string>`DATE(${salesTable.saleDate} AT TIME ZONE 'Asia/Kolkata')::text`,
        sales: sql<number>`sum(${salesTable.totalAmount})::numeric`,
      })
      .from(salesTable)
      .where(and(eq(salesTable.userId, userId), ne(salesTable.status, "returned"), gte(salesTable.saleDate, cutoff)))
      .groupBy(sql`DATE(${salesTable.saleDate} AT TIME ZONE 'Asia/Kolkata')`)
      .orderBy(sql`DATE(${salesTable.saleDate} AT TIME ZONE 'Asia/Kolkata')`),

      db.select({
        date: sql<string>`DATE(${salesTable.saleDate} AT TIME ZONE 'Asia/Kolkata')::text`,
        profit: sql<number>`sum(${saleLineItemsTable.makingCharges} * ${saleLineItemsTable.quantity})::numeric`,
      })
      .from(saleLineItemsTable)
      .innerJoin(salesTable, and(eq(saleLineItemsTable.saleId, salesTable.id), eq(salesTable.userId, userId)))
      .where(and(eq(saleLineItemsTable.userId, userId), ne(salesTable.status, "returned"), gte(salesTable.saleDate, cutoff)))
      .groupBy(sql`DATE(${salesTable.saleDate} AT TIME ZONE 'Asia/Kolkata')`),
    ]);

    const profitByDate = new Map(profitStats.map(p => [p.date, parseFloat(String(p.profit)) || 0]));

    res.json(salesStats.map(s => ({
      date: s.date,
      sales: parseFloat(String(s.sales)) || 0,
      profit: profitByDate.get(s.date) ?? 0,
      purchases: 0,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get daily stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { startDate, endDate, customerId, limit } = req.query as Record<string, string>;
    const limitNum = Math.min(5000, Math.max(1, parseInt(limit) || 500));
    const conditions = [eq(salesTable.userId, userId)];
    if (startDate) {
      const d = parseDateBound(startDate, false);
      if (d) conditions.push(gte(salesTable.saleDate, d));
    }
    if (endDate) {
      const d = parseDateBound(endDate, true);
      if (d) conditions.push(lte(salesTable.saleDate, d));
    }
    if (customerId) {
      const cid = parseInt(customerId);
      if (!isNaN(cid)) conditions.push(eq(salesTable.customerId, cid));
    }
    const sales = await db.select().from(salesTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(salesTable.saleDate))
      .limit(limitNum);
    res.json(sales.map(mapSale));
  } catch (err) {
    req.log.error({ err }, "Failed to list sales");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;

    // Validate required fields
    const totalAmount = parseFloat(data.totalAmount);
    if (!data.customerName?.trim()) return res.status(400).json({ error: "Customer name is required" });
    if (!isFinite(totalAmount) || totalAmount < 0) return res.status(400).json({ error: "Invalid total amount" });

    const items: Array<{
      inventoryItemId: number; itemName: string; quantity: number;
      unitPrice: number; metalRate: number; goldWeight: number;
      makingCharges: number; discount: number;
    }> = Array.isArray(data.items) ? data.items : [];

    if (items.length === 0) return res.status(400).json({ error: "Add at least one item to the bill" });
    for (const f of ["discountAmount", "gstAmount", "exchangeGoldWeight", "exchangeGoldValue"] as const) {
      const v = data[f];
      if (v !== undefined && v !== null && v !== "" && !(isFinite(parseFloat(v)) && parseFloat(v) >= 0)) {
        return res.status(400).json({ error: `Invalid ${f}` });
      }
    }

    // Determine paid amount and auto-derive status. Capped at the bill total: a customer
    // can't "pay" more than the invoice, and an uncapped value would book phantom cash.
    const rawPaid = parseFloat(data.paidAmount);
    const paidAmount = Math.min(totalAmount, isFinite(rawPaid) && rawPaid >= 0 ? rawPaid : totalAmount);
    const autoStatus = paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "pending";

    // A bill that leaves a balance owed needs a real customer to chase — a walk-in with
    // no record can never be followed up, and the dues would just vanish into the ledger.
    const customerIdNum = data.customerId ? parseInt(data.customerId) : null;
    if (paidAmount < totalAmount - 0.005 && !(customerIdNum && customerIdNum > 0)) {
      return res.status(400).json({ error: "Select or add a customer for a bill that is not fully paid" });
    }
    if (customerIdNum && customerIdNum > 0) {
      const [cust] = await db.select({ id: customersTable.id }).from(customersTable)
        .where(and(eq(customersTable.id, customerIdNum), eq(customersTable.userId, userId)));
      if (!cust) return res.status(400).json({ error: "Customer not found" });
    }

    // Validate all line items up-front before touching DB
    for (const item of items) {
      const qty = parseInt(item.quantity as unknown as string);
      if (!isFinite(qty) || qty <= 0) return res.status(400).json({ error: "Invalid item quantity" });
      const unitPrice = parseFloat(item.unitPrice as unknown as string);
      if (!isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ error: "Invalid unit price" });
      const lineDiscount = parseFloat(item.discount as unknown as string) || 0;
      if (lineDiscount < 0 || lineDiscount > unitPrice * qty) return res.status(400).json({ error: "Invalid item discount" });
    }

    // Loyalty points are an optional program (Settings → Loyalty Points) — off shops
    // shouldn't have points silently accruing on every sale.
    const [loyaltySettings] = await db.select({
      loyaltyPointsEnabled: businessSettingsTable.loyaltyPointsEnabled,
      loyaltyPointsRate: businessSettingsTable.loyaltyPointsRate,
    }).from(businessSettingsTable).where(eq(businessSettingsTable.userId, userId)).orderBy(desc(businessSettingsTable.id)).limit(1);
    const loyaltyEnabled = loyaltySettings?.loyaltyPointsEnabled ?? true;
    const loyaltyRate = (loyaltySettings ? parseFloat(loyaltySettings.loyaltyPointsRate) : NaN) || 1000;
    const accts = await getOrCreateDefaultAccounts(userId);

    const bankAccountId = data.bankAccountId ? parseInt(data.bankAccountId) : null;
    if (bankAccountId && !(await isValidBankAccount(userId, bankAccountId))) {
      return res.status(400).json({ error: "Invalid bank account" });
    }
    const moneyAccountId = await resolveMoneyAccountId(userId, data.paymentMode, bankAccountId, accts);

    const sale = await db.transaction(async (tx) => {
      // 0. Atomic, gap-free, per-shop sequential invoice numbering. Allocated inside the
      // transaction so a sale rejected for stock (or any later failure) rolls the counter
      // back instead of burning an invoice number — GST invoice series must have no gaps.
      const invoiceNumber = await nextVoucherNumber(userId, "sale", "SD", new Date(), tx);

      // 1. Lock inventory rows and check stock atomically.
      // Quantities are summed PER INVENTORY ITEM first: the same item can legitimately
      // appear on more than one line, and checking each line separately against the same
      // stock level would let 2x3 units through against a stock of 4 and drive the row
      // negative in step 3, since both checks run inside this one transaction.
      const requestedByItemId = new Map<number, number>();
      for (const item of items) {
        const itemId = parseInt(item.inventoryItemId as unknown as string);
        if (!itemId || itemId <= 0) continue;
        const qty = parseInt(item.quantity as unknown as string);
        requestedByItemId.set(itemId, (requestedByItemId.get(itemId) ?? 0) + qty);
      }
      // Ascending id order — a stable lock order, so two concurrent sales covering the
      // same pair of items can't each hold one row and wait on the other.
      for (const itemId of [...requestedByItemId.keys()].sort((a, b) => a - b)) {
        const qty = requestedByItemId.get(itemId)!;

        // SELECT FOR UPDATE acquires a row lock — prevents concurrent deductions
        const rows = await tx.execute(
          sql`SELECT id, name, quantity FROM inventory_items WHERE id = ${itemId} AND user_id = ${userId} FOR UPDATE`
        );
        const inv = rows.rows[0] as { id: number; name: string; quantity: number } | undefined;
        // A missing row means the item was deleted, or never belonged to this shop. The
        // decrement in step 3 would quietly match zero rows, leaving a sale line pointing
        // at stock that was never taken out — reject instead of selling a phantom item.
        if (!inv) {
          throw Object.assign(
            new Error(`Item no longer exists in inventory (id ${itemId}). Refresh and try again.`),
            { statusCode: 422 }
          );
        }
        if (Number(inv.quantity) < qty) {
          throw Object.assign(
            new Error(`Insufficient stock for "${inv.name}". Available: ${inv.quantity}, requested: ${qty}.`),
            { statusCode: 422 }
          );
        }
      }

      // 2. Insert the sale record
      const [newSale] = await tx.insert(salesTable).values({
        userId,
        customerId: customerIdNum && customerIdNum > 0 ? customerIdNum : null,
        customerName: data.customerName.trim(),
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        gstAmount: (parseFloat(data.gstAmount) || 0).toString(),
        discountAmount: (parseFloat(data.discountAmount) || 0).toString(),
        exchangeGoldWeight: (parseFloat(data.exchangeGoldWeight) || 0).toString(),
        exchangeGoldValue: (parseFloat(data.exchangeGoldValue) || 0).toString(),
        paymentMode: data.paymentMode ?? "cash",
        bankAccountId,
        salespersonId: data.salespersonId ? parseInt(data.salespersonId) || null : null,
        salespersonName: data.salespersonName ? String(data.salespersonName).trim() || null : null,
        paymentStatus: autoStatus,
        invoiceNumber,
        notes: data.notes ?? null,
      }).returning();

      // 3. Insert line items + atomically decrement inventory
      for (const item of items) {
        const itemId = parseInt(item.inventoryItemId as unknown as string);
        const qty = parseInt(item.quantity as unknown as string);
        const unitPrice = parseFloat(item.unitPrice as unknown as string);
        const makingCharges = parseFloat(item.makingCharges as unknown as string) || 0;
        const discount = parseFloat(item.discount as unknown as string) || 0;

        await tx.insert(saleLineItemsTable).values({
          userId,
          saleId: newSale.id,
          inventoryItemId: itemId || 0,
          itemName: item.itemName || "Item",
          quantity: qty,
          unitPrice: unitPrice.toString(),
          metalRate: (parseFloat(item.metalRate as unknown as string) || 0).toString(),
          goldWeight: (parseFloat(item.goldWeight as unknown as string) || 0).toString(),
          makingCharges: makingCharges.toString(),
          discount: discount.toString(),
          lineTotal: (unitPrice * qty - discount).toString(),
        });

        if (itemId > 0) {
          // Atomic decrement — no read required since we already checked with FOR UPDATE
          await tx.execute(
            sql`UPDATE inventory_items SET quantity = quantity - ${qty} WHERE id = ${itemId} AND user_id = ${userId}`
          );
        }
      }

      // 4. Atomically update customer totals
      if (customerIdNum && customerIdNum > 0) {
        const custId = customerIdNum;
        {
          if (loyaltyEnabled) {
            const pointsEarned = Math.floor(totalAmount / loyaltyRate);
            await tx.execute(
              sql`UPDATE customers
                  SET total_purchases = total_purchases + ${totalAmount}::numeric,
                      loyalty_points   = loyalty_points + ${pointsEarned}
                  WHERE id = ${custId} AND user_id = ${userId}`
            );
          } else {
            await tx.execute(
              sql`UPDATE customers
                  SET total_purchases = total_purchases + ${totalAmount}::numeric
                  WHERE id = ${custId} AND user_id = ${userId}`
            );
          }
        }
      }

      // 5. Record first payment transaction (even for ₹0 credit/pending)
      if (paidAmount > 0) {
        await tx.insert(paymentTransactionsTable).values({
          userId,
          saleId: newSale.id,
          customerId: customerIdNum && customerIdNum > 0 ? customerIdNum : null,
          customerName: data.customerName.trim(),
          amount: paidAmount.toString(),
          paymentMode: data.paymentMode ?? "cash",
          bankAccountId,
          notes: "Initial payment at time of sale",
        });
      }

      // 5b. Old gold taken in exchange becomes real physical stock, not just an accounting
      // entry — without this, the books show "Inventory-Gold" increasing while the
      // inventory_items list (what the shop floor actually sees) never reflects it.
      const exchangeWeight = Math.max(0, parseFloat(data.exchangeGoldWeight) || 0);
      const exchangeValue = Math.max(0, parseFloat(data.exchangeGoldValue) || 0);
      if (exchangeWeight > 0) {
        await tx.insert(inventoryItemsTable).values({
          userId,
          name: `Old Gold — Exchanged (Invoice ${invoiceNumber})`,
          category: "old_gold",
          purity: data.exchangePurity ? String(data.exchangePurity) : "22K",
          grossWeight: exchangeWeight.toFixed(3),
          netWeight: exchangeWeight.toFixed(3),
          makingCharges: "0",
          metalRate: (exchangeValue / exchangeWeight).toFixed(2),
          totalValue: exchangeValue.toFixed(2),
          quantity: 1,
        });
      }

      // 6. Post the journal entry: Dr [Cash/Bank] (cash received) + Dr Old Gold Stock
      // (in-kind exchange) + Dr Accounts Receivable (balance owed) = Cr Sales Revenue
      // (net of GST) + Cr GST Payable. totalAmount is already net of the exchange value,
      // so cash + gold + AR sums back to totalAmount.
      const goldPortion = Math.max(0, parseFloat(data.exchangeGoldValue) || 0);
      const cashPortion = Math.max(0, Math.min(paidAmount, totalAmount - goldPortion));
      const arPortion = Math.max(0, totalAmount - cashPortion - goldPortion);
      const gstAmount = Math.max(0, parseFloat(data.gstAmount) || 0);
      await postJournalEntry(tx, {
        userId,
        voucherDate: newSale.saleDate,
        voucherType: "sales",
        narration: `Sale ${invoiceNumber} to ${data.customerName.trim()}`,
        sourceModule: "sales",
        sourceId: newSale.id,
        lines: [
          { accountId: moneyAccountId, debit: cashPortion, particulars: "Cash/bank received" },
          { accountId: accts.INVENTORY_GOLD, debit: goldPortion, particulars: "Old gold taken in exchange" },
          { accountId: accts.ACCOUNTS_RECEIVABLE, debit: arPortion, partyType: "customer", partyId: customerIdNum && customerIdNum > 0 ? customerIdNum : null, particulars: "Balance owed" },
          { accountId: accts.SALES_REVENUE, credit: totalAmount - gstAmount, particulars: "Sale revenue" },
          { accountId: accts.GST_PAYABLE, credit: gstAmount, particulars: "GST collected" },
        ],
      });

      return newSale;
    });

    res.status(201).json(mapSale(sale));
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 422) return res.status(422).json({ error: e.message });
    req.log.error({ err }, "Failed to create sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, id), eq(salesTable.userId, userId)));
    if (!sale) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(saleLineItemsTable).where(and(eq(saleLineItemsTable.saleId, id), eq(saleLineItemsTable.userId, userId)));
    res.json({
      sale: mapSale(sale),
      items: items.map(item => ({
        id: item.id,
        saleId: item.saleId,
        inventoryItemId: item.inventoryItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice) || 0,
        metalRate: parseFloat(item.metalRate) || 0,
        goldWeight: parseFloat(item.goldWeight) || 0,
        makingCharges: parseFloat(item.makingCharges) || 0,
        discount: parseFloat(item.discount) || 0,
        lineTotal: parseFloat(item.lineTotal) || 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const data = req.body;
    const allowed = ["cash", "upi", "card", "credit", "partial"];
    const updateData: Record<string, unknown> = {};
    if (data.paymentMode !== undefined) {
      if (!allowed.includes(data.paymentMode)) return res.status(400).json({ error: "Invalid paymentMode" });
      updateData.paymentMode = data.paymentMode;
    }
    // paymentStatus is derived from paidAmount (see POST /:id/payments). Letting it be set
    // by hand marks a bill "paid" while money is still owed — or vice versa — so the
    // books and the Pending Payments list disagree. Record a payment instead.
    if (data.paymentStatus !== undefined) {
      return res.status(400).json({ error: "Payment status is calculated automatically — use Collect Payment to record money received" });
    }
    if (data.notes !== undefined) updateData.notes = String(data.notes).slice(0, 500) || null;
    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: "Nothing to update" });
    const [sale] = await db.update(salesTable).set(updateData).where(and(eq(salesTable.id, id), eq(salesTable.userId, userId))).returning();
    if (!sale) return res.status(404).json({ error: "Not found" });
    res.json(mapSale(sale));
  } catch (err) {
    req.log.error({ err }, "Failed to update sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /sales/pending — all sales with outstanding balance
router.get("/pending/list", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { search } = req.query as Record<string, string>;
    const conditions = [
      eq(salesTable.userId, userId),
      inArray(salesTable.paymentStatus, ["partial", "pending"]),
      // A returned sale is cancelled — it owes nothing, whatever its paymentStatus says.
      ne(salesTable.status, "returned"),
    ];
    // Filtered in SQL before the limit, so a search can reach bills older than the newest 200.
    const q = search?.trim();
    if (q) {
      const term = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
      conditions.push(or(ilike(salesTable.customerName, term), ilike(salesTable.invoiceNumber, term))!);
    }
    const sales = await db.select().from(salesTable)
      .where(and(...conditions))
      .orderBy(desc(salesTable.saleDate))
      .limit(500);

    // Attach each customer's mobile so the UI can offer a one-tap WhatsApp payment reminder.
    const custIds = [...new Set(sales.map(s => s.customerId).filter((x): x is number => !!x))];
    const mobiles = custIds.length
      ? await db.select({ id: customersTable.id, mobile: customersTable.mobile }).from(customersTable)
          .where(and(eq(customersTable.userId, userId), inArray(customersTable.id, custIds)))
      : [];
    const mobileById = new Map(mobiles.map(m => [m.id, m.mobile]));

    res.json(sales.map(s => ({ ...mapSale(s), customerMobile: s.customerId ? mobileById.get(s.customerId) ?? null : null })));
  } catch (err) {
    req.log.error({ err }, "Failed to list pending sales");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /sales/:id/payments — payment history for a sale
router.get("/:id/payments", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const txns = await db.select().from(paymentTransactionsTable)
      .where(and(eq(paymentTransactionsTable.saleId, id), eq(paymentTransactionsTable.userId, userId)))
      .orderBy(desc(paymentTransactionsTable.paidAt));
    res.json(txns.map(mapTransaction));
  } catch (err) {
    req.log.error({ err }, "Failed to get payment history");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /sales/:id/payments — record a new payment against a sale
router.post("/:id/payments", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const amount = parseFloat(req.body.amount);
    if (!isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Invalid payment amount" });

    const allowedModes = ["cash", "upi", "card", "bank", "credit", "partial"];
    const paymentMode = allowedModes.includes(req.body.paymentMode) ? req.body.paymentMode : "cash";
    const notes = req.body.notes ? String(req.body.notes).slice(0, 500) : null;
    const bankAccountId = req.body.bankAccountId ? parseInt(req.body.bankAccountId) : null;
    if (bankAccountId && !(await isValidBankAccount(userId, bankAccountId))) {
      return res.status(400).json({ error: "Invalid bank account" });
    }

    const updated = await db.transaction(async (tx) => {
      // FOR UPDATE: two payments recorded at the same moment must queue, otherwise both
      // read the same paidAmount and one of them silently overwrites the other.
      const [sale] = await tx.select().from(salesTable)
        .where(and(eq(salesTable.id, id), eq(salesTable.userId, userId)))
        .for("update");
      if (!sale) throw Object.assign(new Error("Sale not found"), { statusCode: 404 });
      if (sale.status === "returned") throw Object.assign(new Error("This sale was returned — no payment can be collected against it"), { statusCode: 400 });

      const total = parseFloat(sale.totalAmount) || 0;
      const alreadyPaid = parseFloat(sale.paidAmount) || 0;
      const balance = Math.round((total - alreadyPaid) * 100) / 100;
      if (balance <= 0) throw Object.assign(new Error("This bill is already fully paid"), { statusCode: 400 });
      // Receiving more than is owed would credit Accounts Receivable past what was ever
      // debited — the customer ledger would show the shop owing the customer money.
      if (amount > balance + 0.01) throw Object.assign(new Error(`Amount exceeds the balance due of ₹${balance.toLocaleString("en-IN")}`), { statusCode: 400 });
      const newPaid = Math.min(total, alreadyPaid + amount);
      const newStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "pending";

      await tx.insert(paymentTransactionsTable).values({
        userId,
        saleId: id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        amount: amount.toString(),
        paymentMode,
        bankAccountId,
        notes,
      });

      const [updated] = await tx.update(salesTable)
        .set({ paidAmount: newPaid.toString(), paymentStatus: newStatus })
        .where(and(eq(salesTable.id, id), eq(salesTable.userId, userId)))
        .returning();

      const accts = await getOrCreateDefaultAccounts(userId, tx);
      const moneyAccountId = await resolveMoneyAccountId(userId, paymentMode, bankAccountId, accts, tx);
      await postJournalEntry(tx, {
        userId,
        voucherType: "receipt",
        narration: `Payment received against sale ${sale.invoiceNumber}`,
        sourceModule: "sales",
        sourceId: id,
        lines: [
          { accountId: moneyAccountId, debit: amount, particulars: "Payment received" },
          { accountId: accts.ACCOUNTS_RECEIVABLE, credit: amount, partyType: "customer", partyId: sale.customerId, particulars: "Balance settled" },
        ],
      });

      return updated;
    });

    res.json(mapSale(updated));
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 404 || e.statusCode === 400) return res.status(e.statusCode).json({ error: e.message });
    req.log.error({ err }, "Failed to record payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /:id/returns — return history for a sale
router.get("/:id/returns", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const returns = await db.select().from(saleReturnsTable)
      .where(and(eq(saleReturnsTable.saleId, id), eq(saleReturnsTable.userId, userId)))
      .orderBy(desc(saleReturnsTable.returnDate));
    res.json(returns.map(r => ({
      id: r.id, saleId: r.saleId, returnDate: r.returnDate.toISOString(),
      totalRefund: safeFloat(r.totalRefund), refundMode: r.refundMode, notes: r.notes,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get sale returns");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:id/return — full-sale return/cancellation: restocks inventory, reverses every
// journal entry ever posted against this sale (the original sale + any later payments),
// reduces the customer's totalPurchases, and marks the sale returned. Loyalty points earned
// are deliberately left untouched — the exact rate in effect at sale time isn't stored, so
// clawing back an approximate amount would risk being wrong in either direction.
router.post("/:id/return", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const refundModeInput = req.body?.refundMode;
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 500) : null;

    // Everything — the status check, restock, return record, customer totals and the journal
    // reversals — runs in ONE transaction under a row lock on the sale. Previously the
    // "already returned?" check sat outside it, so a double-click restocked inventory twice,
    // and the reversals ran afterwards in separate transactions: a crash partway left a
    // returned sale whose books were never reversed.
    const updated = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(salesTable)
        .where(and(eq(salesTable.id, id), eq(salesTable.userId, userId)))
        .for("update");
      if (!sale) throw Object.assign(new Error("Not found"), { statusCode: 404 });
      if (sale.status === "returned") throw Object.assign(new Error("Sale already returned"), { statusCode: 400 });

      const refundMode = ["cash", "upi", "card", "bank"].includes(refundModeInput) ? refundModeInput : sale.paymentMode;
      const totalRefund = safeFloat(sale.paidAmount);
      const totalAmount = safeFloat(sale.totalAmount);

      const items = await tx.select().from(saleLineItemsTable).where(and(eq(saleLineItemsTable.saleId, id), eq(saleLineItemsTable.userId, userId)));
      const vouchers = await tx.select().from(journalVouchersTable)
        .where(and(eq(journalVouchersTable.userId, userId), eq(journalVouchersTable.sourceModule, "sales"), eq(journalVouchersTable.sourceId, id)));

      // Restock every line item that references a real inventory item
      for (const item of items) {
        if (item.inventoryItemId > 0) {
          await tx.execute(sql`UPDATE inventory_items SET quantity = quantity + ${item.quantity} WHERE id = ${item.inventoryItemId} AND user_id = ${userId}`);
        }
      }

      // The old gold taken in exchange goes back to the customer with the cancelled sale —
      // zero its stock row, otherwise the shop floor keeps counting metal it no longer holds
      // (the journal reversal below already removes it from Inventory-Gold on the books).
      if (safeFloat(sale.exchangeGoldWeight) > 0) {
        await tx.execute(sql`UPDATE inventory_items SET quantity = 0 WHERE user_id = ${userId} AND category = 'old_gold' AND name = ${`Old Gold — Exchanged (Invoice ${sale.invoiceNumber})`}`);
      }

      await tx.insert(saleReturnsTable).values({
        userId, saleId: id, totalRefund: totalRefund.toFixed(2), refundMode, notes,
      });

      const [u] = await tx.update(salesTable).set({ status: "returned" })
        .where(and(eq(salesTable.id, id), eq(salesTable.userId, userId)))
        .returning();

      if (sale.customerId) {
        await tx.execute(sql`UPDATE customers SET total_purchases = GREATEST(0, total_purchases - ${totalAmount}::numeric) WHERE id = ${sale.customerId} AND user_id = ${userId}`);
      }

      // Reverse every live voucher tied to this sale (the original sale entry plus any
      // payment-collection entries). Reversal vouchers carry the same sourceId, so skip those.
      for (const v of vouchers) {
        if (!v.reversedByVoucherId && !v.reversesVoucherId) {
          await reverseVoucherTx(tx, userId, v.id, `Return of sale ${sale.invoiceNumber}`);
        }
      }

      return u;
    });

    res.json(mapSale(updated));
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 404 || e.statusCode === 400) return res.status(e.statusCode).json({ error: e.message });
    req.log.error({ err }, "Failed to return sale");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
