import { Router } from "express";
import {
  authMiddleware,
  authOptionalMiddleware,
} from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  list,
  nearby,
  getOne,
  myEvents,
  myRegisteredEvents,
  adminListEvents,
  feedEvents,
  registrations,
  create,
  update,
  cancel,
  remove,
  register,
  unregister,
} from "./events.controller";
import {
  listComments,
  createComment,
  updateComment,
  removeComment,
  reactComment,
} from "./events.comments.controller";

const router = Router();

// ============================================================
// ROUTES STATIQUES (avant /:id)
// ============================================================

router.get("/", authOptionalMiddleware, asyncHandler(list));
router.get("/nearby", authOptionalMiddleware, asyncHandler(nearby));
router.get("/me", authMiddleware, asyncHandler(myEvents));
router.get("/me/registrations", authMiddleware, asyncHandler(myRegisteredEvents));
router.get("/feed", authMiddleware, asyncHandler(feedEvents));
router.get("/admin/all", authMiddleware, requireRole("admin"), asyncHandler(adminListEvents));

router.post(
  "/",
  authMiddleware,
  requireRole("professionnel"),
  asyncHandler(create)
);

// ============================================================
// COMMENTS (routes statiques AVANT /:id)
// ============================================================
router.get("/:eventId/comments", authOptionalMiddleware, asyncHandler(listComments));
router.post("/:eventId/comments", authMiddleware, asyncHandler(createComment));
router.put("/comments/:commentId", authMiddleware, asyncHandler(updateComment));
router.delete("/comments/:commentId", authMiddleware, asyncHandler(removeComment));
router.post("/comments/:commentId/reactions", authMiddleware, asyncHandler(reactComment));

// ============================================================
// ROUTES DYNAMIQUES /:id
// ============================================================

router.get("/:id", authOptionalMiddleware, asyncHandler(getOne));
router.get("/:id/registrations", authMiddleware, asyncHandler(registrations));

router.post("/:id/register", authMiddleware, asyncHandler(register));
router.delete("/:id/register", authMiddleware, asyncHandler(unregister));

router.put("/:id", authMiddleware, asyncHandler(update));
router.delete("/:id", authMiddleware, asyncHandler(remove));

router.put("/:id/cancel", authMiddleware, asyncHandler(cancel));

export default router;