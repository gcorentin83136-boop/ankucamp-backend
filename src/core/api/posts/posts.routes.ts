import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  create,
  getOne,
  feed,
  byUser,
  mine,
  update,
  remove,
  like,
  likes,
  addCommentCtrl,
  comments,
  removeComment,
  share,
} from "./posts.controller";

const router = Router();

// ============================================================
// ROUTES STATIQUES (avant /:id)
// ============================================================

router.get("/feed", authMiddleware, asyncHandler(feed));
router.get("/me", authMiddleware, asyncHandler(mine));
router.post("/", authMiddleware, asyncHandler(create));

// ============================================================
// ROUTES DYNAMIQUES /:id
// ============================================================

router.get("/:id", asyncHandler(getOne));
router.patch("/:id", authMiddleware, asyncHandler(update));
router.delete("/:id", authMiddleware, asyncHandler(remove));

// Likes
router.post("/:id/like", authMiddleware, asyncHandler(like));
router.get("/:id/likes", asyncHandler(likes));

// Commentaires
router.post("/:id/comments", authMiddleware, asyncHandler(addCommentCtrl));
router.get("/:id/comments", asyncHandler(comments));
router.delete(
  "/:id/comments/:commentId",
  authMiddleware,
  asyncHandler(removeComment)
);

// Partage
router.post("/:id/share", authMiddleware, asyncHandler(share));

// ============================================================
// ROUTES DYNAMIQUES SPÉCIALES
// ============================================================

// Posts d'un user (déclaré EN DERNIER pour ne pas capturer /:id)
router.get("/user/:userId", authMiddleware, asyncHandler(byUser));

export default router;