import { pgTable, serial, text, numeric, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessSettingsTable = pgTable("business_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  businessName: text("business_name").notNull().default("My Jewellery Store"),
  gstin: text("gstin").notNull().default(""),
  address: text("address").notNull().default(""),
  mobile: text("mobile").notNull().default(""),
  email: text("email"),
  logo: text("logo"),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("3"),
  defaultBranch: text("default_branch").notNull().default("Main"),
  branches: text("branches").notNull().default("Main"),
  whatsappApiEnabled: boolean("whatsapp_api_enabled").notNull().default(false),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  whatsappAccessToken: text("whatsapp_access_token"),
  // Optional loyalty points program for purchases (Sales only — not Girvi loans).
  // loyaltyPointsRate = rupees a customer must spend to earn 1 point.
  loyaltyPointsEnabled: boolean("loyalty_points_enabled").notNull().default(true),
  loyaltyPointsRate: numeric("loyalty_points_rate", { precision: 10, scale: 2 }).notNull().default("1000"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBusinessSettingsSchema = createInsertSchema(businessSettingsTable).omit({ id: true, updatedAt: true });
export type InsertBusinessSettings = z.infer<typeof insertBusinessSettingsSchema>;
export type BusinessSettings = typeof businessSettingsTable.$inferSelect;
