import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  listMine,
  markRead,
  markAllRead,
  deleteOne,
} from "./notifications.controller";

const router = Router();

// Toutes protégées
router.use(authMiddleware);

// Routes spécifiques AVANT les routes paramétrées
router.get("/me", listMine);
router.put("/read-all", markAllRead);

// Routes paramétrées EN DERNIER
router.put("/:id/read", markRead);
router.delete("/:id", deleteOne);

export default router;