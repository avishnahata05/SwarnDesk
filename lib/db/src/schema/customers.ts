import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  email: text("email"),
  address: text("address"),
  birthday: text("birthday"), // stored as MM-DD string
  anniversary: text("anniversary"), // stored as MM-DD string
  totalPurchases: numeric("total_purchases", { precision: 12, scale: 2 }).notNull().default("0"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  gstin: text("gstin"),
  // For Sec. 269ST compliance — Indian law requires PAN on file for cash transactions
  // >= 2 lakh with any single customer. Optional here; enforced at billing time, not schema level.
  pan: text("pan"),
  // 2-digit GST state code for this customer — blank means "assume same state as the
  // shop" (intra-state, CGST+SGST). Only matters for B2B invoices where gstin is set.
  stateCode: text("state_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("customers_user_idx").on(t.userId),
  index("customers_mobile_idx").on(t.userId, t.mobile),
  index("customers_name_idx").on(t.userId, t.name),
]);

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, totalPurchases: true, loyaltyPoints: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
