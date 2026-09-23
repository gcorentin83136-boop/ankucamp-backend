import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import {
  listShops,
  getOneShop,
  listMyShops,
  createOneShop,
  updateOneShop,
  deleteOneShop,
} from "./shops.controller";

const router = Router();

// ⚠️ ORDRE IMPORTANT : routes spécifiques AVANT les routes paramétrées
router.get("/", listShops);

// Routes protégées (mes boutiques)
router.get("/owner/me", authMiddleware, listMyShops);

// Création : uniquement les professionnels
router.post(
  "/",
  authMiddleware,
  requireRole("professionnel"),
  createOneShop
);

// Routes paramétrées (/:id) — EN DERNIER
router.get("/:id", getOneShop);
router.put("/:id", authMiddleware, updateOneShop);
router.delete("/:id", authMiddleware, deleteOneShop);

export default router;