import { Router } from "express";
import { asyncHandler } from "../../errors/asyncHandler";
import { list, getOne, getBySlug } from "./categories.controller";

const router = Router();

router.get("/", asyncHandler(list));
router.get("/slug/:slug", asyncHandler(getBySlug));
router.get("/:id", asyncHandler(getOne));

export default router;