import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  listMyOrders,
  listSellerOrders,
  getOne,
  createOne,
  updateStatus,
  deleteOne,
  downloadInvoice,
  resendInvoice,
} from "./orders.controller";

const router = Router();

router.use(authMiddleware);

// Routes statiques / spécifiques AVANT les routes dynamiques /:id
router.get("/me", asyncHandler(listMyOrders));
router.get("/seller/me", asyncHandler(listSellerOrders));
router.post("/", asyncHandler(createOne));

// ⚠️ Doit être déclaré AVANT "/:id" pour ne pas être capturé par le param
router.get("/:id/invoice", asyncHandler(downloadInvoice));
router.post("/:id/invoice/resend", asyncHandler(resendInvoice));

// Routes dynamiques
router.get("/:id", asyncHandler(getOne));
router.put("/:id/status", asyncHandler(updateStatus));
router.delete("/:id", asyncHandler(deleteOne));

export default router;