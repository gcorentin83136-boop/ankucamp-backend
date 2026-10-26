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

const router = Router();

// ============================================================
// ROUTES STATIQUES (avant /:id)
// ============================================================

router.get("/", authOptionalMiddleware, asyncHandler(list));
router.get("/nearby", authOptionalMiddleware, asyncHandler(nearby));
router.get("/me", authMiddleware, asyncHandler(myEvents));`nrouter.get("/me/registrations", authMiddleware, asyncHandler(myRegisteredEvents));
router.get("/feed", authMiddleware, asyncHandler(feedEvents));

router.post(
  "/",
  authMiddleware,
  requireRole("professionnel"),
  asyncHandler(create)
);

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