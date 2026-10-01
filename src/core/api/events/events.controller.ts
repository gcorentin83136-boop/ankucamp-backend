import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  nearbyEventsQuerySchema,
  cancelEventSchema,
} from "./events.validation";
import {
  listEvents,
  getEventsNearby,
  getEventById,
  getMyEvents,
  getEventRegistrations,
  createEvent,
  updateEvent,
  cancelEvent,
  deleteEvent,
  registerToEvent,
  unregisterFromEvent,
} from "./events.service";

// ============================================================
// LECTURE PUBLIQUE
// ============================================================

export async function list(req: Request, res: Response) {
  const parsed = listEventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const viewerId = (req as AuthRequest).user?.id;
  const list = await listEvents(parsed.data, viewerId);
  return res.json({ success: true, count: list.length, events: list });
}

export async function nearby(req: Request, res: Response) {
  const parsed = nearbyEventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      "Paramètres invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }
  const viewerId = (req as AuthRequest).user?.id;
  const list = await getEventsNearby(parsed.data, viewerId);
  return res.json({
    success: true,
    count: list.length,
    radius_km: parsed.data.radius,
    center: { lat: parsed.data.lat, lng: parsed.data.lng },
    events: list,
  });
}

export async function getOne(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);
  const viewerId = (req as AuthRequest).user?.id;
  const event = await getEventById(id, viewerId);
  return res.json({ success: true, event });
}

// ============================================================
// MES ÉVÉNEMENTS (organisateur)
// ============================================================

export async function myEvents(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const list = await getMyEvents(req.user.id);
  return res.json({ success: true, count: list.length, events: list });
}

export async function registrations(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);
  const list = await getEventRegistrations(id, req.user.id);
  return res.json({ success: true, count: list.length, registrations: list });
}

// ============================================================
// CRÉATION / MAJ / SUPPRESSION (organisateur)
// ============================================================

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);

  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const event = await createEvent(req.user.id, parsed.data);
  return res.status(201).json({ success: true, event });
}

export async function update(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const event = await updateEvent(id, req.user.id, parsed.data);
  return res.json({ success: true, event });
}

export async function cancel(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const parsed = cancelEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      "Données invalides",
      400,
      parsed.error.flatten().fieldErrors
    );
  }

  const result = await cancelEvent(id, req.user.id, parsed.data.reason ?? null);
  return res.json(result);
}

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  await deleteEvent(id, req.user.id);
  return res.status(204).send();
}

// ============================================================
// INSCRIPTION (user)
// ============================================================

export async function register(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const result = await registerToEvent(id, req.user.id);
  return res.status(201).json(result);
}

export async function unregister(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifié", 401);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("ID invalide", 400);

  const result = await unregisterFromEvent(id, req.user.id);
  return res.json(result);
}