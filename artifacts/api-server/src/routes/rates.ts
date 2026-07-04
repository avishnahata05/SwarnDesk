import { Router } from "express";
import { db } from "@workspace/db";
import { metalRatesTable, rateHistoryTable } from "@workspace/db";
import { desc, asc, eq, and, sql } from "drizzle-orm";

const router = Router();

router.get("/current", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [rates] = await db.select().from(metalRatesTable).where(eq(metalRatesTable.userId, userId)).orderBy(desc(metalRatesTable.id)).limit(1);
    if (!rates) {
      // Return sensible defaults when no rates exist for this user
      return res.json({
        gold22k: 7250,
        gold24k: 7950,
        gold18k: 5940,
        silver: 95,
        updatedAt: new Date().toISOString(),
      });
    }
    res.json({
      gold22k: parseFloat(rates.gold22k),
      gold24k: parseFloat(rates.gold24k),
      gold18k: parseFloat(rates.gold18k),
      silver: parseFloat(rates.silver),
      updatedAt: rates.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get rates");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/current", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { gold22k, gold24k, gold18k, silver } = req.body;

    const updated = await db.transaction(async (tx) => {
      // Serialize concurrent rate saves for this user. Without this lock, two
      // near-simultaneous updates (e.g. two form fields saved back-to-back, or
      // the header ticker and the settings page both saving) can each read the
      // same "existing" row before either write commits — the second write then
      // falls back to stale values for fields it didn't touch, silently
      // reverting whatever the first save had just changed.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);

      const [existing] = await tx.select().from(metalRatesTable)
        .where(eq(metalRatesTable.userId, userId))
        .orderBy(desc(metalRatesTable.id)).limit(1);

      let result;
      if (existing) {
        [result] = await tx.update(metalRatesTable)
          .set({
            gold22k: gold22k?.toString() ?? existing.gold22k,
            gold24k: gold24k?.toString() ?? existing.gold24k,
            gold18k: gold18k?.toString() ?? existing.gold18k,
            silver: silver?.toString() ?? existing.silver,
            updatedAt: new Date(),
          })
          .where(and(eq(metalRatesTable.id, existing.id), eq(metalRatesTable.userId, userId)))
          .returning();
      } else {
        // First-ever save for this user — fields left blank by the user (e.g.
        // they don't know today's 24K rate) fall back to sensible defaults
        // instead of crashing on `undefined.toString()`.
        [result] = await tx.insert(metalRatesTable).values({
          userId,
          gold22k: (gold22k ?? 7250).toString(),
          gold24k: (gold24k ?? 7950).toString(),
          gold18k: (gold18k ?? 5940).toString(),
          silver: (silver ?? 95).toString(),
        }).returning();
      }

      await tx.insert(rateHistoryTable).values({
        userId,
        gold22k: result.gold22k,
        silver: result.silver,
      });

      return result;
    });

    res.json({
      gold22k: parseFloat(updated.gold22k),
      gold24k: parseFloat(updated.gold24k),
      gold18k: parseFloat(updated.gold18k),
      silver: parseFloat(updated.silver),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update rates");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const history = await db.select().from(rateHistoryTable).where(eq(rateHistoryTable.userId, userId)).orderBy(asc(rateHistoryTable.timestamp)).limit(50);
    res.json(history.map(h => ({
      timestamp: h.timestamp.toISOString(),
      gold22k: parseFloat(h.gold22k),
      silver: parseFloat(h.silver),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get rate history");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
