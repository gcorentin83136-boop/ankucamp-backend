import { Router } from "express";
import {
  authMiddleware,
  authOptionalMiddleware,
} from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  list,
  getBySlug,
  myArticles,
  create,
  update,
  remove,
  like,
} from "./articles.controller";

const router = Router();

// STATIQUES (avant /:slug)
router.get("/", authOptionalMiddleware, asyncHandler(list));
router.get("/me", authMiddleware, asyncHandler(myArticles));
router.post("/", authMiddleware, asyncHandler(create));

// DYNAMIQUES
router.get("/:slug", authOptionalMiddleware, asyncHandler(getBySlug));
router.put("/:id", authMiddleware, asyncHandler(update));
router.delete("/:id", authMiddleware, asyncHandler(remove));
router.post("/:id/like", authMiddleware, asyncHandler(like));

export default router;