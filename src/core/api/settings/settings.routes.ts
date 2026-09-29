import { Router } from "express";
import accountRoutes from "./account/account.routes";
import notificationsRoutes from "./notifications/notifications.routes";
import privacyRoutes from "./privacy/privacy.routes";
import shopRoutes from "./shop/shop.routes";
import sessionsRoutes from "./sessions/sessions.routes";

const router = Router();

// ============================================================
// SOUS-ROUTES
// ============================================================

router.use("/account", accountRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/privacy", privacyRoutes);
router.use("/shop", shopRoutes);
router.use("/sessions", sessionsRoutes);

// À venir :
// router.use("/gdpr", gdprRoutes);

export default router;