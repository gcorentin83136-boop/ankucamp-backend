import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { shops, shopSettings } from "../../../db/schema";
import { AppError } from "../../../errors/AppError";
import type {
  VacationInput,
  HiddenInput,
  ReturnsInput,
  ContactInput,
  ShopSettingsInput,
} from "./shop.validation";

// ============================================================
// HELPERS PRIVÉS
// ============================================================

/**
 * Vérifie que l'user est bien le propriétaire de la boutique.
 * Renvoie la boutique si OK, sinon lance une erreur.
 */
async function assertShopOwner(shopId: number, userId: number) {
  const [shop] = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (!shop) {
    throw new AppError("Boutique introuvable", 404);
  }

  if (shop.owner_id !== userId) {
    throw new AppError("Vous n'êtes pas le propriétaire de cette boutique", 403);
  }

  return shop;
}

/**
 * Récupère les settings d'une boutique, ou les crée (lazy).
 */
async function getOrCreateShopSettings(shopId: number) {
  const [existing] = await db
    .select()
    .from(shopSettings)
    .where(eq(shopSettings.shop_id, shopId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(shopSettings)
    .values({ shop_id: shopId })
    .returning();

  console.log(`⚙️  shop_settings créés (lazy) pour shop #${shopId}`);
  return created;
}

function boolToInt(value: boolean | undefined): number | undefined {
  if (value === undefined) return undefined;
  return value ? 1 : 0;
}

function formatSettings(settings: any) {
  return {
    shop_id: settings.shop_id,
    vacation: {
      mode: settings.vacation_mode === 1,
      message: settings.vacation_message ?? null,
      until: settings.vacation_until ?? null,
    },
    is_hidden: settings.is_hidden === 1,
    returns: {
      accepts: settings.accepts_returns === 1,
      days: settings.return_days,
    },
    contact: {
      phone: settings.contact_phone ?? null,
      email: settings.contact_email ?? null,
    },
    shipping_zones: settings.shipping_zones
      ? JSON.parse(settings.shipping_zones)
      : [],
  };
}

// ============================================================
// LECTURE
// ============================================================

export async function getShopSettings(shopId: number, userId: number) {
  await assertShopOwner(shopId, userId);

  const settings = await getOrCreateShopSettings(shopId);
  return formatSettings(settings);
}

// ============================================================
// UPDATE GLOBAL
// ============================================================

export async function updateShopSettings(
  shopId: number,
  userId: number,
  input: ShopSettingsInput
) {
  await assertShopOwner(shopId, userId);
  await getOrCreateShopSettings(shopId);

  const updates: any = { updated_at: new Date() };

  if (input.vacation_mode !== undefined)
    updates.vacation_mode = boolToInt(input.vacation_mode);
  if (input.vacation_message !== undefined)
    updates.vacation_message = input.vacation_message;
  if (input.vacation_until !== undefined)
    updates.vacation_until = input.vacation_until
      ? new Date(input.vacation_until)
      : null;
  if (input.is_hidden !== undefined)
    updates.is_hidden = boolToInt(input.is_hidden);
  if (input.accepts_returns !== undefined)
    updates.accepts_returns = boolToInt(input.accepts_returns);
  if (input.return_days !== undefined)
    updates.return_days = input.return_days;
  if (input.contact_phone !== undefined)
    updates.contact_phone = input.contact_phone;
  if (input.contact_email !== undefined)
    updates.contact_email =
      input.contact_email === "" ? null : input.contact_email;
  if (input.shipping_zones !== undefined)
    updates.shipping_zones = input.shipping_zones
      ? JSON.stringify(input.shipping_zones)
      : null;

  const [updated] = await db
    .update(shopSettings)
    .set(updates)
    .where(eq(shopSettings.shop_id, shopId))
    .returning();

  console.log(`🏪 Settings mis à jour pour shop #${shopId}`);
  return formatSettings(updated);
}

// ============================================================
// MODE VACANCES
// ============================================================

export async function updateVacationMode(
  shopId: number,
  userId: number,
  input: VacationInput
) {
  await assertShopOwner(shopId, userId);
  await getOrCreateShopSettings(shopId);

  const [updated] = await db
    .update(shopSettings)
    .set({
      vacation_mode: boolToInt(input.vacation_mode)!,
      vacation_message: input.vacation_message ?? null,
      vacation_until: input.vacation_until
        ? new Date(input.vacation_until)
        : null,
      updated_at: new Date(),
    })
    .where(eq(shopSettings.shop_id, shopId))
    .returning();

  console.log(
    `🏖️  Mode vacances ${input.vacation_mode ? "activé" : "désactivé"} pour shop #${shopId}`
  );
  return formatSettings(updated);
}

// ============================================================
// MASQUER / DÉMASQUER
// ============================================================

export async function updateHiddenStatus(
  shopId: number,
  userId: number,
  input: HiddenInput
) {
  await assertShopOwner(shopId, userId);
  await getOrCreateShopSettings(shopId);

  const [updated] = await db
    .update(shopSettings)
    .set({
      is_hidden: boolToInt(input.is_hidden)!,
      updated_at: new Date(),
    })
    .where(eq(shopSettings.shop_id, shopId))
    .returning();

  console.log(
    `👻 Boutique #${shopId} ${input.is_hidden ? "masquée" : "visible"}`
  );
  return formatSettings(updated);
}

// ============================================================
// RETOURS
// ============================================================

export async function updateReturns(
  shopId: number,
  userId: number,
  input: ReturnsInput
) {
  await assertShopOwner(shopId, userId);
  await getOrCreateShopSettings(shopId);

  const updates: any = {
    accepts_returns: boolToInt(input.accepts_returns)!,
    updated_at: new Date(),
  };

  if (input.return_days !== undefined) {
    updates.return_days = input.return_days;
  }

  const [updated] = await db
    .update(shopSettings)
    .set(updates)
    .where(eq(shopSettings.shop_id, shopId))
    .returning();

  console.log(`↩️  Retours configurés pour shop #${shopId}`);
  return formatSettings(updated);
}

// ============================================================
// CONTACT
// ============================================================

export async function updateContact(
  shopId: number,
  userId: number,
  input: ContactInput
) {
  await assertShopOwner(shopId, userId);
  await getOrCreateShopSettings(shopId);

  const updates: any = { updated_at: new Date() };

  if (input.contact_phone !== undefined)
    updates.contact_phone = input.contact_phone;
  if (input.contact_email !== undefined)
    updates.contact_email =
      input.contact_email === "" ? null : input.contact_email;

  const [updated] = await db
    .update(shopSettings)
    .set(updates)
    .where(eq(shopSettings.shop_id, shopId))
    .returning();

  console.log(`📞 Contact mis à jour pour shop #${shopId}`);
  return formatSettings(updated);
}

// ============================================================
// HELPERS PUBLICS (pour shops.service et orders.service)
// ============================================================

/**
 * Vérifie si une boutique est masquée (n'apparaît pas dans les listes).
 */
export async function isShopHidden(shopId: number): Promise<boolean> {
  const [settings] = await db
    .select({ is_hidden: shopSettings.is_hidden })
    .from(shopSettings)
    .where(eq(shopSettings.shop_id, shopId))
    .limit(1);

  // Pas de settings = pas masquée (défaut)
  return settings?.is_hidden === 1;
}

/**
 * Vérifie si une boutique est en mode vacances.
 */
export async function isShopOnVacation(shopId: number): Promise<boolean> {
  const [settings] = await db
    .select({
      vacation_mode: shopSettings.vacation_mode,
      vacation_until: shopSettings.vacation_until,
    })
    .from(shopSettings)
    .where(eq(shopSettings.shop_id, shopId))
    .limit(1);

  if (!settings || settings.vacation_mode !== 1) return false;

  // Vérifier si la date de fin est dépassée
  if (settings.vacation_until && settings.vacation_until < new Date()) {
    return false;
  }

  return true;
}