import { Request, Response } from "express";
import { AppError } from "../../errors/AppError";
import { geocodeSchema } from "./geo.validation";
import { geocodeAddress } from "./geocoding.service";

export async function postGeocode(req: Request, res: Response) {
  const parsed = geocodeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await geocodeAddress(parsed.data.address);
  return res.json({ success: true, ...result });
}