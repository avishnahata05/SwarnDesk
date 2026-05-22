import { pgTable, serial, numeric, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const metalRatesTable = pgTable("metal_rates", {
  id: serial("id").primaryKey(),
  gold22k: numeric("gold22k", { precision: 10, scale: 2 }).notNull(),
  gold24k: numeric("gold24k", { precision: 10, scale: 2 }).notNull(),
  gold18k: numeric("gold18k", { precision: 10, scale: 2 }).notNull(),
  silver: numeric("silver", { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rateHistoryTable = pgTable("rate_history", {
  id: serial("id").primaryKey(),
  gold22k: numeric("gold22k", { precision: 10, scale: 2 }).notNull(),
  silver: numeric("silver", { precision: 10, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertMetalRatesSchema = createInsertSchema(metalRatesTable).omit({ id: true, updatedAt: true });
export type InsertMetalRates = z.infer<typeof insertMetalRatesSchema>;
export type MetalRates = typeof metalRatesTable.$inferSelect;
