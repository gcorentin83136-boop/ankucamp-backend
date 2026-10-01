import {
  eq,
  and,
  or,
  desc,
  asc,
  sql,
  inArray,
  isNotNull,
  gte,
  lte,
} from "drizzle-orm";
import { db } from "../../db";
import {
  events,
  eventRegistrations,
  users,
  notifications,
  friendships,
} from "../../db/schema";
import { AppError } from "../../errors/AppError";
import { geocodeAddress } from "../geo/geocoding.service";
import {
  notifyFriendsNewEvent,
  notifyFriendsNewRegistration,
} from "../../notifications/social-notifications.helper";
import type {
  CreateEventInput,
  UpdateEventInput,
  ListEventsQuery,
  NearbyEventsQuery,
} from "./events.validation";

// ============================================================
// HELPERS
// ============================================================

async function getFriendIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({
      requester_id: friendships.requester_id,
      receiver_id: friendships.receiver_id,
    })
    .from(friendships)
    .where(
      and(
        or(
          eq(friendships.requester_id, userId),
          eq(friendships.receiver_id, userId)
        ),
        eq(friendships.status, "accepted")
      )
    );

  return rows.map((r) =>
    r.requester_id === userId ? r.receiver_id : r.requester_id
  );
}

async function getRegistrationsCount(eventId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.event_id, eventId),
        eq(eventRegistrations.status, "registered")
      )
    );
  return row?.count ?? 0;
}

async function getOrganizerInfo(organizerId: number) {
  const [u] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      username: users.username,
      avatar_url: users.avatar_url,
      verification_status: users.verification_status,
    })
    .from(users)
    .where(eq(users.id, organizerId))
    .limit(1);
  return u ?? null;
}

async function notifyUser(
  userId: number,
  title: string,
  content: string,
  link: string | null
) {
  try {
    await db.insert(notifications).values({
      user_id: userId,
      type: "event",
      title,
      content,
      link,
    });
  } catch (err) {
    console.error("❌ Erreur notification event:", err);
  }
}

async function maybeGeocodeEvent(input: CreateEventInput | UpdateEventInput) {
  const hasCoords =
    input.latitude !== undefined &&
    input.longitude !== undefined &&
    input.latitude !== null &&
    input.longitude !== null;

  if (hasCoords) return;
  if (!input.address) return;

  try {
    const r = await geocodeAddress(input.address);
    input.latitude = r.latitude;
    input.longitude = r.longitude;
    if (!input.city) input.city = r.city;
    if (!input.postal_code) input.postal_code = r.postal_code;
  } catch (err) {
    console.error("⚠️ Auto-geocode event échoué :", err);
  }
}

async function enrichEvent(event: any, viewerId?: number) {
  const organizer = await getOrganizerInfo(event.organizer_id);
  const registrations_count = await getRegistrationsCount(event.id);

  let is_registered_by_me = false;
  let my_registration_status: string | null = null;

  if (viewerId) {
    const [reg] = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.event_id, event.id),
          eq(eventRegistrations.user_id, viewerId)
        )
      )
      .limit(1);

    if (reg) {
      is_registered_by_me =
        reg.status === "registered" || reg.status === "waitlist";
      my_registration_status = reg.status;
    }
  }

  return {
    ...event,
    latitude: event.latitude !== null ? Number(event.latitude) : null,
    longitude: event.longitude !== null ? Number(event.longitude) : null,
    price: event.price !== null ? Number(event.price) : null,
    is_free: event.is_free === 1,
    organizer,
    registrations_count,
    is_registered_by_me,
    my_registration_status,
  };
}

// ============================================================
// LECTURE
// ============================================================

export async function listEvents(query: ListEventsQuery, viewerId?: number) {
  const { type, city, from, to, upcoming, limit, offset } = query;
  const now = new Date();

  const conditions: any[] = [eq(events.status, "published")];

  if (type !== "all") conditions.push(eq(events.type, type));
  if (city) {
    conditions.push(
      sql`unaccent(lower(${events.city})) = unaccent(lower(${city}))`
    );
  }
  if (upcoming) conditions.push(gte(events.start_at, now));
  if (from) conditions.push(gte(events.start_at, from));
  if (to) conditions.push(lte(events.start_at, to));

  const rows = await db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.start_at))
    .limit(limit)
    .offset(offset);

  return Promise.all(rows.map((e) => enrichEvent(e, viewerId)));
}

export async function getEventsNearby(
  query: NearbyEventsQuery,
  viewerId?: number
) {
  const { lat, lng, radius, upcoming, limit, offset } = query;
  const now = new Date();

  const distance = sql<number>`(
    6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(${lat})) * cos(radians(${events.latitude}::numeric)) *
        cos(radians(${events.longitude}::numeric) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(${events.latitude}::numeric))
      ))
    )
  )`;

  const conditions: any[] = [
    eq(events.status, "published"),
    isNotNull(events.latitude),
    isNotNull(events.longitude),
    sql`${distance} <= ${radius}`,
  ];
  if (upcoming) conditions.push(gte(events.start_at, now));

  const rows = await db
    .select({ event: events, distance_km: distance })
    .from(events)
    .where(and(...conditions))
    .orderBy(distance)
    .limit(limit)
    .offset(offset);

  return Promise.all(
    rows.map(async (r) => {
      const enriched = await enrichEvent(r.event, viewerId);
      return {
        ...enriched,
        distance_km: Number(Number(r.distance_km).toFixed(2)),
      };
    })
  );
}

