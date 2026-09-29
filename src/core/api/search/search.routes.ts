import { Router } from "express";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  users,
  shops,
  products,
  all,
  suggestCtrl,
} from "./search.controller";

const router = Router();

// ============================================================
// ROUTES PUBLIQUES (pas d'auth)
// ============================================================

router.get("/all", asyncHandler(all));
router.get("/users", asyncHandler(users));
router.get("/shops", asyncHandler(shops));
router.get("/products", asyncHandler(products));
router.get("/suggest", asyncHandler(suggestCtrl));

export default router;