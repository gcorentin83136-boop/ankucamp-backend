import { Router } from "express";
import { asyncHandler } from "../../errors/asyncHandler";
import { postGeocode } from "./geo.controller";

const router = Router();

router.post("/geocode", asyncHandler(postGeocode));

export default router;