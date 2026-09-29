import { Router } from "express";
import accountRoutes from "./account/account.routes";
import notificationsRoutes from "./notifications/notifications.routes";

const router = Router();

// ============================================================
// SOUS-ROUTES
// ============================================================

router.use("/account", accountRoutes);
router.use("/notifications", notificationsRoutes);

// À venir :
// router.use("/privacy", privacyRoutes);
// router.use("/shop", shopRoutes);
// router.use("/sessions", sessionsRoutes);
// router.use("/gdpr", gdprRoutes);

export default router;