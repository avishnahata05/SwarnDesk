import { Router } from "express";
import { db } from "@workspace/db";
import { businessSettingsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

function mapSettings(s: typeof businessSettingsTable.$inferSelect) {
  return {
    id: s.id,
    businessName: s.businessName,
    gstin: s.gstin,
    address: s.address,
    mobile: s.mobile,
    email: s.email,
    logo: s.logo,
    gstRate: parseFloat(s.gstRate),
    defaultBranch: s.defaultBranch,
    branches: s.branches.split(",").map(b => b.trim()).filter(Boolean),
    whatsappApiEnabled: s.whatsappApiEnabled,
    whatsappPhoneNumberId: s.whatsappPhoneNumberId ?? "",
    hasAccessToken: !!(s.whatsappAccessToken),
    loyaltyPointsEnabled: s.loyaltyPointsEnabled,
    loyaltyPointsRate: parseFloat(s.loyaltyPointsRate),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [settings] = await db.select().from(businessSettingsTable).where(eq(businessSettingsTable.userId, userId)).orderBy(desc(businessSettingsTable.id)).limit(1);
    if (!settings) {
      // Return defaults
      return res.json({
        id: 0,
        businessName: "My Jewellery Store",
        gstin: "",
        address: "",
        mobile: "",
        email: null,
        logo: null,
        gstRate: 3,
        defaultBranch: "Main",
        branches: ["Main"],
        whatsappApiEnabled: false,
        whatsappPhoneNumberId: "",
        whatsappAccessToken: "",
        loyaltyPointsEnabled: true,
        loyaltyPointsRate: 1000,
        updatedAt: new Date().toISOString(),
      });
    }
    res.json(mapSettings(settings));
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;
    const [existing] = await db.select().from(businessSettingsTable).where(eq(businessSettingsTable.userId, userId)).orderBy(desc(businessSettingsTable.id)).limit(1);
    let updated;
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.businessName !== undefined) updateData.businessName = data.businessName;
    if (data.gstin !== undefined) updateData.gstin = data.gstin;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.mobile !== undefined) updateData.mobile = data.mobile;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.gstRate !== undefined) {
      const gstRate = parseFloat(String(data.gstRate));
      if (!isFinite(gstRate) || gstRate < 0) return res.status(400).json({ error: "GST rate must be a non-negative number" });
      updateData.gstRate = gstRate.toString();
    }
    if (data.defaultBranch !== undefined) updateData.defaultBranch = data.defaultBranch;
    if (data.branches !== undefined) updateData.branches = Array.isArray(data.branches) ? data.branches.join(",") : data.branches;
    if (data.whatsappApiEnabled !== undefined) updateData.whatsappApiEnabled = data.whatsappApiEnabled;
    if (data.whatsappPhoneNumberId !== undefined) updateData.whatsappPhoneNumberId = data.whatsappPhoneNumberId;
    if (data.whatsappAccessToken !== undefined) updateData.whatsappAccessToken = data.whatsappAccessToken;
    if (data.loyaltyPointsEnabled !== undefined) updateData.loyaltyPointsEnabled = !!data.loyaltyPointsEnabled;
    if (data.loyaltyPointsRate !== undefined) {
      const rate = parseFloat(String(data.loyaltyPointsRate));
      if (!isFinite(rate) || rate <= 0) return res.status(400).json({ error: "Loyalty points rate must be a positive number" });
      updateData.loyaltyPointsRate = rate.toString();
    }

    if (existing) {
      [updated] = await db.update(businessSettingsTable).set(updateData).where(and(eq(businessSettingsTable.id, existing.id), eq(businessSettingsTable.userId, userId))).returning();
    } else {
      [updated] = await db.insert(businessSettingsTable).values({
        userId,
        businessName: data.businessName ?? "My Jewellery Store",
        gstin: data.gstin ?? "",
        address: data.address ?? "",
        mobile: data.mobile ?? "",
        email: data.email,
        logo: data.logo,
        gstRate: (data.gstRate ?? 3).toString(),
        defaultBranch: data.defaultBranch ?? "Main",
        branches: Array.isArray(data.branches) ? data.branches.join(",") : (data.branches ?? "Main"),
        loyaltyPointsEnabled: data.loyaltyPointsEnabled ?? true,
        loyaltyPointsRate: (data.loyaltyPointsRate ?? 1000).toString(),
      }).returning();
    }
    res.json(mapSettings(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
