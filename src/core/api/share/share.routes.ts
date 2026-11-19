import { Router } from "express";
import { asyncHandler } from "../../errors/asyncHandler";
import {
  postOG,
  userOG,
  shopOG,
  postShareLinks,
  userShareLinks,
  shopShareLinks,
} from "./share.controller";

const router = Router();

// ============================================================
// OPEN GRAPH (public, pas d'auth)
// ============================================================

router.get("/posts/:id/og", asyncHandler(postOG));
router.get("/users/:username/og", asyncHandler(userOG));
router.get("/shops/:id/og", asyncHandler(shopOG));

// ============================================================
// LIENS DE PARTAGE (public)
// ============================================================

router.get("/posts/:id/links", asyncHandler(postShareLinks));
router.get("/users/:username/links", asyncHandler(userShareLinks));
router.get("/shops/:id/links", asyncHandler(shopShareLinks));

export default router;