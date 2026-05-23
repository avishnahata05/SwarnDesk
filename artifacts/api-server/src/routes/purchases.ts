import { Router } from "express";
import { db } from "@workspace/db";
import { purchasesTable, suppliersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function mapPurchase(p: typeof purchasesTable.$inferSelect) {
  return {
    id: p.id,
    supplierId: p.supplierId,
    supplierName: p.supplierName,
    metalType: p.metalType,
    purity: p.purity,
    grossWeight: parseFloat(p.grossWeight),
    netWeight: parseFloat(p.netWeight),
    fineWeight: parseFloat(p.fineWeight),
    ratePerGram: parseFloat(p.ratePerGram),
    totalAmount: parseFloat(p.totalAmount),
    invoiceNumber: p.invoiceNumber,
    purchaseDate: p.purchaseDate.toISOString(),
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
  };
}

function mapSupplier(s: typeof suppliersTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    mobile: s.mobile,
    address: s.address,
    gstin: s.gstin,
    email: s.email,
    createdAt: s.createdAt.toISOString(),
  };
}

function generateInvoice() {
  return `PO${Date.now().toString().slice(-8)}`;
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const purchases = await db.select().from(purchasesTable).where(eq(purchasesTable.userId, userId));
    res.json(purchases.map(mapPurchase));
  } catch (err) {
    req.log.error({ err }, "Failed to list purchases");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const [purchase] = await db.insert(purchasesTable).values({
      userId,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      metalType: data.metalType,
      purity: data.purity,
      grossWeight: (data.grossWeight ?? 0).toString(),
      netWeight: (data.netWeight ?? data.fineWeight ?? 0).toString(),
      fineWeight: (data.fineWeight ?? data.netWeight ?? 0).toString(),
      ratePerGram: (data.ratePerGram ?? 0).toString(),
      totalAmount: (data.totalAmount ?? 0).toString(),
      invoiceNumber: data.invoiceNumber ?? generateInvoice(),
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
      notes: data.notes ?? null,
    }).returning();
    res.status(201).json(mapPurchase(purchase));
  } catch (err) {
    req.log.error({ err }, "Failed to create purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [purchase] = await db.select().from(purchasesTable).where(and(eq(purchasesTable.id, parseInt(req.params.id)), eq(purchasesTable.userId, userId)));
    if (!purchase) return res.status(404).json({ error: "Not found" });
    res.json(mapPurchase(purchase));
  } catch (err) {
    req.log.error({ err }, "Failed to get purchase");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Suppliers
router.get("/suppliers/list", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const suppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.userId, userId));
    res.json(suppliers.map(mapSupplier));
  } catch (err) {
    req.log.error({ err }, "Failed to list suppliers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/suppliers", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const [supplier] = await db.insert(suppliersTable).values({
      userId,
      name: data.name,
      mobile: data.mobile,
      address: data.address,
      gstin: data.gstin,
      email: data.email,
    }).returning();
    res.status(201).json(mapSupplier(supplier));
  } catch (err) {
    req.log.error({ err }, "Failed to create supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
