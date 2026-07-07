import { Router } from "express";
import { db } from "@workspace/db";
import { girviLoansTable, girviPaymentsTable, girviLoanItemsTable, girviCustomersTable, girviPartialReleasesTable, girviPartialReleaseItemsTable } from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  safeFloat, mapLoan, mapPayment, calcAccruedInterest, preserveOutstandingBaseline,
  ensureDefaultBranch, getOrCreateGirviSettings, nextGirviNumber, computeLoanAggregatesFromItems,
  VALID_METAL_TYPES, VALID_STATUSES, VALID_PERIODS, VALID_PAYMENT_MODES, VALID_PAYMENT_TYPES,
  MAX_NOTES_LEN, MAX_ADDRESS_LEN,
} from "./girvi-helpers";
import { postJournalEntry, getOrCreateDefaultAccounts, cashOrBankKey } from "./accounting-helpers";

const router = Router();

router.get("/stats/summary", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const settings = await getOrCreateGirviSettings(userId);
    const graceDays = settings.overdueGraceDays;
    const loans = await db.select().from(girviLoansTable)
      .where(eq(girviLoansTable.userId, userId))
      .orderBy(desc(girviLoansTable.createdAt));
    const now = new Date();
    const active = loans.filter(l => l.status === "active" || l.status === "extended");
    const overdue = active.filter(l => new Date(l.dueDate) < now);
    const totalLent = active.reduce((s, l) => {
      const principalPaid = safeFloat((l as any).principalPaid ?? "0");
      return s + Math.max(0, safeFloat(l.loanAmount) - principalPaid);
    }, 0);
    const totalInterest = active.reduce((s, l) => s + calcAccruedInterest(l, now, graceDays).total, 0);
    const totalLoss = loans.filter(l => l.status === "forfeited").reduce((s, l) => s + safeFloat(l.lossAmount), 0);
    const totalCollected = loans.reduce((s, l) => s + safeFloat(l.totalInterestCollected), 0);
    const totalProcessingFees = loans.reduce((s, l) => s + safeFloat(l.processingFee), 0);
    const totalGoldWeight = active.filter(l => l.metalType === "gold").reduce((s, l) => s + safeFloat(l.grossWeight), 0);
    const totalSilverWeight = active.filter(l => l.metalType === "silver").reduce((s, l) => s + safeFloat(l.grossWeight), 0);
    const dueSoon = active.filter(l => {
      const d = new Date(l.dueDate);
      return d >= now && d <= new Date(now.getTime() + 7 * 86400000);
    });

    res.json({
      totalActive: active.length,
      totalLent: Math.round(totalLent),
      totalInterestAccrued: Math.round(totalInterest),
      totalInterestCollected: Math.round(totalCollected),
      totalProcessingFees: Math.round(totalProcessingFees),
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      totalLoss: Math.round(totalLoss),
      totalLoans: loans.length,
      totalGoldWeight: Math.round(totalGoldWeight * 1000) / 1000,
      totalSilverWeight: Math.round(totalSilverWeight * 1000) / 1000,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const settings = await getOrCreateGirviSettings(userId);
    const { status, due, mobile, customerId, branchId } = req.query as Record<string, string>;
    let loans = await db.select().from(girviLoansTable)
      .where(eq(girviLoansTable.userId, userId))
      .orderBy(desc(girviLoansTable.createdAt));
    const now = new Date();
    if (mobile) {
      const digits = mobile.replace(/\D/g, "");
      if (digits) loans = loans.filter(l => l.customerMobile.replace(/\D/g, "").includes(digits));
    }
    if (customerId) {
      const cid = parseInt(customerId);
      if (!isNaN(cid)) loans = loans.filter(l => l.customerId === cid);
    }
    if (branchId) {
      const bid = parseInt(branchId);
      if (!isNaN(bid)) loans = loans.filter(l => l.branchId === bid);
    }
    if (status && status !== "all" && VALID_STATUSES.has(status)) {
      loans = loans.filter(l => l.status === status);
    } else if (status && status !== "all") {
      loans = [];
    }
    if (due === "overdue") {
      loans = loans.filter(l => (l.status === "active" || l.status === "extended") && new Date(l.dueDate) < now);
    } else if (due === "today") {
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
      loans = loans.filter(l => (l.status === "active" || l.status === "extended") && new Date(l.dueDate) >= now && new Date(l.dueDate) <= endOfDay);
    } else if (due === "week") {
      const in7 = new Date(now.getTime() + 7 * 86400000);
      loans = loans.filter(l => (l.status === "active" || l.status === "extended") && new Date(l.dueDate) >= now && new Date(l.dueDate) <= in7);
    }
    res.json(loans.map(l => mapLoan(l, new Date(), settings.overdueGraceDays)));
  } catch (err) {
    req.log.error({ err }, "Failed to list girvi loans");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;

    // Resolve the customer: either an existing girvi_customers row, or create
    // one inline as part of this transaction.
    let customer: typeof girviCustomersTable.$inferSelect | null = null;
    if (data.customerId) {
      const cid = parseInt(data.customerId);
      if (isNaN(cid)) return res.status(400).json({ error: "Invalid customerId" });
      const [found] = await db.select().from(girviCustomersTable)
        .where(and(eq(girviCustomersTable.id, cid), eq(girviCustomersTable.userId, userId)));
      if (!found) return res.status(404).json({ error: "Customer not found" });
      customer = found;
    } else if (data.newCustomer) {
      const nc = data.newCustomer;
      const name = String(nc.name ?? "").trim();
      const mobile = String(nc.mobile ?? "").trim();
      if (!name) return res.status(400).json({ error: "Customer name is required" });
      if (!mobile) return res.status(400).json({ error: "Customer mobile is required" });
      const [created] = await db.insert(girviCustomersTable).values({
        userId,
        name,
        mobile,
        fatherName: nc.fatherName ? String(nc.fatherName).trim() || null : null,
        address: nc.address ? String(nc.address).slice(0, MAX_ADDRESS_LEN) || null : null,
        altMobile: nc.altMobile ? String(nc.altMobile).trim() || null : null,
        email: nc.email ? String(nc.email).trim() || null : null,
        idProofType: nc.idProofType ? String(nc.idProofType).trim() || null : null,
        idProofNumber: nc.idProofNumber ? String(nc.idProofNumber).trim() || null : null,
        pan: nc.pan ? String(nc.pan).trim().toUpperCase() || null : null,
        notes: nc.notes ? String(nc.notes).slice(0, MAX_NOTES_LEN) || null : null,
      }).returning();
      customer = created;
    } else {
      return res.status(400).json({ error: "Either customerId or newCustomer is required" });
    }

    const loanAmount = safeFloat(data.loanAmount);
    const interestRate = safeFloat(data.interestRate, 2);
    const penaltyRate = safeFloat(data.penaltyRate, 0);
    const processingFee = safeFloat(data.processingFee, 0);
    if (loanAmount <= 0) return res.status(400).json({ error: "Loan amount must be positive" });
    if (interestRate < 0 || interestRate > 100) return res.status(400).json({ error: "Interest rate must be 0–100" });
    if (penaltyRate < 0 || penaltyRate > 100) return res.status(400).json({ error: "Penalty rate must be 0–100" });
    if (processingFee < 0) return res.status(400).json({ error: "Processing fee cannot be negative" });

    const interestPeriod = VALID_PERIODS.has(data.interestPeriod) ? data.interestPeriod : "monthly";
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const dueDate = data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 90 * 86400000);
    if (isNaN(startDate.getTime())) return res.status(400).json({ error: "Invalid start date" });
    if (isNaN(dueDate.getTime())) return res.status(400).json({ error: "Invalid due date" });
    if (dueDate <= startDate) return res.status(400).json({ error: "Due date must be after start date" });

    const notes = data.notes ? String(data.notes).slice(0, MAX_NOTES_LEN) : null;

    let branchId = data.branchId ? parseInt(data.branchId) : NaN;
    if (isNaN(branchId)) branchId = await ensureDefaultBranch(userId);

    // Parse items array
    type ItemInput = { itemType: string; quantity: number; metalType: string; purity: string; grossWeight: number; netWeight: number; estimatedValue: number; notes?: string };
    const rawItems: ItemInput[] = Array.isArray(data.items) ? data.items : [];
    if (rawItems.length === 0) return res.status(400).json({ error: "At least one item is required" });

    const items = rawItems.map(it => ({
      itemType: String(it.itemType ?? "Item").trim() || "Item",
      quantity: Math.max(1, parseInt(String(it.quantity)) || 1),
      metalType: VALID_METAL_TYPES.has(it.metalType) ? it.metalType : "gold",
      purity: String(it.purity ?? "22K").trim() || "22K",
      grossWeight: safeFloat(it.grossWeight),
      netWeight: safeFloat(it.netWeight ?? it.grossWeight, safeFloat(it.grossWeight)),
      estimatedValue: safeFloat(it.estimatedValue),
      notes: it.notes ? String(it.notes).slice(0, MAX_NOTES_LEN) : null,
    }));

    const invalidItem = items.find(it => it.grossWeight <= 0);
    if (invalidItem) return res.status(400).json({ error: `Item "${invalidItem.itemType}" must have a positive gross weight` });

    // Aggregate totals across all items (helper expects line totals, not per-unit)
    const lineTotals = items.map(it => ({ ...it, grossWeight: it.grossWeight * it.quantity, netWeight: it.netWeight * it.quantity, estimatedValue: it.estimatedValue * it.quantity }));
    const { grossWeight: totalGrossWeight, netWeight: totalNetWeight, estimatedValue: totalEstimatedValue, metalType: primaryMetal, purity: primaryPurity, itemDescription: autoDesc } = computeLoanAggregatesFromItems(lineTotals);

    const settings = await getOrCreateGirviSettings(userId);
    const loanNumber = await nextGirviNumber(userId, "loan", settings.receiptPrefix, startDate);
    const accts = await getOrCreateDefaultAccounts(userId);

    const loan = await db.transaction(async tx => {
      const [newLoan] = await tx.insert(girviLoansTable).values({
        userId,
        loanNumber,
        branchId,
        customerId: customer!.id,
        customerName: customer!.name,
        customerMobile: customer!.mobile,
        fatherName: customer!.fatherName,
        address: customer!.address,
        kycDocType: customer!.idProofType,
        kycDocNumber: customer!.idProofNumber,
        pan: customer!.pan,
        itemDescription: autoDesc,
        metalType: primaryMetal,
        purity: primaryPurity,
        grossWeight: totalGrossWeight.toFixed(3),
        netWeight: totalNetWeight.toFixed(3),
        estimatedValue: totalEstimatedValue.toFixed(2),
        loanAmount: loanAmount.toString(),
        processingFee: processingFee.toString(),
        interestRate: interestRate.toString(),
        penaltyRate: penaltyRate.toString(),
        interestPeriod,
        startDate,
        dueDate,
        status: "active",
        totalInterestCollected: "0",
        notes,
      }).returning();

      for (const it of items) {
        await tx.insert(girviLoanItemsTable).values({
          userId,
          loanId: newLoan.id,
          itemType: it.itemType,
          quantity: it.quantity,
          metalType: it.metalType,
          purity: it.purity,
          grossWeight: (it.grossWeight * it.quantity).toFixed(3),
          netWeight: (it.netWeight * it.quantity).toFixed(3),
          estimatedValue: (it.estimatedValue * it.quantity).toFixed(2),
          notes: it.notes,
          status: "pledged",
          currentBranchId: branchId,
        });
      }

      // Dr Girvi Loans Receivable (loanAmount) / Cr Cash (loanAmount - processingFee) +
      // Cr Processing Fee Income (processingFee) — cash disbursed net of the upfront fee.
      const disbursed = loanAmount - processingFee;
      await postJournalEntry(tx, {
        userId,
        voucherDate: startDate,
        voucherType: "payment",
        narration: `Girvi loan ${loanNumber} disbursed to ${customer!.name}`,
        sourceModule: "girvi",
        sourceId: newLoan.id,
        lines: [
          { accountId: accts.GIRVI_LOANS_RECEIVABLE, debit: loanAmount, partyType: "girvi_customer", partyId: customer!.id, particulars: "Loan disbursed" },
          { accountId: accts.CASH, credit: disbursed, particulars: "Cash disbursed" },
          { accountId: accts.PROCESSING_FEE_INCOME, credit: processingFee, particulars: "Processing fee" },
        ],
      });

      return newLoan;
    });

    res.status(201).json(mapLoan(loan, new Date(), settings.overdueGraceDays));
  } catch (err) {
    req.log.error({ err }, "Failed to create girvi loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [loan] = await db.select().from(girviLoansTable).where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    const settings = await getOrCreateGirviSettings(userId);
    const payments = await db.select().from(girviPaymentsTable)
      .where(and(eq(girviPaymentsTable.loanId, id), eq(girviPaymentsTable.userId, userId)))
      .orderBy(desc(girviPaymentsTable.paymentDate));
    res.json({ loan: mapLoan(loan, new Date(), settings.overdueGraceDays), payments: payments.map(mapPayment) });
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/items", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [loan] = await db.select({ id: girviLoansTable.id }).from(girviLoansTable)
      .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    const items = await db.select().from(girviLoanItemsTable)
      .where(and(eq(girviLoanItemsTable.loanId, id), eq(girviLoanItemsTable.userId, userId)));
    res.json(items.map(it => ({
      id: it.id,
      itemType: it.itemType,
      quantity: it.quantity,
      metalType: it.metalType,
      purity: it.purity,
      grossWeight: safeFloat(it.grossWeight),
      netWeight: safeFloat(it.netWeight),
      estimatedValue: safeFloat(it.estimatedValue),
      notes: it.notes,
      status: it.status,
      currentBranchId: it.currentBranchId,
      returnedAt: it.returnedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get girvi items");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Return a subset of a loan's pledged items while the loan stays active for
// the rest, against an optional (lender-decided) paydown. See VALID_PAYMENT_TYPES
// note on collect-interest for why the interest/principal split logic is
// duplicated in spirit here — this reuses the exact same allocation rule.
router.post("/:id/partial-release", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [loan] = await db.select().from(girviLoansTable).where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    if (loan.status !== "active" && loan.status !== "extended") {
      return res.status(400).json({ error: "Can only release items from active or extended loans" });
    }

    const { itemIds, amount, paymentMode, notes } = req.body;
    const requestedIds: number[] = Array.isArray(itemIds) ? itemIds.map((n: unknown) => parseInt(String(n))).filter((n: number) => !isNaN(n)) : [];
    if (requestedIds.length === 0) return res.status(400).json({ error: "Select at least one item to release" });

    const allItems = await db.select().from(girviLoanItemsTable).where(and(eq(girviLoanItemsTable.loanId, id), eq(girviLoanItemsTable.userId, userId)));
    const pledgedItems = allItems.filter(it => it.status === "pledged");
    const releaseItems = pledgedItems.filter(it => requestedIds.includes(it.id));
    if (releaseItems.length !== requestedIds.length) {
      return res.status(400).json({ error: "One or more selected items are not currently pledged on this loan" });
    }
    const remainingItems = pledgedItems.filter(it => !requestedIds.includes(it.id));
    if (remainingItems.length === 0) {
      return res.status(400).json({ error: "This would release every pledged item — use Redeem to close out the loan instead" });
    }

    const amt = safeFloat(amount, 0);
    if (amt < 0) return res.status(400).json({ error: "Amount cannot be negative" });
    const resolvedNotes = notes ? String(notes).slice(0, MAX_NOTES_LEN) : null;
    const resolvedMode = VALID_PAYMENT_MODES.has(paymentMode) ? paymentMode : "cash";
    const now = new Date();

    const settings = await getOrCreateGirviSettings(userId);
    const mappedLoan = mapLoan(loan, now, settings.overdueGraceDays);
    const outstandingInterest = mappedLoan.outstandingInterest;
    const currentPrincipal = mappedLoan.currentPrincipal;
    if (amt > mappedLoan.totalDue + 0.01) {
      return res.status(400).json({ error: `Amount exceeds total amount due (₹${mappedLoan.totalDue.toFixed(2)})` });
    }

    // Same interest-then-principal split as collect-interest's "auto" mode.
    const interestPortion = Math.min(amt, outstandingInterest);
    const principalPortion = Math.min(Math.max(0, amt - interestPortion), currentPrincipal);
    const newPrincipalPaid = safeFloat((loan as any).principalPaid ?? "0") + principalPortion;
    const newTotalInterestCollected = safeFloat(loan.totalInterestCollected) + interestPortion;

    const remainingAggregates = computeLoanAggregatesFromItems(remainingItems.map(it => ({
      itemType: it.itemType, quantity: it.quantity, metalType: it.metalType, purity: it.purity,
      grossWeight: safeFloat(it.grossWeight), netWeight: safeFloat(it.netWeight), estimatedValue: safeFloat(it.estimatedValue),
    })));
    const releasedDescription = releaseItems.map(it => `${it.quantity} ${it.itemType}${it.quantity > 1 ? "s" : ""}`).join(", ");

    const releaseNumber = await nextGirviNumber(userId, "partial_release", settings.partialReleasePrefix, now);
    const accts = await getOrCreateDefaultAccounts(userId);

    const loanUpdates: Record<string, unknown> = {
      grossWeight: remainingAggregates.grossWeight.toFixed(3),
      netWeight: remainingAggregates.netWeight.toFixed(3),
      estimatedValue: remainingAggregates.estimatedValue.toFixed(2),
      metalType: remainingAggregates.metalType,
      purity: remainingAggregates.purity,
      itemDescription: remainingAggregates.itemDescription,
      updatedAt: now,
    };
    if (amt > 0) {
      loanUpdates.principalPaid = newPrincipalPaid.toFixed(2);
      loanUpdates.totalInterestCollected = newTotalInterestCollected.toFixed(2);
      // Reset the interest clock on the reduced principal, same as a normal paydown.
      loanUpdates.startDate = now;
      loanUpdates.interestBaseline = newTotalInterestCollected.toFixed(2);
    }

    const { updatedLoan, release } = await db.transaction(async tx => {
      const [createdRelease] = await tx.insert(girviPartialReleasesTable).values({
        userId, loanId: id, releaseNumber, releaseDate: now,
        itemsDescription: releasedDescription,
        principalSettled: principalPortion.toFixed(2),
        interestSettled: interestPortion.toFixed(2),
        notes: resolvedNotes,
      }).returning();

      for (const it of releaseItems) {
        await tx.insert(girviPartialReleaseItemsTable).values({ userId, releaseId: createdRelease.id, loanItemId: it.id });
      }

      await tx.update(girviLoanItemsTable)
        .set({ status: "returned", returnedAt: now })
        .where(and(eq(girviLoanItemsTable.userId, userId), inArray(girviLoanItemsTable.id, requestedIds)));

      if (amt > 0) {
        if (interestPortion > 0) {
          await tx.insert(girviPaymentsTable).values({
            userId, loanId: id, loanNumber: loan.loanNumber, customerName: loan.customerName,
            amount: interestPortion.toFixed(2), paymentType: "interest", paymentMode: resolvedMode, paymentDate: now,
            notes: resolvedNotes ? `${resolvedNotes} [partial release ${releaseNumber}]` : `Partial release ${releaseNumber}: interest portion`,
          });
        }
        if (principalPortion > 0) {
          await tx.insert(girviPaymentsTable).values({
            userId, loanId: id, loanNumber: loan.loanNumber, customerName: loan.customerName,
            amount: principalPortion.toFixed(2), paymentType: "principal", paymentMode: resolvedMode, paymentDate: now,
            notes: resolvedNotes ? `${resolvedNotes} [partial release ${releaseNumber}]` : `Partial release ${releaseNumber}: principal portion`,
          });
        }
      }

      const [u] = await tx.update(girviLoansTable)
        .set(loanUpdates as Partial<typeof girviLoansTable.$inferInsert>)
        .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
        .returning();

      if (amt > 0) {
        await postJournalEntry(tx, {
          userId,
          voucherDate: now,
          voucherType: "receipt",
          narration: `Partial release ${releaseNumber} on girvi loan ${loan.loanNumber}`,
          sourceModule: "girvi",
          sourceId: id,
          lines: [
            { accountId: accts[cashOrBankKey(resolvedMode)], debit: amt, particulars: "Payment received" },
            ...(interestPortion > 0 ? [{ accountId: accts.INTEREST_INCOME, credit: interestPortion, particulars: "Interest portion" }] : []),
            ...(principalPortion > 0 ? [{ accountId: accts.GIRVI_LOANS_RECEIVABLE, credit: principalPortion, partyType: "girvi_customer" as const, partyId: loan.customerId ?? undefined, particulars: "Principal portion" }] : []),
          ],
        });
      }

      return { updatedLoan: u, release: createdRelease };
    });

    res.status(201).json({
      loan: mapLoan(updatedLoan, now, settings.overdueGraceDays),
      release: {
        id: release.id,
        releaseNumber: release.releaseNumber,
        releaseDate: release.releaseDate.toISOString(),
        itemsDescription: release.itemsDescription,
        principalSettled: safeFloat(release.principalSettled),
        interestSettled: safeFloat(release.interestSettled),
        notes: release.notes,
      },
      releasedItems: releaseItems.map(it => ({
        id: it.id, itemType: it.itemType, quantity: it.quantity, metalType: it.metalType, purity: it.purity,
        grossWeight: safeFloat(it.grossWeight), netWeight: safeFloat(it.netWeight), estimatedValue: safeFloat(it.estimatedValue),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to process partial release");
    res.status(500).json({ error: "Internal server error" });
  }
});

// History of partial releases for a loan (expanded detail view + voucher reprint)
router.get("/:id/partial-releases", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const releases = await db.select().from(girviPartialReleasesTable)
      .where(and(eq(girviPartialReleasesTable.loanId, id), eq(girviPartialReleasesTable.userId, userId)))
      .orderBy(desc(girviPartialReleasesTable.releaseDate));
    res.json(releases.map(r => ({
      id: r.id,
      releaseNumber: r.releaseNumber,
      releaseDate: r.releaseDate.toISOString(),
      itemsDescription: r.itemsDescription,
      principalSettled: safeFloat(r.principalSettled),
      interestSettled: safeFloat(r.interestSettled),
      notes: r.notes,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get partial release history");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Record a payment — supports interest, penalty, and smart auto-allocation.
// paymentType: "auto" (default) | "interest" | "penalty"
//
// "auto" logic:
//   - If amount ≤ outstanding interest → pure interest payment, clock unchanged
//   - If amount > outstanding interest:
//       interest portion = outstanding interest
//       principal portion = amount - outstandingInterest
//       → totalInterestCollected += interestPortion
//       → principalPaid += principalPortion
//       → startDate reset to now (interest restarts on reduced principal)
//       → interestBaseline set to new totalInterestCollected (fixes post-reset calc)
//       → if currentPrincipal - principalPortion ≤ 0: auto-redeem
//
// "interest" / "penalty" → simple accumulation, no principal change.
// "waiver" → the lender forgives some/all of the outstanding interest (e.g. a
// customer ran well past the grace period but the lender chooses not to
// charge for it). No cash changes hands — recorded as its own payment type so
// reports don't count it as real interest income, but it still clears the
// loan's outstanding-interest ledger the same way a real payment would.
router.post("/:id/collect-interest", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [loan] = await db.select().from(girviLoansTable)
      .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    if (loan.status !== "active" && loan.status !== "extended") {
      return res.status(400).json({ error: "Can only collect payments on active or extended loans" });
    }

    const { amount, paymentType = "auto", notes, paymentMode, referenceNumber } = req.body;
    if (!VALID_PAYMENT_TYPES.has(paymentType)) return res.status(400).json({ error: "Invalid payment type" });
    const amt = safeFloat(amount);
    if (amt <= 0 || !isFinite(amt)) return res.status(400).json({ error: "Amount must be a positive number" });
    const resolvedNotes = notes ? String(notes).slice(0, MAX_NOTES_LEN) : null;
    const resolvedMode = VALID_PAYMENT_MODES.has(paymentMode) ? paymentMode : "cash";
    const resolvedRef = referenceNumber ? String(referenceNumber).trim().slice(0, 100) || null : null;
    const now = new Date();

    const settings = await getOrCreateGirviSettings(userId);
    const mappedLoan = mapLoan(loan, now, settings.overdueGraceDays);
    const outstandingInterest = mappedLoan.outstandingInterest;
    const currentPrincipal = mappedLoan.currentPrincipal;

    if (paymentType === "auto" && amt > mappedLoan.totalDue + 0.01) {
      return res.status(400).json({ error: `Amount exceeds total amount due (₹${mappedLoan.totalDue.toFixed(2)})` });
    }
    if (paymentType === "waiver" && amt > outstandingInterest + 0.01) {
      return res.status(400).json({ error: `Cannot waive more than the outstanding interest (₹${outstandingInterest.toFixed(2)})` });
    }

    let updated: typeof girviLoansTable.$inferSelect;
    const accts = await getOrCreateDefaultAccounts(userId);

    if (paymentType === "auto" && amt > outstandingInterest) {
      // Smart allocation: settle interest first, remainder reduces principal
      const interestPortion = Math.min(amt, outstandingInterest);
      // Cap principal portion at current principal to prevent overpayment
      const principalPortion = Math.min(amt - interestPortion, currentPrincipal);
      const newPrincipalPaid = safeFloat((loan as any).principalPaid ?? "0") + principalPortion;
      const remainingPrincipal = Math.max(0, safeFloat(loan.loanAmount) - newPrincipalPaid);
      const newTotalInterestCollected = safeFloat(loan.totalInterestCollected) + interestPortion;

      const loanUpdates: Record<string, unknown> = {
        totalInterestCollected: newTotalInterestCollected.toFixed(2),
        principalPaid: newPrincipalPaid.toFixed(2),
        // Reset interest clock so future interest accrues on reduced principal
        startDate: now,
        // Baseline = new totalInterestCollected so outstanding correctly starts at 0 post-reset
        interestBaseline: newTotalInterestCollected.toFixed(2),
      };

      let returnVoucherNumber: string | null = null;
      if (remainingPrincipal <= 0) {
        // Loan fully repaid
        returnVoucherNumber = await nextGirviNumber(userId, "return", settings.returnPrefix, now);
        loanUpdates.status = "redeemed";
        loanUpdates.redeemedDate = now;
        loanUpdates.redeemedAmount = amt.toFixed(2);
        loanUpdates.returnVoucherNumber = returnVoucherNumber;
      }

      // Single atomic transaction: payments + loan update together
      updated = await db.transaction(async tx => {
        if (interestPortion > 0) {
          await tx.insert(girviPaymentsTable).values({
            userId, loanId: id, loanNumber: loan.loanNumber,
            customerName: loan.customerName,
            amount: interestPortion.toFixed(2),
            paymentType: "interest",
            paymentMode: resolvedMode,
            referenceNumber: resolvedRef,
            paymentDate: now,
            notes: resolvedNotes ? `${resolvedNotes} [auto: interest portion]` : "Auto: interest portion",
          });
        }
        await tx.insert(girviPaymentsTable).values({
          userId, loanId: id, loanNumber: loan.loanNumber,
          customerName: loan.customerName,
          amount: principalPortion.toFixed(2),
          paymentType: "principal",
          paymentMode: resolvedMode,
          referenceNumber: resolvedRef,
          paymentDate: now,
          notes: resolvedNotes ? `${resolvedNotes} [auto: principal portion]` : "Auto: principal portion",
        });
        if (remainingPrincipal <= 0) {
          await tx.update(girviLoanItemsTable)
            .set({ status: "returned", returnedAt: now })
            .where(and(eq(girviLoanItemsTable.loanId, id), eq(girviLoanItemsTable.userId, userId)));
        }
        const [u] = await tx.update(girviLoansTable)
          .set(loanUpdates as Partial<typeof girviLoansTable.$inferInsert>)
          .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
          .returning();

        await postJournalEntry(tx, {
          userId,
          voucherDate: now,
          voucherType: "receipt",
          narration: `Payment collected on girvi loan ${loan.loanNumber}`,
          sourceModule: "girvi",
          sourceId: id,
          lines: [
            { accountId: accts[cashOrBankKey(resolvedMode)], debit: amt, particulars: "Payment received" },
            { accountId: accts.INTEREST_INCOME, credit: interestPortion, particulars: "Interest portion" },
            { accountId: accts.GIRVI_LOANS_RECEIVABLE, credit: principalPortion, partyType: "girvi_customer", partyId: loan.customerId ?? undefined, particulars: "Principal portion" },
          ],
        });

        return u;
      });

    } else {
      // Interest-only, penalty, or waiver — simple accumulation, no principal/clock change.
      // A waiver still clears the outstanding-interest ledger (totalInterestCollected) exactly
      // like a real payment would, but is also tracked separately in interestWaived (informational
      // only) so the loan/reports can distinguish cash actually received from interest forgiven.
      const resolvedType = paymentType === "penalty" ? "penalty" : paymentType === "waiver" ? "waiver" : "interest";
      updated = await db.transaction(async tx => {
        await tx.insert(girviPaymentsTable).values({
          userId, loanId: id, loanNumber: loan.loanNumber,
          customerName: loan.customerName,
          amount: amt.toFixed(2),
          paymentType: resolvedType,
          paymentMode: resolvedMode,
          referenceNumber: resolvedRef,
          paymentDate: now,
          notes: resolvedNotes,
        });
        const [u] = await tx.update(girviLoansTable)
          .set({
            totalInterestCollected: sql`COALESCE(${girviLoansTable.totalInterestCollected}, 0) + ${amt.toFixed(2)}::numeric`,
            ...(resolvedType === "waiver" ? { interestWaived: sql`COALESCE(${girviLoansTable.interestWaived}, 0) + ${amt.toFixed(2)}::numeric` } : {}),
          })
          .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
          .returning();

        // A waiver moves no cash and was never booked as a receivable in this cash-basis
        // model, so there's nothing to post — see VALID_PAYMENT_TYPES comment.
        if (resolvedType !== "waiver") {
          await postJournalEntry(tx, {
            userId,
            voucherDate: now,
            voucherType: "receipt",
            narration: `${resolvedType === "penalty" ? "Penalty" : "Interest"} collected on girvi loan ${loan.loanNumber}`,
            sourceModule: "girvi",
            sourceId: id,
            lines: [
              { accountId: accts[cashOrBankKey(resolvedMode)], debit: amt, particulars: "Payment received" },
              { accountId: accts.INTEREST_INCOME, credit: amt, particulars: resolvedType === "penalty" ? "Penalty interest" : "Interest" },
            ],
          });
        }

        return u;
      });
    }

    res.json(mapLoan(updated, new Date(), settings.overdueGraceDays));
  } catch (err) {
    req.log.error({ err }, "Failed to collect payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Renew loan — collect interest + reset start date so interest clock restarts from today
router.post("/:id/renew", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [loan] = await db.select().from(girviLoansTable).where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });
    if (loan.status !== "active" && loan.status !== "extended") {
      return res.status(400).json({ error: "Can only renew active or extended loans" });
    }

    const { interestPaid, newDueDate, notes, paymentMode, referenceNumber } = req.body;
    const paid = safeFloat(interestPaid, 0);
    if (paid < 0 || !isFinite(paid)) return res.status(400).json({ error: "Interest amount must be zero or positive" });

    const renewedDueDate = newDueDate ? new Date(newDueDate) : new Date(Date.now() + 90 * 86400000);
    if (isNaN(renewedDueDate.getTime())) return res.status(400).json({ error: "Invalid new due date" });

    const resolvedNotes = notes ? String(notes).slice(0, MAX_NOTES_LEN) : null;
    const resolvedMode = VALID_PAYMENT_MODES.has(paymentMode) ? paymentMode : "cash";
    const resolvedRef = referenceNumber ? String(referenceNumber).trim().slice(0, 100) || null : null;
    const mergedNotes = resolvedNotes
      ? (loan.notes ? `${loan.notes}\n${resolvedNotes}`.slice(0, MAX_NOTES_LEN) : resolvedNotes)
      : loan.notes;

    const now = new Date();
    const settings = await getOrCreateGirviSettings(userId);
    const { total: accruedBeforeRenewal } = calcAccruedInterest(loan, now, settings.overdueGraceDays);
    const interestBaselineBefore = safeFloat((loan as any).interestBaseline ?? "0");
    const collectedSinceReset = Math.max(0, safeFloat(loan.totalInterestCollected) - interestBaselineBefore);
    const outstandingBeforeRenewal = Math.max(0, accruedBeforeRenewal - collectedSinceReset);

    const accts = await getOrCreateDefaultAccounts(userId);

    // Reset the clock, but if the interest paid doesn't cover what was already accrued,
    // carry the shortfall forward as already-outstanding on the fresh cycle instead of
    // writing it off — otherwise unpaid interest simply vanishes on renewal.
    const newTotalCollected = safeFloat(loan.totalInterestCollected) + paid;
    const newInterestBaseline = newTotalCollected + Math.max(0, outstandingBeforeRenewal - paid);

    const updated = await db.transaction(async (tx) => {
      if (paid > 0) {
        await tx.insert(girviPaymentsTable).values({
          userId,
          loanId: id,
          loanNumber: loan.loanNumber,
          customerName: loan.customerName,
          amount: paid.toString(),
          paymentType: "renewal",
          paymentMode: resolvedMode,
          referenceNumber: resolvedRef,
          paymentDate: now,
          notes: resolvedNotes,
        });
      }

      const [u] = await tx.update(girviLoansTable)
        .set({
          startDate: now,
          dueDate: renewedDueDate,
          status: "active",
          totalInterestCollected: newTotalCollected.toFixed(2),
          interestBaseline: newInterestBaseline.toFixed(2),
          notes: mergedNotes ?? null,
        })
        .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
        .returning();

      if (paid > 0) {
        await postJournalEntry(tx, {
          userId,
          voucherDate: now,
          voucherType: "receipt",
          narration: `Renewal interest collected on girvi loan ${loan.loanNumber}`,
          sourceModule: "girvi",
          sourceId: id,
          lines: [
            { accountId: accts[cashOrBankKey(resolvedMode)], debit: paid, particulars: "Renewal interest received" },
            { accountId: accts.INTEREST_INCOME, credit: paid, particulars: "Interest" },
          ],
        });
      }

      return u;
    });

    res.json(mapLoan(updated, new Date(), settings.overdueGraceDays));
  } catch (err) {
    req.log.error({ err }, "Failed to renew loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get payment history for a loan
router.get("/:id/payments", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const payments = await db.select().from(girviPaymentsTable)
      .where(and(eq(girviPaymentsTable.loanId, id), eq(girviPaymentsTable.userId, userId)))
      .orderBy(desc(girviPaymentsTable.paymentDate));
    res.json(payments.map(mapPayment));
  } catch (err) {
    req.log.error({ err }, "Failed to get payment history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [loan] = await db.select().from(girviLoansTable).where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)));
    if (!loan) return res.status(404).json({ error: "Not found" });

    const data = req.body;
    const now = new Date();
    const settings = await getOrCreateGirviSettings(userId);
    const graceDays = settings.overdueGraceDays;
    const updates: Partial<typeof girviLoansTable.$inferInsert> = {};

    if (data.status === "redeemed") {
      if (loan.status !== "active" && loan.status !== "extended") {
        return res.status(400).json({ error: "Only active/extended loans can be redeemed" });
      }
      const { total: accruedInterest } = calcAccruedInterest(loan, now, graceDays);
      const interestBaseline = safeFloat((loan as any).interestBaseline ?? "0");
      const collectedSinceReset = Math.max(0, safeFloat(loan.totalInterestCollected) - interestBaseline);
      const outstanding = Math.max(0, accruedInterest - collectedSinceReset);
      const principalPaid = safeFloat((loan as any).principalPaid ?? "0");
      const currentPrincipal = Math.max(0, safeFloat(loan.loanAmount) - principalPaid);
      const resolvedMode = VALID_PAYMENT_MODES.has(data.paymentMode) ? data.paymentMode : "cash";

      // Optional lender discretion: forgive some/all of the outstanding interest
      // instead of collecting it (e.g. the customer is well past the grace
      // period, but the lender chooses not to charge for it this time).
      const waiveInterest = safeFloat(data.waiveInterest, 0);
      if (waiveInterest < 0 || waiveInterest > outstanding + 0.01) {
        return res.status(400).json({ error: `Waived interest must be between 0 and the outstanding interest (₹${outstanding.toFixed(2)})` });
      }
      const interestToCollect = Math.max(0, outstanding - waiveInterest);
      const cashCollected = currentPrincipal + interestToCollect; // actual cash received — excludes any waived interest

      const returnVoucherNumber = await nextGirviNumber(userId, "return", settings.returnPrefix, now);
      const accts = await getOrCreateDefaultAccounts(userId);

      // Record the final interest + principal settlement as payments (mirrors the
      // auto-redeem path in collect-interest) so payment history and the
      // totalInterestCollected dashboard stat aren't left understated.
      const updated = await db.transaction(async tx => {
        if (interestToCollect > 0) {
          await tx.insert(girviPaymentsTable).values({
            userId, loanId: id, loanNumber: loan.loanNumber, customerName: loan.customerName,
            amount: interestToCollect.toFixed(2), paymentType: "interest", paymentMode: resolvedMode, paymentDate: now,
            notes: "Redemption: final interest settlement",
          });
        }
        if (waiveInterest > 0) {
          await tx.insert(girviPaymentsTable).values({
            userId, loanId: id, loanNumber: loan.loanNumber, customerName: loan.customerName,
            amount: waiveInterest.toFixed(2), paymentType: "waiver", paymentMode: resolvedMode, paymentDate: now,
            notes: "Redemption: interest waived by lender",
          });
        }
        if (currentPrincipal > 0) {
          await tx.insert(girviPaymentsTable).values({
            userId, loanId: id, loanNumber: loan.loanNumber, customerName: loan.customerName,
            amount: currentPrincipal.toFixed(2), paymentType: "principal", paymentMode: resolvedMode, paymentDate: now,
            notes: "Redemption: final principal settlement",
          });
        }
        // Only the still-pledged items — anything already released via a prior
        // partial release keeps its own returnedAt from that transaction.
        await tx.update(girviLoanItemsTable)
          .set({ status: "returned", returnedAt: now })
          .where(and(eq(girviLoanItemsTable.loanId, id), eq(girviLoanItemsTable.userId, userId), eq(girviLoanItemsTable.status, "pledged")));
        const [u] = await tx.update(girviLoansTable)
          .set({
            status: "redeemed",
            redeemedDate: now,
            redeemedAmount: cashCollected.toFixed(2),
            returnVoucherNumber,
            // Both the collected and waived portions clear the outstanding-interest ledger.
            totalInterestCollected: (safeFloat(loan.totalInterestCollected) + outstanding).toFixed(2),
            interestWaived: (safeFloat((loan as any).interestWaived ?? "0") + waiveInterest).toFixed(2),
            principalPaid: loan.loanAmount,
          })
          .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
          .returning();

        // Dr Cash/Bank (cashCollected) / Cr Girvi Loans Receivable (principal) +
        // Cr Interest Income (interest actually collected — waived interest never
        // touches the ledger since it was never booked as a receivable).
        await postJournalEntry(tx, {
          userId,
          voucherDate: now,
          voucherType: "receipt",
          narration: `Redemption of girvi loan ${loan.loanNumber}`,
          sourceModule: "girvi",
          sourceId: id,
          lines: [
            { accountId: accts[cashOrBankKey(resolvedMode)], debit: cashCollected, particulars: "Redemption payment received" },
            { accountId: accts.GIRVI_LOANS_RECEIVABLE, credit: currentPrincipal, partyType: "girvi_customer", partyId: loan.customerId ?? undefined, particulars: "Principal settled" },
            { accountId: accts.INTEREST_INCOME, credit: interestToCollect, particulars: "Interest settled" },
          ],
        });

        return u;
      });

      return res.json(mapLoan(updated, now, graceDays));
    } else if (data.status === "forfeited") {
      if (loan.status !== "active" && loan.status !== "extended") {
        return res.status(400).json({ error: "Only active/extended loans can be forfeited" });
      }
      const { total: accruedInterest } = calcAccruedInterest(loan, now, graceDays);
      const interestBaseline = safeFloat((loan as any).interestBaseline ?? "0");
      const collectedSinceReset = Math.max(0, safeFloat(loan.totalInterestCollected) - interestBaseline);
      const outstanding = Math.max(0, accruedInterest - collectedSinceReset);
      const principalPaid = safeFloat((loan as any).principalPaid ?? "0");
      const currentPrincipal = Math.max(0, safeFloat(loan.loanAmount) - principalPaid);
      const totalDue = currentPrincipal + outstanding;
      const goldSaleValue = safeFloat(data.goldSaleValue, safeFloat(loan.estimatedValue));
      if (goldSaleValue < 0) return res.status(400).json({ error: "Gold sale value cannot be negative" });
      const lossAmount = Math.max(0, totalDue - goldSaleValue);

      const returnVoucherNumber = await nextGirviNumber(userId, "return", settings.returnPrefix, now);
      const accts = await getOrCreateDefaultAccounts(userId);
      const forfeitUpdates: Partial<typeof girviLoansTable.$inferInsert> = {
        returnVoucherNumber,
        status: "forfeited",
        redeemedDate: now,
        goldSaleValue: goldSaleValue.toString(),
        lossAmount: lossAmount.toString(),
        // Loan is closed out (via gold sale) — clear the remaining principal so
        // currentPrincipal doesn't keep showing a stale nonzero balance afterwards.
        principalPaid: loan.loanAmount,
        updatedAt: now,
      };

      const updated = await db.transaction(async (tx) => {
        // Only the still-pledged items — anything already released via a prior
        // partial release keeps its own returnedAt from that transaction.
        await tx.update(girviLoanItemsTable)
          .set({ status: "forfeited", returnedAt: now })
          .where(and(eq(girviLoanItemsTable.loanId, id), eq(girviLoanItemsTable.userId, userId), eq(girviLoanItemsTable.status, "pledged")));
        const [u] = await tx.update(girviLoansTable).set(forfeitUpdates)
          .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
          .returning();

        // Dr Forfeited Gold Stock (goldSaleValue) + Dr Forfeiture Loss (lossAmount) /
        // Cr Girvi Loans Receivable (totalDue) — the shop keeps/sells the collateral
        // instead of the customer repaying; any shortfall is booked as a loss.
        await postJournalEntry(tx, {
          userId,
          voucherDate: now,
          voucherType: "journal",
          narration: `Forfeiture of girvi loan ${loan.loanNumber}`,
          sourceModule: "girvi",
          sourceId: id,
          lines: [
            { accountId: accts.FORFEITED_GOLD_STOCK, debit: goldSaleValue, particulars: "Forfeited collateral retained" },
            { accountId: accts.FORFEITURE_LOSS, debit: lossAmount, particulars: "Shortfall on forfeiture" },
            { accountId: accts.GIRVI_LOANS_RECEIVABLE, credit: totalDue, partyType: "girvi_customer", partyId: loan.customerId ?? undefined, particulars: "Loan closed out" },
          ],
        });

        return u;
      });

      return res.json(mapLoan(updated, now, graceDays));
    } else if (data.status === "extended") {
      if (loan.status !== "active" && loan.status !== "extended") {
        return res.status(400).json({ error: "Only active/extended loans can be extended" });
      }
      updates.status = "extended";
      if (data.newDueDate) {
        const nd = new Date(data.newDueDate);
        if (isNaN(nd.getTime())) return res.status(400).json({ error: "Invalid new due date" });
        // Pushing the due date out changes how much of the accrued interest counts as
        // "normal" vs "penalty" under the recalculation — preserve what's owed right now.
        updates.interestBaseline = preserveOutstandingBaseline(loan, { dueDate: nd }, now, graceDays);
        updates.dueDate = nd;
      }
    } else {
      // General field updates
      if (data.notes !== undefined) updates.notes = String(data.notes).slice(0, MAX_NOTES_LEN) || null;
      if (data.itemDescription !== undefined) updates.itemDescription = String(data.itemDescription).slice(0, 500) || null;
      if (data.fatherName !== undefined) updates.fatherName = String(data.fatherName).trim() || null;
      if (data.address !== undefined) updates.address = String(data.address).slice(0, MAX_ADDRESS_LEN) || null;
      if (data.pan !== undefined) updates.pan = String(data.pan).trim().toUpperCase() || null;
      if (data.processingFee !== undefined) {
        const pf = safeFloat(data.processingFee);
        if (pf < 0) return res.status(400).json({ error: "Processing fee cannot be negative" });
        updates.processingFee = pf.toString();
      }
      if (data.penaltyRate !== undefined) {
        const pr = safeFloat(data.penaltyRate);
        if (pr < 0 || pr > 100) return res.status(400).json({ error: "Penalty rate must be 0–100" });
        updates.interestBaseline = preserveOutstandingBaseline(loan, { penaltyRate: pr.toString() }, now, graceDays);
        updates.penaltyRate = pr.toString();
      }
    }

    updates.updatedAt = now;
    const [updated] = await db.update(girviLoansTable).set(updates)
      .where(and(eq(girviLoansTable.id, id), eq(girviLoansTable.userId, userId)))
      .returning();
    res.json(mapLoan(updated, now, graceDays));
  } catch (err) {
    req.log.error({ err }, "Failed to update girvi loan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
