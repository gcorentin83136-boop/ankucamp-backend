import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  listMyOrders,
  listSellerOrders,
  getOne,
  createOne,
  updateStatus,
  deleteOne,
} from "./orders.controller";

const router = Router();

// Toutes les routes orders sont protégées
router.use(authMiddleware);

// Routes spécifiques AVANT les routes paramétrées
router.get("/me", listMyOrders);
router.get("/seller/me", listSellerOrders);

router.post("/", createOne);

// Routes paramétrées EN DERNIER
router.get("/:id", getOne);
router.put("/:id/status", updateStatus);
router.delete("/:id", deleteOne);

export default router;