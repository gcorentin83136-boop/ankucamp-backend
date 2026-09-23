import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  listMine,
  markRead,
  markAllRead,
  deleteOne,
} from "./notifications.controller";

const router = Router();

router.use(authMiddleware);

router.get("/me", asyncHandler(listMine));
router.put("/read-all", asyncHandler(markAllRead));

router.put("/:id/read", asyncHandler(markRead));
router.delete("/:id", asyncHandler(deleteOne));

export default router;