import { Router } from "express";
import {
  authMiddleware,
  authOptionalMiddleware,
} from "../../middlewares/auth.middleware";
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
  shareEventCtrl,
  likeEvent,
} from "./posts.controller";

const router = Router();

// ============================================================
// ROUTES STATIQUES (avant /:id)
// ============================================================

router.get("/feed", authMiddleware, asyncHandler(feed));
router.get("/me", authMiddleware, asyncHandler(mine));
router.post("/", authMiddleware, asyncHandler(create));

// Partager un événement
router.post(
  "/share-event/:eventId",
  authMiddleware,
  asyncHandler(shareEventCtrl)
);

// Like sur événement (via /posts pour cohérence front)
router.post(
  "/events/:eventId/like",
  authMiddleware,
  asyncHandler(likeEvent)
);

// ============================================================
// ROUTES DYNAMIQUES /:id
// ============================================================

router.get("/:id", authOptionalMiddleware, asyncHandler(getOne));
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

// Partage de post
router.post("/:id/share", authMiddleware, asyncHandler(share));

// ============================================================
// ROUTES DYNAMIQUES SPÉCIALES
// ============================================================

router.get("/user/:userId", authMiddleware, asyncHandler(byUser));

export default router;