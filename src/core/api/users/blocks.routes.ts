import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  postBlock,
  deleteBlock,
  postRestrict,
  deleteRestrict,
  getMyBlocked,
  getMyRestricted,
  getBlockStatus,
} from "./blocks.controller";

const router = Router();

router.use(authMiddleware);

router.get("/me/blocked", asyncHandler(getMyBlocked));
router.get("/me/restricted", asyncHandler(getMyRestricted));

router.post("/:id/block", asyncHandler(postBlock));
router.delete("/:id/block", asyncHandler(deleteBlock));
router.post("/:id/restrict", asyncHandler(postRestrict));
router.delete("/:id/restrict", asyncHandler(deleteRestrict));
router.get("/:id/block-status", asyncHandler(getBlockStatus));

export default router;