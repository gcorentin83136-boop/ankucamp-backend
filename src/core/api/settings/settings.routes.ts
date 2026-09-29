import { Router } from "express";
import accountRoutes from "./account/account.routes";

const router = Router();

// ============================================================
// SOUS-ROUTES
// ============================================================

router.use("/account", accountRoutes);

// À venir :
// router.use("/notifications", notificationsRoutes);
// router.use("/privacy", privacyRoutes);
// router.use("/shop", shopRoutes);
// router.use("/sessions", sessionsRoutes);
// router.use("/gdpr", gdprRoutes);

export default router;