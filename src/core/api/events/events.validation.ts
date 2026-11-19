import { z } from "zod";

export const EVENT_TYPES = [
  "marche",
  "atelier",
  "salon",
  "porte_ouverte",
  "degustation",
  "autre",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = [
  "draft",
  "published",
  "cancelled",
  "completed",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const REGISTRATION_STATUSES = [
  "registered",
  "waitlist",
  "cancelled",
  "attended",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

// ============================================================
// CREATE / UPDATE
// ============================================================

export const createEventSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().max(5000).optional().nullable(),
  cover_url: z.string().url().optional().nullable().or(z.literal("")),
  type: z.enum(EVENT_TYPES),
  start_at: z.coerce.date(),
  end_at: z.coerce.date().optional().nullable(),
  shop_id: z.number().int().positive().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  is_free: z.boolean().default(true),
  price: z.number().min(0).optional().nullable(),
  status: z.enum(["draft", "published"]).default("published"),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.partial();
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// ============================================================
// LIST QUERY
// ============================================================

export const listEventsQuerySchema = z.object({
  type: z.enum(["all", ...EVENT_TYPES]).default("all"),
  city: z.string().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  upcoming: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((v) => v === "true" || v === true)
    .default(true),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const nearbyEventsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(500).default(25),
  upcoming: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((v) => v === "true" || v === true)
    .default(true),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type NearbyEventsQuery = z.infer<typeof nearbyEventsQuerySchema>;

// ============================================================
// CANCEL (organizer / admin)
// ============================================================

export const cancelEventSchema = z.object({
  reason: z
    .string()
    .max(500)
    .min(5, "Explique pourquoi tu annules (min 5 car.)")
    .optional()
    .nullable(),
});
export type CancelEventInput = z.infer<typeof cancelEventSchema>;