export async function getEventById(id: number, viewerId?: number) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1);

  if (!event) throw new AppError("Événement introuvable", 404);
  return enrichEvent(event, viewerId);
}

export async function getMyEvents(organizerId: number) {
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.organizer_id, organizerId))
    .orderBy(desc(events.start_at));

  return Promise.all(rows.map((e) => enrichEvent(e, organizerId)));
}

export async function getEventRegistrations(
  eventId: number,
  organizerId: number
) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new AppError("Événement introuvable", 404);
  if (event.organizer_id !== organizerId) {
    throw new AppError("Tu n'es pas l'organisateur de cet événement", 403);
  }

  const rows = await db
    .select({
      id: eventRegistrations.id,
      user_id: eventRegistrations.user_id,
      status: eventRegistrations.status,
      created_at: eventRegistrations.created_at,
      username: users.username,
      first_name: users.first_name,
      last_name: users.last_name,
      avatar_url: users.avatar_url,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(users.id, eventRegistrations.user_id))
    .where(
      and(
        eq(eventRegistrations.event_id, eventId),
        inArray(eventRegistrations.status, [
          "registered",
          "waitlist",
          "attended",
        ])
      )
    )
    .orderBy(asc(eventRegistrations.created_at));

  return rows;
}

// ============================================================
// ÉCRITURE (pro)
// ============================================================

export async function createEvent(
  organizerId: number,
  input: CreateEventInput
) {
  if (input.end_at && input.end_at < input.start_at) {
    throw new AppError("La date de fin doit être après la date de début", 400);
  }

  if (
    input.is_free === false &&
    (input.price === undefined || input.price === null)
  ) {
    throw new AppError("Un événement payant doit avoir un prix", 400);
  }

  await maybeGeocodeEvent(input);

  const [created] = await db
    .insert(events)
    .values({
      organizer_id: organizerId,
      shop_id: input.shop_id ?? null,
      title: input.title,
      description: input.description ?? null,
      cover_url: input.cover_url || null,
      type: input.type,
      start_at: input.start_at,
      end_at: input.end_at ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      postal_code: input.postal_code ?? null,
      latitude:
        input.latitude !== undefined && input.latitude !== null
          ? String(input.latitude)
          : null,
      longitude:
        input.longitude !== undefined && input.longitude !== null
          ? String(input.longitude)
          : null,
      capacity: input.capacity ?? null,
      is_free: input.is_free ? 1 : 0,
      price:
        input.price !== undefined && input.price !== null
          ? String(input.price)
          : null,
      status: input.status,
    })
    .returning();

  // Notifier les amis de l'organisateur (fire & forget)
  if (created.status === "published") {
    try {
      const friendIds = await getFriendIds(organizerId);

      if (friendIds.length > 0) {
        const [organizer] = await db
          .select({
            first_name: users.first_name,
            last_name: users.last_name,
          })
          .from(users)
          .where(eq(users.id, organizerId))
          .limit(1);

        const organizerName = organizer
          ? `${organizer.first_name} ${organizer.last_name}`
          : "Un ami";

        notifyFriendsNewEvent(
          friendIds,
          created.id,
          created.title,
          organizerName
        ).catch((err) =>
          console.error("❌ Erreur notif event amis:", err)
        );
      }
    } catch (err) {
      console.error("❌ Erreur traitement notif event amis:", err);
    }
  }

  return enrichEvent(created, organizerId);
}

export async function updateEvent(
  eventId: number,
  organizerId: number,
  input: UpdateEventInput
) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new AppError("Événement introuvable", 404);
  if (event.organizer_id !== organizerId) {
    throw new AppError("Tu n'es pas l'organisateur de cet événement", 403);
  }
  if (event.status === "cancelled") {
    throw new AppError("Impossible de modifier un événement annulé", 400);
  }

  if (input.address && input.address !== event.address) {
    await maybeGeocodeEvent(input);
  }

  const dataToUpdate: any = { ...input, updated_at: new Date() };
  if (typeof input.latitude === "number") {
    dataToUpdate.latitude = String(input.latitude);
  }
  if (typeof input.longitude === "number") {
    dataToUpdate.longitude = String(input.longitude);
  }
  if (typeof input.price === "number") {
    dataToUpdate.price = String(input.price);
  }
  if (typeof input.is_free === "boolean") {
    dataToUpdate.is_free = input.is_free ? 1 : 0;
  }

  const [updated] = await db
    .update(events)
    .set(dataToUpdate)
    .where(eq(events.id, eventId))
    .returning();

  return enrichEvent(updated, organizerId);
}

