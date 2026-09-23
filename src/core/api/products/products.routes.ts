import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import {
  listProducts,
  listByShop,
  getOne,
  createOne,
  updateOne,
  deleteOne,
} from "./products.controller";

const router = Router();

// Routes spécifiques AVANT les routes paramétrées
router.get("/", listProducts);
router.get("/shop/:shopId", listByShop);

// Création : réservée aux pros (vérif d'ownership faite dans le service)
router.post(
  "/",
  authMiddleware,
  requireRole("professionnel"),
  createOne
);

// Routes paramétrées EN DERNIER
router.get("/:id", getOne);
router.put("/:id", authMiddleware, updateOne);
router.delete("/:id", authMiddleware, deleteOne);

export default router;