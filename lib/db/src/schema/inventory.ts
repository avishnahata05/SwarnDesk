import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  name: text("name").notNull(),
  category: text("category").notNull(), // gold, silver, diamond, kundan, platinum
  purity: text("purity").notNull(), // 24K, 22K, 18K, 925, etc.
  grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull(),
  netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull(),
  stoneWeight: numeric("stone_weight", { precision: 10, scale: 3 }).notNull().default("0"),
  stoneValue: numeric("stone_value", { precision: 10, scale: 2 }),
  makingCharges: numeric("making_charges", { precision: 10, scale: 2 }).notNull(),
  metalRate: numeric("metal_rate", { precision: 10, scale: 2 }).notNull(),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  branch: text("branch").notNull().default("Main"),
  huid: text("huid"),
  barcode: text("barcode"),
  karigarId: integer("karigar_id"),
  karigarName: text("karigar_name"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(2),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("inv_user_idx").on(t.userId),
  index("inv_user_cat_idx").on(t.userId, t.category),
  index("inv_user_branch_idx").on(t.userId, t.branch),
  index("inv_barcode_idx").on(t.barcode),
  index("inv_huid_idx").on(t.huid),
]);

export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({ id: true, createdAt: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