export async function cancelEvent(
  eventId: number,
  userId: number,
  reason: string | null,
  isAdmin = false
) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new AppError("Événement introuvable", 404);
  if (!isAdmin && event.organizer_id !== userId) {
    throw new AppError("Tu n'es pas l'organisateur de cet événement", 403);
  }
  if (event.status === "cancelled") {
    throw new AppError("Cet événement est déjà annulé", 409);
  }

  await db
    .update(events)
    .set({
      status: "cancelled",
      updated_at: new Date(),
      description: reason
        ? `${event.description ?? ""}\n\n[ANNULÉ] ${reason}`.trim()
        : event.description,
    })
    .where(eq(events.id, eventId));

  const registrations = await db
    .select({ user_id: eventRegistrations.user_id })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.event_id, eventId),
        inArray(eventRegistrations.status, ["registered", "waitlist"])
      )
    );

  for (const reg of registrations) {
    await notifyUser(
      reg.user_id,
      "Événement annulé",
      `L'événement "${event.title}" a été annulé.`,
      `/events/${eventId}`
    );
  }

  return { success: true, notified: registrations.length };
}

export async function deleteEvent(eventId: number, organizerId: number) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new AppError("Événement introuvable", 404);
  if (event.organizer_id !== organizerId) {
    throw new AppError("Tu n'es pas l'organisateur de cet événement", 403);
  }

  await db
    .delete(eventRegistrations)
    .where(eq(eventRegistrations.event_id, eventId));
  await db.delete(events).where(eq(events.id, eventId));
}

// ============================================================
// INSCRIPTION (user)
// ============================================================

export async function registerToEvent(eventId: number, userId: number) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) throw new AppError("Événement introuvable", 404);
  if (event.status !== "published") {
    throw new AppError("Cet événement n'est pas ouvert aux inscriptions", 400);
  }
  if (event.organizer_id === userId) {
    throw new AppError("Tu ne peux pas t'inscrire à ton propre événement", 400);
  }
  if (event.start_at < new Date()) {
    throw new AppError("Cet événement est déjà passé", 400);
  }

  const [existing] = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.event_id, eventId),
        eq(eventRegistrations.user_id, userId)
      )
    )
    .limit(1);

  if (existing) {
    if (existing.status === "registered" || existing.status === "waitlist") {
      throw new AppError("Tu es déjà inscrit à cet événement", 409);
    }
    const newStatus = await computeRegistrationStatus(event.id, event.capacity);
    await db
      .update(eventRegistrations)
      .set({ status: newStatus })
      .where(eq(eventRegistrations.id, existing.id));

    await notifyOrganizer(event.organizer_id, event.title, userId);
    return { success: true, status: newStatus };
  }

  const status = await computeRegistrationStatus(event.id, event.capacity);

  await db.insert(eventRegistrations).values({
    event_id: eventId,
    user_id: userId,
    status,
  });

  await notifyOrganizer(event.organizer_id, event.title, userId);

  // Notifier les amis de l'inscrit
  try {
    const friendIds = await getFriendIds(userId);

    if (friendIds.length > 0) {
      const [friend] = await db
        .select({
          first_name: users.first_name,
          last_name: users.last_name,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const friendName = friend
        ? `${friend.first_name} ${friend.last_name}`
        : "Un ami";

      notifyFriendsNewRegistration(
        friendIds,
        event.id,
        event.title,
        friendName
      ).catch((err) =>
        console.error("❌ Erreur notif inscription amis:", err)
      );
    }
  } catch (err) {
    console.error("❌ Erreur traitement notif inscription amis:", err);
  }

  return { success: true, status };
}

async function computeRegistrationStatus(
  eventId: number,
  capacity: number | null
): Promise<"registered" | "waitlist"> {
  if (capacity === null) return "registered";
  const count = await getRegistrationsCount(eventId);
  return count >= capacity ? "waitlist" : "registered";
}

async function notifyOrganizer(
  organizerId: number,
  eventTitle: string,
  registrantId: number
) {
  const [reg] = await db
    .select({
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(users)
    .where(eq(users.id, registrantId))
    .limit(1);

  const name = reg ? `${reg.first_name} ${reg.last_name}` : "Quelqu'un";

  await notifyUser(
    organizerId,
    "Nouvelle inscription",
    `${name} s'est inscrit à ton événement "${eventTitle}".`,
    null
  );
}

export async function unregisterFromEvent(eventId: number, userId: number) {
  const [reg] = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.event_id, eventId),
        eq(eventRegistrations.user_id, userId)
      )
    )
    .limit(1);

  if (!reg) throw new AppError("Tu n'es pas inscrit à cet événement", 404);
  if (reg.status === "cancelled") {
    throw new AppError("Tu as déjà annulé ton inscription", 409);
  }

  await db
    .update(eventRegistrations)
    .set({ status: "cancelled" })
    .where(eq(eventRegistrations.id, reg.id));

  return { success: true };
}