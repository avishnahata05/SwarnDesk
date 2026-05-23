import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use("/rates", ratesRouter);
router.use("/inventory", inventoryRouter);
router.use("/customers", customersRouter);
router.use("/sales", salesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/karigars", karigarsRouter);
router.use("/repairs", repairsRouter);
router.use("/purchases", purchasesRouter);
router.use("/suppliers", suppliersRouter);
router.use("/settings", settingsRouter);
router.use("/girvi", girviRouter);

export default router;
