import { z } from "zod";

export const geocodeSchema = z.object({
  address: z
    .string()
    .min(5, "L'adresse doit faire au moins 5 caractères")
    .max(255, "L'adresse ne peut pas dépasser 255 caractères"),
});
export type GeocodeInput = z.infer<typeof geocodeSchema>;

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(500).default(25),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;