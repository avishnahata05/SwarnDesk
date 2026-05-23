import { Router } from "express";
import { db } from "@workspace/db";
import { businessSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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
    whatsappAccessToken: s.whatsappAccessToken ?? "",
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  try {
    const [settings] = await db.select().from(businessSettingsTable).orderBy(desc(businessSettingsTable.id)).limit(1);
    if (!settings) {
      // Return defaults
      return res.json({
        id: 0,
        businessName: "HiraNXT Demo Store",
        gstin: "27AAACR5055K1ZS",
        address: "123 Jewellers Lane, Mumbai, Maharashtra - 400001",
        mobile: "+91 98765 43210",
        email: "demo@hiranxt.com",
        logo: null,
        gstRate: 3,
        defaultBranch: "Main",
        branches: ["Main", "Branch 1"],
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
    const data = req.body;
    const [existing] = await db.select().from(businessSettingsTable).orderBy(desc(businessSettingsTable.id)).limit(1);
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
    if (data.gstRate !== undefined) updateData.gstRate = data.gstRate.toString();
    if (data.defaultBranch !== undefined) updateData.defaultBranch = data.defaultBranch;
    if (data.branches !== undefined) updateData.branches = Array.isArray(data.branches) ? data.branches.join(",") : data.branches;
    if (data.whatsappApiEnabled !== undefined) updateData.whatsappApiEnabled = data.whatsappApiEnabled;
    if (data.whatsappPhoneNumberId !== undefined) updateData.whatsappPhoneNumberId = data.whatsappPhoneNumberId;
    if (data.whatsappAccessToken !== undefined) updateData.whatsappAccessToken = data.whatsappAccessToken;

    if (existing) {
      [updated] = await db.update(businessSettingsTable).set(updateData).where(eq(businessSettingsTable.id, existing.id)).returning();
    } else {
      [updated] = await db.insert(businessSettingsTable).values({
        businessName: data.businessName ?? "My Jewellery Store",
        gstin: data.gstin ?? "",
        address: data.address ?? "",
        mobile: data.mobile ?? "",
        email: data.email,
        logo: data.logo,
        gstRate: (data.gstRate ?? 3).toString(),
        defaultBranch: data.defaultBranch ?? "Main",
        branches: Array.isArray(data.branches) ? data.branches.join(",") : (data.branches ?? "Main"),
      }).returning();
    }
    res.json(mapSettings(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
