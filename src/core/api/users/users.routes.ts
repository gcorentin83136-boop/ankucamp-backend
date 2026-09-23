import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { getMe, updateMe, getOne, getAll } from "./users.controller";

const router = Router();

// ⚠️ ORDRE IMPORTANT :
// /me doit être déclaré AVANT /:id
// Sinon Express croit que "me" est un :id

router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);

router.get("/", getAll);
router.get("/:id", getOne);

export default router;