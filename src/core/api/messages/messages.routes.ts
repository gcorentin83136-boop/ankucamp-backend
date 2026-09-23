import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  listPublic,
  createPublic,
  listGroup,
  createGroup,
  listSupportMine,
  listSupportByShop,
  createSupport,
  getOne,
} from "./messages.controller";

const router = Router();

// PUBLIC
router.get("/public", listPublic);
router.post("/public", authMiddleware, createPublic);

// GROUP
router.get("/group/:groupId", authMiddleware, listGroup);
router.post("/group", authMiddleware, createGroup);

// SUPPORT
router.get("/support/me", authMiddleware, listSupportMine);
router.get("/support/shop/:shopId", authMiddleware, listSupportByShop);
router.post("/support", authMiddleware, createSupport);

// PAR ID — EN DERNIER
router.get("/:id", authMiddleware, getOne);

export default router;