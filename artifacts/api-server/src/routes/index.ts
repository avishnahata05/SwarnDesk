import { Router, type IRouter } from "express";
import { authMiddleware, subscriptionCheck } from "../middleware/auth.js";
import healthRouter from "./health";
import ratesRouter from "./rates";
import inventoryRouter from "./inventory";
import customersRouter from "./customers";
import salesRouter from "./sales";
import dashboardRouter from "./dashboard";
import karigarsRouter from "./karigars";
import repairsRouter from "./repairs";
import purchasesRouter from "./purchases";
import suppliersRouter from "./suppliers";
import settingsRouter from "./settings";
import girviRouter from "./girvi";
import girviCustomersRouter from "./girvi-customers";
import girviBranchesRouter from "./girvi-branches";
import girviTransfersRouter from "./girvi-transfers";
import girviSettingsRouter from "./girvi-settings";
import girviReportsRouter from "./girvi-reports";
import whatsappRouter from "./whatsapp";
import authRouter from "./auth";
import adminRouter from "./admin";
import customOrdersRouter from "./custom-orders";
import accountingAccountsRouter from "./accounting-accounts";
import accountingVouchersRouter from "./accounting-vouchers";
import accountingReportsRouter from "./accounting-reports";
import accountingSettingsRouter from "./accounting-settings";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use("/auth", authRouter);

// Protected routes (require valid JWT + active subscription)
const guard = [authMiddleware, subscriptionCheck] as const;
router.use("/rates", ...guard, ratesRouter);
router.use("/inventory", ...guard, inventoryRouter);
router.use("/customers", ...guard, customersRouter);
router.use("/sales", ...guard, salesRouter);
router.use("/dashboard", ...guard, dashboardRouter);
router.use("/karigars", ...guard, karigarsRouter);
router.use("/repairs", ...guard, repairsRouter);
router.use("/purchases", ...guard, purchasesRouter);
router.use("/suppliers", ...guard, suppliersRouter);
router.use("/settings", ...guard, settingsRouter);
router.use("/girvi/customers", ...guard, girviCustomersRouter);
router.use("/girvi/branches", ...guard, girviBranchesRouter);
router.use("/girvi/transfers", ...guard, girviTransfersRouter);
router.use("/girvi/settings", ...guard, girviSettingsRouter);
router.use("/girvi/reports", ...guard, girviReportsRouter);
router.use("/girvi", ...guard, girviRouter);
router.use("/custom-orders", ...guard, customOrdersRouter);
router.use("/accounting/accounts", ...guard, accountingAccountsRouter);
router.use("/accounting/vouchers", ...guard, accountingVouchersRouter);
router.use("/accounting/reports", ...guard, accountingReportsRouter);
router.use("/accounting/settings", ...guard, accountingSettingsRouter);
router.use("/whatsapp", ...guard, whatsappRouter);
router.use("/admin", adminRouter); // admin has its own auth inside

export default router;
