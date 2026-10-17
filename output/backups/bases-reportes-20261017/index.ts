import { Router } from "express";
import authRouter         from "./auth";
import productsRouter     from "./products";
import recursosRouter     from "./recursos";
import paquetesRouter     from "./paquetes";
import fichasRouter       from "./fichas";
import clientsRouter      from "./clients";
import inflablesRouter    from "./inflables";
import carritosRouter     from "./carritos";
import personalRouter     from "./personal";
import logisticsRouter    from "./logistics";
import maintenanceRouter  from "./maintenance";
import uploadRouter       from "./upload";
import tarifasEnvioRouter  from "./tarifas-envio";
import activosRouter       from "./activos";
import settingsRouter      from "./settings";
import cuotasRouter        from "./cuotas";
import { authenticateToken, enforceBrandScope } from "../middleware/auth";

const router = Router();

router.use("/auth",          authRouter);
router.use("/products",      authenticateToken, enforceBrandScope, productsRouter);
router.use("/recursos",      authenticateToken, enforceBrandScope, recursosRouter);
router.use("/paquetes",      authenticateToken, enforceBrandScope, paquetesRouter);
router.use("/fichas",        authenticateToken, enforceBrandScope, fichasRouter);
router.use("/clients",       authenticateToken, enforceBrandScope, clientsRouter);
router.use("/inflables",     authenticateToken, enforceBrandScope, inflablesRouter);
router.use("/carritos",      authenticateToken, carritosRouter);
router.use("/personal",      authenticateToken, enforceBrandScope, personalRouter);
router.use("/logistics",     authenticateToken, enforceBrandScope, logisticsRouter);
router.use("/maintenance",   authenticateToken, enforceBrandScope, maintenanceRouter);
router.use("/upload",        uploadRouter);
router.use("/tarifas-envio",  authenticateToken, tarifasEnvioRouter);
router.use("/activos",       authenticateToken, activosRouter);
router.use("/settings",      authenticateToken, settingsRouter);
router.use("/cuotas",        authenticateToken, enforceBrandScope, cuotasRouter);

export default router;
