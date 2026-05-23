import { Router } from "express";
import { db } from "@workspace/db";
import { businessSettingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.post("/send-bulk", async (req, res) => {
  try {
    const { recipients } = req.body as { recipients: { mobile: string; name: string; message: string }[] };
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "No recipients provided" });
    }

    const [settings] = await db.select().from(businessSettingsTable).orderBy(desc(businessSettingsTable.id)).limit(1);

    if (!settings?.whatsappApiEnabled || !settings?.whatsappPhoneNumberId || !settings?.whatsappAccessToken) {
      return res.status(400).json({ error: "WhatsApp Business API not configured. Enable it in Settings." });
    }

    const results: { mobile: string; success: boolean; messageId?: string; error?: string }[] = [];

    for (const r of recipients) {
      const digits = r.mobile.replace(/\D/g, "");
      const fullMobile = digits.startsWith("91") ? digits : `91${digits}`;
      try {
        const resp = await fetch(
          `https://graph.facebook.com/v18.0/${settings.whatsappPhoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${settings.whatsappAccessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: fullMobile,
              type: "text",
              text: { body: r.message },
            }),
          }
        );
        const data = await resp.json() as { messages?: { id: string }[] };
        results.push({ mobile: r.mobile, success: resp.ok, messageId: data.messages?.[0]?.id });
      } catch {
        results.push({ mobile: r.mobile, success: false, error: "Network error" });
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    req.log.info({ sent, failed }, "WhatsApp bulk send complete");
    res.json({ sent, failed, results });
  } catch (err) {
    req.log.error({ err }, "WhatsApp bulk send failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/config", async (req, res) => {
  try {
    const [settings] = await db.select().from(businessSettingsTable).orderBy(desc(businessSettingsTable.id)).limit(1);
    res.json({
      whatsappApiEnabled: settings?.whatsappApiEnabled ?? false,
      whatsappPhoneNumberId: settings?.whatsappPhoneNumberId ?? "",
      hasAccessToken: !!(settings?.whatsappAccessToken),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get WhatsApp config");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
