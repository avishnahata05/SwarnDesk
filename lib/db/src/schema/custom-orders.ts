import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";

export const customOrdersTable = pgTable("custom_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  orderNumber: text("order_number").notNull(),

  // Customer
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerMobile: text("customer_mobile").notNull(),

  // Item specs
  itemType: text("item_type").notNull(),       // Ring, Necklace, Bangle, etc.
  description: text("description"),            // design / customer notes
  metalType: text("metal_type").notNull(),     // gold | silver
  purity: text("purity").notNull(),            // 22K, 18K, 925, etc.
  targetWeight: numeric("target_weight", { precision: 10, scale: 3 }),

  // Pricing
  estimatedPrice: numeric("estimated_price", { precision: 12, scale: 2 }),
  agreedPrice: numeric("agreed_price", { precision: 12, scale: 2 }),
  advancePaid: numeric("advance_paid", { precision: 12, scale: 2 }).default("0"),
  // The metal rate (₹/gram) assumed when agreedPrice was set at booking — locks in what
  // "the rate" meant at that moment so there's an audit trail if the customer or shop later
  // disputes the price, since gold/silver rates move daily between booking and delivery.
  bookingMetalRate: numeric("booking_metal_rate", { precision: 10, scale: 2 }),

  // Workflow status: pending → karigar_assigned → in_progress → karigar_returned → ready → delivered | cancelled
  status: text("status").notNull().default("pending"),

  // Karigar assignment
  karigarId: integer("karigar_id"),
  karigarName: text("karigar_name"),

  // Metal issued to karigar
  metalIssuedWeight: numeric("metal_issued_weight", { precision: 10, scale: 3 }),
  metalIssuedDate: timestamp("metal_issued_date"),

  // Return from karigar
  finishedWeight: numeric("finished_weight", { precision: 10, scale: 3 }),
  wastageWeight: numeric("wastage_weight", { precision: 10, scale: 3 }),
  karigarReturnDate: timestamp("karigar_return_date"),
  karigarWages: numeric("karigar_wages", { precision: 10, scale: 2 }),
  karigarNotes: text("karigar_notes"),

  // When the order was actually booked — distinct from createdAt (the row's technical
  // insert time), settable so a shop can log an order a day or two after the customer
  // actually placed it without the paperwork date being wrong.
  orderDate: timestamp("order_date").defaultNow().notNull(),

  // Delivery
  dueDate: timestamp("due_date").notNull(),
  deliveryDate: timestamp("delivery_date"),
  finalPrice: numeric("final_price", { precision: 12, scale: 2 }),

  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("custom_orders_user_idx").on(t.userId),
  index("custom_orders_karigar_idx").on(t.karigarId),
]);

// Records each payment collected against a custom order (advance at booking, top-ups, final on delivery)
export const customOrderPaymentTransactionsTable = pgTable("custom_order_payment_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().default(0),
  customOrderId: integer("custom_order_id").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  bankAccountId: integer("bank_account_id"),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
  notes: text("notes"),
}, (t) => [
  index("copt_order_idx").on(t.customOrderId),
  index("copt_user_idx").on(t.userId),
  index("copt_user_date_idx").on(t.userId, t.paidAt),
]);

export type CustomOrder = typeof customOrdersTable.$inferSelect;
export type CustomOrderPaymentTransaction = typeof customOrderPaymentTransactionsTable.$inferSelect;
